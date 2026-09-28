/**
 * `ClerkProviderBoundary` is the provider half of the cold-start handshake:
 * it mounts `ClerkProvider` with the options every `getClerkInstance()` call
 * shares, and forwards the provider's Clerk status to `clerkLoadSignal`, which
 * `clerkClient.init()` (and so the native startup gate) waits on.
 *
 * The SDK is mocked: `ClerkProvider` renders its children and records props,
 * `useClerk` returns a stand-in with Clerk's `on`/`off` status events.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

type StatusHandler = (status: string) => void;

const mockProviderProps: Record<string, unknown>[] = [];
const mockStatus = {
  handlers: new Set<StatusHandler>(),
  latest: "loading",
  on: jest.fn((_event: string, handler: StatusHandler, opts?: { notify?: boolean }) => {
    mockStatus.handlers.add(handler);
    if (opts?.notify) handler(mockStatus.latest);
  }),
  off: jest.fn((_event: string, handler: StatusHandler) => {
    mockStatus.handlers.delete(handler);
  }),
  emit(status: string) {
    mockStatus.latest = status;
    mockStatus.handlers.forEach((handler) => handler(status));
  },
};

jest.mock("@clerk/clerk-expo", () => ({
  ClerkProvider: ({ children, ...props }: { children: React.ReactNode }) => {
    mockProviderProps.push(props);
    return children;
  },
  useClerk: () => ({ on: mockStatus.on, off: mockStatus.off }),
}));
jest.mock("@clerk/clerk-expo/token-cache", () => ({
  tokenCache: { getToken: jest.fn(), saveToken: jest.fn() },
}));

import ClerkProviderBoundary, { CLERK_INSTANCE_OPTIONS } from "../ClerkProviderBoundary";
import { getClerkSettledStatus, resetClerkLoadSignalForTests } from "../clerkLoadSignal";

describe("ClerkProviderBoundary", () => {
  beforeEach(() => {
    resetClerkLoadSignalForTests();
    mockProviderProps.length = 0;
    mockStatus.handlers.clear();
    mockStatus.latest = "loading";
  });

  it("mounts ClerkProvider with the shared instance options", async () => {
    await render(
      <ClerkProviderBoundary>
        <Text>APP</Text>
      </ClerkProviderBoundary>,
    );

    expect(mockProviderProps[0]).toMatchObject({
      publishableKey: CLERK_INSTANCE_OPTIONS.publishableKey,
      tokenCache: CLERK_INSTANCE_OPTIONS.tokenCache,
    });
    expect(CLERK_INSTANCE_OPTIONS.tokenCache).toBeDefined();
  });

  it("reports the load once Clerk leaves loading", async () => {
    await render(<ClerkProviderBoundary>{null}</ClerkProviderBoundary>);

    expect(mockStatus.on).toHaveBeenCalledWith("status", expect.any(Function), { notify: true });
    expect(getClerkSettledStatus()).toBeNull();

    mockStatus.emit("ready");

    expect(getClerkSettledStatus()).toBe("ready");
  });

  it("counts a load that settled before the bridge subscribed", async () => {
    mockStatus.latest = "degraded";

    await render(<ClerkProviderBoundary>{null}</ClerkProviderBoundary>);

    expect(getClerkSettledStatus()).toBe("degraded");
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = await render(<ClerkProviderBoundary>{null}</ClerkProviderBoundary>);

    await unmount();

    expect(mockStatus.off).toHaveBeenCalledWith("status", expect.any(Function));
    expect(mockStatus.handlers.size).toBe(0);
  });
});
