/**
 * Fail-closed wiring: native with no API origin configured.
 *
 * `isMediaOriginUnconfigured` is resolved once at module scope, so the media
 * modules are required lazily inside the test — after `Platform.OS` and
 * `EXPO_PUBLIC_API_URL` are set — instead of being imported at the top. They are
 * required exactly once and `jest.resetModules()` is never called, so React and
 * React Query stay single copies (a reset registry would hand the re-required
 * hook a second React and every hook call would throw).
 *
 * What matters here is the absence of network activity: no relative-URL fetch
 * that can only throw `TypeError: Invalid URL` on native. The configured
 * counterpart lives in `mediaClient.configured.test.tsx`.
 */
import React from "react";
import { renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Platform } from "react-native";

const mockAuthenticatedFetch = jest.fn();

jest.mock("@/client/lib/api/authenticatedFetch", () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
  getAuthData: async () => ({ token: null, userId: null }),
}));

describe("media client with no API origin (native)", () => {
  it("reports unconfigured and makes no request", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    process.env.EXPO_PUBLIC_API_URL = "";

    const { isMediaOriginUnconfigured } =
      require("../mediaClient") as typeof import("../mediaClient");
    const { useMediaList } =
      require("../hooks/useMediaList") as typeof import("../hooks/useMediaList");

    expect(isMediaOriginUnconfigured).toBe(true);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = await renderHook(
      () =>
        useMediaList({
          mediaType: "avatars",
          enabled: !isMediaOriginUnconfigured,
        }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    // A disabled query never enters a fetching state, so there is nothing to
    // await — assert the idle, error-free shape directly.
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
  });
});
