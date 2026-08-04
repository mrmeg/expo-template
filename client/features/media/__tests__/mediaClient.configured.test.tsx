/**
 * The configured counterpart to `mediaClient.unconfigured.test.tsx`: with an
 * absolute `EXPO_PUBLIC_API_URL`, native queries stay enabled and the request
 * goes out against the absolute base path (never the relative `/api/media` that
 * native `fetch` rejects).
 *
 * Separate file because `isMediaOriginUnconfigured` is module-scope state and
 * `jest.resetModules()` cannot be used to re-resolve it without duplicating
 * React — one env value per module registry, so one env value per file.
 */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Platform } from "react-native";

const mockAuthenticatedFetch = jest.fn();

jest.mock("@/client/lib/api/authenticatedFetch", () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
  getAuthData: async () => ({ token: null, userId: null }),
}));

describe("media client with a configured API origin (native)", () => {
  it("requests the absolute base path exactly once per /api segment", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:3000/api";
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], totalCount: 0 }),
    });

    const { isMediaOriginUnconfigured } =
      require("../mediaClient") as typeof import("../mediaClient");
    const { useMediaList } =
      require("../hooks/useMediaList") as typeof import("../hooks/useMediaList");

    expect(isMediaOriginUnconfigured).toBe(false);

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

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
    expect(String(mockAuthenticatedFetch.mock.calls[0][0])).toContain(
      "http://localhost:3000/api/media/list",
    );
  });
});
