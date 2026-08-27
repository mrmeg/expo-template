/**
 * Pricing demo CTA-guard tests.
 *
 * `handleAction` has two pre-flight guards before it touches Stripe:
 *   1. auth is not configured in this environment → explain, do nothing
 *   2. auth is configured but the viewer is signed out → send them to profile
 *
 * Guard 1 regressed once by reading the `isAuthEnabled` *function* instead of
 * calling it (`if (!isAuthEnabled)` is always false), which silently let a
 * blank-env environment fall through to the sign-in redirect. These tests
 * drive the real `isAuthEnabled` through env so a truthy-reference regression
 * fails here.
 *
 * Billing is force-enabled: with `EXPO_PUBLIC_BILLING_ENABLED` unset the paid
 * plan CTAs render disabled and no press ever reaches the guards.
 */

import "@/test/mockTheme";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockNotify = jest.fn();
const mockPush = jest.fn();
const mockStartCheckout = jest.fn();
const mockStartPortal = jest.fn();

jest.mock("@mrmeg/expo-ui/state", () => {
  const actual = jest.requireActual("@mrmeg/expo-ui/state");
  return {
    ...actual,
    notify: (...args: unknown[]) => mockNotify(...args),
  };
});

// setup.ts mocks expo-router without a `router` singleton; the demo imports it.
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => "/",
  Link: "Link",
  Stack: { Screen: "Screen" },
  Redirect: "Redirect",
}));

jest.mock("@/client/config", () => {
  const actual = jest.requireActual("@/client/config");
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, billingEnabled: true },
  };
});

jest.mock("@/client/features/billing", () => {
  const actual = jest.requireActual("@/client/features/billing");
  return {
    ...actual,
    useBillingActions: () => ({
      startCheckout: mockStartCheckout,
      startPortal: mockStartPortal,
    }),
  };
});

import ScreenPricingDemo from "../demo";

const AUTH_ENV_KEYS = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_USER_POOL_ID",
  "EXPO_PUBLIC_USER_POOL_CLIENT_ID",
  "EXPO_PUBLIC_AUTH_PROVIDER",
] as const;

function renderDemo() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ScreenPricingDemo />
    </QueryClientProvider>,
  );
}

/** Press the Pro plan CTA (index 1 in the demo catalog). */
async function pressProCta() {
  const ctas = screen.getAllByText("Sign in to continue");
  await fireEvent.press(ctas[1]);
}

describe("pricing demo CTA guards", () => {
  const original: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of AUTH_ENV_KEYS) original[key] = process.env[key];
  });

  beforeEach(() => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    mockNotify.mockClear();
    mockPush.mockClear();
    mockStartCheckout.mockClear();
    mockStartPortal.mockClear();
  });

  afterAll(() => {
    for (const key of AUTH_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("explains that sign-in is unavailable when no auth provider is configured", async () => {
    await renderDemo();
    await pressProCta();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: ["Sign-in is not configured in this environment."],
      }),
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });

  it("sends a signed-out viewer to profile when auth is configured", async () => {
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_abc";

    await renderDemo();
    await pressProCta();

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ messages: ["Sign in to choose a plan."] }),
    );
    expect(mockPush).toHaveBeenCalledWith("/(main)/(tabs)/profile");
    expect(mockStartCheckout).not.toHaveBeenCalled();
  });
});
