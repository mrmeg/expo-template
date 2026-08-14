/**
 * AuthGate contract tests.
 *
 * The gate has three observable states:
 *   - auth disabled in env → render children (template stays explorable)
 *   - auth enabled + loading → render a spinner placeholder
 *   - auth enabled + unauthenticated → render the shared AuthScreen
 *   - auth enabled + authenticated → render children
 *
 * The AuthScreen arrives through a lazy `import()` of
 * `@/client/features/auth/components` (bundle layout: it must not sit in the
 * eager web chunk), which Jest's VM cannot execute — a real dynamic import
 * throws "A dynamic import callback was invoked without
 * --experimental-vm-modules", the same limitation documented in
 * ../../auth/provider/__tests__/AuthProviderGate.test.tsx. So `React.lazy` is
 * stubbed below to resolve the mocked barrel synchronously: the gate's branch
 * logic and Suspense fallback stay under test, while the specifier invariant the
 * chunk layout depends on is asserted in
 * ../../auth/components/__tests__/authComponentsSplitPoint.test.ts.
 */

import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@mrmeg/expo-ui/hooks", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        primary: "#000",
        background: "#fff",
        accent: "#14B8A6",
        border: "#E2E8F0",
        foreground: "#0F172A",
        text: "#0F172A",
        textDim: "#64748B",
        mutedForeground: "#64748B",
        muted: "#F1F5F9",
        card: "#fff",
        destructive: "#EF4444",
      },
    },
    getShadowStyle: () => ({}),
    getContrastingColor: () => "#fff",
    withAlpha: (c: string) => c,
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
    scheme: "light",
  }),
}));

// Stub the barrel the gate lazily imports, so we don't drag Amplify / forms into
// this test. The counter says whether the module entered the graph at all: the
// factory runs on first require, so it stays 0 until the unauthenticated branch
// actually renders.
const mockAuthComponentsLoads = { count: 0 };

jest.mock("@/client/features/auth/components", () => {
  mockAuthComponentsLoads.count += 1;
  const ReactModule = require("react");
  const { Text: RNText } = require("react-native");
  return {
    AuthScreen: () => ReactModule.createElement(RNText, null, "MOCK_AUTH_SCREEN"),
  };
});

// Stand in for React.lazy (see the file header): record each lazy boundary the
// gate declares and resolve it from the mocked barrel at render time, which is
// what a resolved chunk does in the browser. `pendingChunk` lets a test hold the
// chunk in flight to observe the Suspense fallback.
const mockLazyBoundaries: unknown[] = [];
let pendingChunk: { promise: Promise<void> } | null = null;

jest.spyOn(React, "lazy").mockImplementation(((loader: unknown) => {
  mockLazyBoundaries.push(loader);
  return function ResolvedLazyChunk(props: Record<string, unknown>) {
    if (pendingChunk) throw pendingChunk.promise;
    const { AuthScreen } = require("@/client/features/auth/components");
    return React.createElement(AuthScreen, props);
  };
}) as never);

/** Suspend the lazy boundary until the returned release function is awaited. */
function holdChunkInFlight() {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = () => r();
  });
  pendingChunk = { promise };

  return async () => {
    pendingChunk = null;
    resolve();
    await promise;
  };
}

import { useAuthStore } from "@/client/features/auth/stores/authStore";
// Required (not imported) so the React.lazy stub above is installed before the
// gate's module-scope `React.lazy(...)` call runs.
const { AuthGate } = require("../AuthGate") as typeof import("../AuthGate");

// Read after the gate module has been evaluated: importing it must not pull the
// auth UI in — only rendering the unauthenticated branch may.
const loadsAfterImport = mockAuthComponentsLoads.count;

const setAuth = (state: "loading" | "authenticated" | "unauthenticated") => {
  useAuthStore.setState({ state } as any);
};

describe("AuthGate", () => {
  const originalPool = process.env.EXPO_PUBLIC_USER_POOL_ID;
  const originalClient = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;

  afterEach(async () => {
    if (originalPool === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_ID = originalPool;
    if (originalClient === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = originalClient;
    await act(() => {
      useAuthStore.setState({ state: "loading", user: null } as any);
    });
  });

  it("declares exactly one lazy boundary and loads nothing at import time", () => {
    expect(mockLazyBoundaries).toHaveLength(1);
    expect(loadsAfterImport).toBe(0);
  });

  it("renders children when auth is not configured in env", async () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    setAuth("unauthenticated");

    await render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.getByText("PROTECTED")).toBeTruthy();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });

  it("renders the lazily loaded AuthScreen when unauthenticated and auth is configured", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("unauthenticated");

    await render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(await screen.findByText("MOCK_AUTH_SCREEN")).toBeTruthy();
    expect(screen.queryByText("PROTECTED")).toBeNull();
    // The chunk is only requested on this branch.
    expect(mockAuthComponentsLoads.count).toBeGreaterThan(0);
  });

  it("shows its own loading indicator while the AuthScreen chunk is in flight", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("unauthenticated");

    // The Suspense fallback has to be the gate's existing spinner: children must
    // stay unmounted behind the gate, and a signed-out first paint should look
    // like the loading state it already shows, not a blank frame.
    const releaseChunk = holdChunkInFlight();

    await render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    const indicators = screen.root!.queryAll((node) => node.type === "ActivityIndicator");
    expect(indicators).toHaveLength(1);
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
    expect(screen.queryByText("PROTECTED")).toBeNull();

    await act(releaseChunk);

    expect(await screen.findByText("MOCK_AUTH_SCREEN")).toBeTruthy();
  });

  it("renders children when authenticated", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("authenticated");

    await render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.getByText("PROTECTED")).toBeTruthy();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });

  it("does not render children or AuthScreen while auth is loading", async () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "pool";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "client";
    setAuth("loading");

    await render(
      <AuthGate>
        <Text>PROTECTED</Text>
      </AuthGate>,
    );

    expect(screen.queryByText("PROTECTED")).toBeNull();
    expect(screen.queryByText("MOCK_AUTH_SCREEN")).toBeNull();
  });
});
