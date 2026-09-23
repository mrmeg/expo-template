/**
 * Startup ordering at the root of the tree.
 *
 * Startup (`useAppStartup` → Clerk `init()`) waits for Clerk to load, and Clerk
 * loads only inside `ClerkProvider`. So on native the provider must mount while
 * the splash is still up — before `ready` — with the app withheld, and the app
 * must then render into that same provider instance (a remount would load
 * Clerk again). Cognito and disabled auth mount no provider: nothing renders
 * until `ready`, exactly as before. Web renders through.
 *
 * The Clerk branch of `AuthProviderGate` is a `React.lazy(() => import(...))`
 * boundary, which Jest's VM cannot execute (see AuthGate.test.tsx), so
 * `React.lazy` is stubbed to resolve the mocked `clerkClient` chunk
 * synchronously — the gate's real branching stays under test.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform, Text } from "react-native";

const mockBoundaryLifecycle = { mounts: 0, unmounts: 0 };

jest.mock("@/client/features/auth/provider/clerkClient", () => {
  const ReactModule = require("react");
  const { Text: RNText } = require("react-native");

  function MockClerkProviderBoundary({ children }: { children: React.ReactNode }) {
    ReactModule.useEffect(() => {
      mockBoundaryLifecycle.mounts += 1;
      return () => {
        mockBoundaryLifecycle.unmounts += 1;
      };
    }, []);
    return ReactModule.createElement(ReactModule.Fragment, null, [
      ReactModule.createElement(RNText, { key: "marker" }, "CLERK_PROVIDER"),
      ReactModule.createElement(ReactModule.Fragment, { key: "children" }, children),
    ]);
  }

  return { ClerkProviderBoundary: MockClerkProviderBoundary, createClerkAuthClient: jest.fn() };
});

jest.spyOn(React, "lazy").mockImplementation((() =>
  function ResolvedClerkChunk(props: { children: React.ReactNode }) {
    const { ClerkProviderBoundary } = require("@/client/features/auth/provider/clerkClient");
    return React.createElement(ClerkProviderBoundary, props);
  }) as never);

// Required (not imported) so the React.lazy stub is in place before
// AuthProviderGate's module-scope `React.lazy(...)` runs.
const { StartupGate } = require("../StartupGate") as typeof import("../StartupGate");

const ENV_KEYS = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_AUTH_PROVIDER",
] as const;

const App = () => <Text>APP</Text>;

describe("StartupGate", () => {
  const originalEnv: Record<string, string | undefined> = {};
  const originalPlatform = Platform.OS;

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    mockBoundaryLifecycle.mounts = 0;
    mockBoundaryLifecycle.unmounts = 0;
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  describe("with Clerk on native", () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";
    });

    it("mounts ClerkProvider under the splash and withholds the app", async () => {
      await render(
        <StartupGate ready={false}>
          <App />
        </StartupGate>,
      );

      expect(screen.getByText("CLERK_PROVIDER")).toBeTruthy();
      expect(screen.queryByText("APP")).toBeNull();
      expect(mockBoundaryLifecycle.mounts).toBe(1);
    });

    it("renders the app into the same provider once startup is ready", async () => {
      const { rerender } = await render(
        <StartupGate ready={false}>
          <App />
        </StartupGate>,
      );

      await rerender(
        <StartupGate ready>
          <App />
        </StartupGate>,
      );

      expect(screen.getByText("CLERK_PROVIDER")).toBeTruthy();
      expect(screen.getByText("APP")).toBeTruthy();
      expect(mockBoundaryLifecycle).toEqual({ mounts: 1, unmounts: 0 });
    });
  });

  it.each([
    ["Cognito", () => {
      process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_abc";
      process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client123";
    }],
    ["auth disabled", () => {}],
  ])("renders nothing until ready with %s, then the app", async (_label, configure) => {
    configure();

    const { rerender, toJSON } = await render(
      <StartupGate ready={false}>
        <App />
      </StartupGate>,
    );

    expect(toJSON()).toBeNull();

    await rerender(
      <StartupGate ready>
        <App />
      </StartupGate>,
    );

    expect(screen.getByText("APP")).toBeTruthy();
    expect(mockBoundaryLifecycle.mounts).toBe(0);
  });

  it("renders through on web before startup is ready", async () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";

    await render(
      <StartupGate ready={false}>
        <App />
      </StartupGate>,
    );

    expect(screen.getByText("APP")).toBeTruthy();
  });
});
