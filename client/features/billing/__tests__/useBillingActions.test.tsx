/**
 * `useBillingActions` tests.
 *
 * We mock the fetch layer directly on `global.fetch` (the api client
 * goes through it) and inject a stub browser so `expo-web-browser`
 * isn't loaded in Node.
 */

import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useBillingActions, __internal } from "../hooks/useBillingActions";
import type { BrowserHandoff } from "../hooks/useBillingActions";
import { useAuthStore } from "@/client/features/auth/stores/authStore";

jest.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({
    tokens: { idToken: { toString: () => "test-token" } },
  }),
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("useBillingActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Wrap store mutation in act() — subscribers (the rendered hook in
    // each test) re-render synchronously and React's test renderer warns
    // when that happens outside of act.
    act(() => {
      useAuthStore.setState({
        state: "authenticated",
        user: { userId: "u1", username: "u1", email: "u1@example.com" },
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    act(() => {
      useAuthStore.setState({ state: "unauthenticated", user: null });
    });
    jest.clearAllMocks();
  });

  it("creates a checkout session, hands it off, and refreshes the summary query", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      fakeResponse(200, { url: "https://checkout.stripe.com/abc", expiresAt: null }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const browser: BrowserHandoff = {
      openHosted: jest.fn().mockResolvedValue("success"),
    };

    const client = new QueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useBillingActions({ browser }), {
      wrapper: wrapper(client),
    });

    let actionResult: Awaited<ReturnType<typeof result.current.startCheckout>>;
    await act(async () => {
      actionResult = await result.current.startCheckout({
        planId: "pro",
        interval: "month",
      });
    });

    expect(actionResult!).toEqual({ status: "success" });
    expect(browser.openHosted).toHaveBeenCalledWith(
      "https://checkout.stripe.com/abc",
      { status: "success" },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["billing", "summary", "u1"],
    });
  });

  it("surfaces a typed problem when checkout creation fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      fakeResponse(400, { code: "unknown-plan", availablePlans: ["free"] }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const browser: BrowserHandoff = { openHosted: jest.fn() };

    const { result } = renderHook(() => useBillingActions({ browser }), {
      wrapper: wrapper(new QueryClient()),
    });

    let actionResult: Awaited<ReturnType<typeof result.current.startCheckout>>;
    await act(async () => {
      actionResult = await result.current.startCheckout({
        planId: "pro",
        interval: "month",
      });
    });

    expect(actionResult!.status).toBe("failed");
    expect(actionResult!.problem).toEqual({
      kind: "unknown-plan",
      availablePlans: ["free"],
    });
    expect(browser.openHosted).not.toHaveBeenCalled();
    expect(result.current.lastError).toEqual({
      kind: "unknown-plan",
      availablePlans: ["free"],
    });
  });

  it("maps a portal no-customer conflict into the typed problem", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      fakeResponse(409, { code: "no-customer" }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const browser: BrowserHandoff = { openHosted: jest.fn() };

    const { result } = renderHook(() => useBillingActions({ browser }), {
      wrapper: wrapper(new QueryClient()),
    });

    let actionResult: Awaited<ReturnType<typeof result.current.startPortal>>;
    await act(async () => {
      actionResult = await result.current.startPortal();
    });

    expect(actionResult!.status).toBe("failed");
    expect(actionResult!.problem).toEqual({ kind: "no-customer" });
  });

  it("returns 'dismissed' from checkout when the browser closed without a redirect", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      fakeResponse(200, { url: "https://checkout.stripe.com/abc", expiresAt: null }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const browser: BrowserHandoff = {
      openHosted: jest.fn().mockResolvedValue("dismissed"),
    };

    const { result } = renderHook(() => useBillingActions({ browser }), {
      wrapper: wrapper(new QueryClient()),
    });

    let actionResult: Awaited<ReturnType<typeof result.current.startCheckout>>;
    await act(async () => {
      actionResult = await result.current.startCheckout({
        planId: "pro",
        interval: "month",
      });
    });

    expect(actionResult!.status).toBe("dismissed");
  });
});

describe("parseReturnUrl", () => {
  const { parseReturnUrl } = __internal;

  it("extracts success / cancel / portal status values", () => {
    expect(parseReturnUrl("myapp://billing/return?status=success")).toBe("success");
    expect(parseReturnUrl("myapp://billing/return?status=cancel")).toBe("cancel");
    expect(parseReturnUrl("myapp://billing/return?status=portal")).toBe("portal");
  });

  it("returns null for unrecognized statuses so the caller's default wins", () => {
    expect(parseReturnUrl("myapp://billing/return?status=whatever")).toBeNull();
    expect(parseReturnUrl("myapp://billing/return")).toBeNull();
  });
});
