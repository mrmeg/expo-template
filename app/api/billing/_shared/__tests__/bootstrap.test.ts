/**
 * Bootstrap tests.
 *
 * Exercise the idempotent wiring of the billing registry from env
 * vars. The real Stripe SDK is heavy and tests run offline, so this
 * suite uses overrides to keep Stripe out of the path while still
 * covering the "wire a registry from env" code path.
 */

import {
  ensureBillingBootstrapped,
  resetBillingBootstrap,
  billingBootstrapState,
} from "../bootstrap";
import { getBillingRegistry, setBillingRegistry, type BillingRegistry } from "../registry";

function fakeRegistry(): BillingRegistry {
  return {
    resolver: {
      async resolveOrCreateCustomer() {
        return { customerId: "cus_stub" };
      },
      async getBillingSummary() {
        throw new Error("not used");
      },
    },
    planCatalog: [],
    async createCheckoutSession() {
      return { url: "https://checkout", expiresAt: null };
    },
    async createPortalSession() {
      return { url: "https://portal" };
    },
    webhookVerifier: {
      verify() {
        return { id: "evt", type: "x", data: {} };
      },
    },
    webhookHandler: {
      async handle() {},
    },
  };
}

beforeEach(() => {
  resetBillingBootstrap();
});

afterEach(() => {
  resetBillingBootstrap();
});

describe("ensureBillingBootstrapped", () => {
  it("returns null and marks state skipped when Stripe env is missing", () => {
    const registry = ensureBillingBootstrapped({ env: {} });
    expect(registry).toBeNull();
    expect(billingBootstrapState()).toEqual({ bootstrapped: true, outcome: "skipped" });
  });

  it("is idempotent — does not reread env on repeat calls", () => {
    ensureBillingBootstrapped({ env: {} });
    // Second call must not re-enter the construction path.
    const second = ensureBillingBootstrapped({
      env: { STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "whsec" },
    });
    expect(second).toBeNull();
    expect(billingBootstrapState().outcome).toBe("skipped");
  });

  it("preserves a preinstalled registry instead of overwriting it", () => {
    const preinstalled = fakeRegistry();
    setBillingRegistry(preinstalled);

    const result = ensureBillingBootstrapped({
      env: { STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "whsec" },
    });

    expect(result).toBe(preinstalled);
    expect(getBillingRegistry()).toBe(preinstalled);
    expect(billingBootstrapState()).toEqual({
      bootstrapped: true,
      outcome: "skipped",
    });
  });

  it("resetBillingBootstrap clears both the flag and the registry", () => {
    setBillingRegistry(fakeRegistry());
    ensureBillingBootstrapped({ env: {} });
    expect(billingBootstrapState().bootstrapped).toBe(true);

    resetBillingBootstrap();

    expect(getBillingRegistry()).toBeNull();
    expect(billingBootstrapState()).toEqual({ bootstrapped: false, outcome: null });
  });
});
