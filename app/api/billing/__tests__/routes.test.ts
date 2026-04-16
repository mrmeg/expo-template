/**
 * Billing route tests.
 *
 * Cover auth gating, plan → price mapping, webhook raw-body + signature
 * handling, and idempotent duplicate delivery. Dependencies (resolver,
 * session factories, webhook verifier/handler) are injected through the
 * registry, so no real Stripe or Cognito SDK is required.
 */

import { setTokenVerifier, type TokenVerifier } from "@/server/api/shared/auth";
import { resetAuthBootstrap } from "@/server/api/shared/authBootstrap";
import { freeBillingSummary, type BillingSummary } from "@/shared/billing";
import type { BillingAccountResolver } from "@/server/api/billing/types";
import { CustomerConflictError } from "@/server/api/billing/types";
import {
  setBillingRegistry,
  type BillingRegistry,
} from "@/server/api/billing/registry";
import { resetBillingBootstrap } from "@/server/api/billing/bootstrap";
import { createMemoryIdempotencyStore } from "@/server/api/billing/idempotency";

import { GET as getSummary } from "../summary+api";
import { POST as postCheckout } from "../checkout-session+api";
import { POST as postPortal } from "../portal-session+api";
import { POST as postWebhook, setWebhookIdempotencyStore } from "../webhook+api";

const user = { userId: "u_1", email: "u1@example.com" };

const verifier: TokenVerifier = {
  async verify(token) {
    if (token === "good") return user;
    throw new Error("bad token");
  },
};

function authedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer good");
  return new Request(url, { ...init, headers });
}

function jsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer good");
  headers.set("Content-Type", "application/json");
  return new Request(url, { ...init, method: init.method ?? "POST", body: JSON.stringify(body), headers });
}

function buildRegistry(overrides: Partial<BillingRegistry> = {}): BillingRegistry {
  const resolver: BillingAccountResolver = overrides.resolver ?? {
    async resolveOrCreateCustomer() {
      return { customerId: "cus_123" };
    },
    async getBillingSummary() {
      return freeBillingSummary({ customerId: "cus_123" });
    },
  };
  return {
    resolver,
    planCatalog: overrides.planCatalog ?? [
      {
        id: "pro",
        label: "Pro",
        stripePriceIdMonth: "price_pro_month",
        stripePriceIdYear: "price_pro_year",
        features: ["export.csv"],
      },
      {
        id: "starter",
        label: "Starter",
        stripePriceIdMonth: null,
        stripePriceIdYear: null,
        features: [],
      },
    ],
    createCheckoutSession:
      overrides.createCheckoutSession ??
      (async () => ({ url: "https://checkout.stripe.com/abc", expiresAt: null })),
    createPortalSession:
      overrides.createPortalSession ??
      (async () => ({ url: "https://billing.stripe.com/portal" })),
    webhookVerifier:
      overrides.webhookVerifier ?? {
        verify(rawBody, signature) {
          if (signature !== "sig_good") throw new Error("bad sig");
          return JSON.parse(rawBody) as { id: string; type: string; data: unknown };
        },
      },
    webhookHandler:
      overrides.webhookHandler ?? {
        async handle() {},
      },
  };
}

beforeEach(() => {
  resetAuthBootstrap();
  resetBillingBootstrap();
  setTokenVerifier(verifier);
  setBillingRegistry(buildRegistry());
});

afterEach(() => {
  setTokenVerifier(null);
  setBillingRegistry(null);
  setWebhookIdempotencyStore(null);
  resetAuthBootstrap();
  resetBillingBootstrap();
});

describe("GET /api/billing/summary", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await getSummary(new Request("http://localhost/api/billing/summary"));
    expect(response.status).toBe(401);
  });

  it("returns the normalized summary for the authenticated user", async () => {
    const response = await getSummary(authedRequest("http://localhost/api/billing/summary"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as BillingSummary;
    expect(body.status).toBe("free");
    expect(body.customerId).toBe("cus_123");
  });

  it("returns 503 billing-disabled when the registry is unconfigured", async () => {
    setBillingRegistry(null);
    const response = await getSummary(authedRequest("http://localhost/api/billing/summary"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("billing-disabled");
  });
});

describe("POST /api/billing/checkout-session", () => {
  it("rejects unauthenticated requests", async () => {
    const request = new Request("http://localhost/api/billing/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pro", interval: "month" }),
    });
    const response = await postCheckout(request);
    expect(response.status).toBe(401);
  });

  it("resolves priceId from the server catalog and returns the session URL", async () => {
    const created = jest
      .fn()
      .mockResolvedValue({ url: "https://stripe/ok", expiresAt: null });
    setBillingRegistry(buildRegistry({ createCheckoutSession: created }));

    const response = await postCheckout(
      jsonRequest("http://localhost/api/billing/checkout-session", {
        planId: "pro",
        interval: "year",
      }),
    );

    expect(response.status).toBe(200);
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u_1",
        customerId: "cus_123",
        planId: "pro",
        interval: "year",
        successUrl: "http://localhost/billing/return?status=success",
        cancelUrl: "http://localhost/billing/return?status=cancel",
      }),
    );
  });

  it("returns unknown-plan when the catalog lacks the requested plan", async () => {
    const response = await postCheckout(
      jsonRequest("http://localhost/api/billing/checkout-session", {
        planId: "enterprise",
        interval: "month",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("unknown-plan");
    expect(body.availablePlans).toEqual(["pro", "starter"]);
  });

  it("returns configuration-missing when the plan has no price for the requested interval", async () => {
    const response = await postCheckout(
      jsonRequest("http://localhost/api/billing/checkout-session", {
        planId: "starter",
        interval: "month",
      }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("configuration-missing");
  });

  it("returns billing-conflict when the resolver throws CustomerConflictError", async () => {
    const resolver: BillingAccountResolver = {
      async resolveOrCreateCustomer() {
        throw new CustomerConflictError(["cus_a", "cus_b"]);
      },
      async getBillingSummary() {
        return freeBillingSummary();
      },
    };
    setBillingRegistry(buildRegistry({ resolver }));

    const response = await postCheckout(
      jsonRequest("http://localhost/api/billing/checkout-session", {
        planId: "pro",
        interval: "month",
      }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("billing-conflict");
    expect(body.candidateCustomerIds).toEqual(["cus_a", "cus_b"]);
  });

  it("rejects interval values outside {month, year}", async () => {
    const response = await postCheckout(
      jsonRequest("http://localhost/api/billing/checkout-session", {
        planId: "pro",
        interval: "weekly",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/billing/portal-session", () => {
  it("rejects unauthenticated requests", async () => {
    const request = new Request("http://localhost/api/billing/portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await postPortal(request);
    expect(response.status).toBe(401);
  });

  it("returns no-customer when the user has no Stripe customer yet", async () => {
    const resolver: BillingAccountResolver = {
      async resolveOrCreateCustomer() {
        return { customerId: "cus_123" };
      },
      async getBillingSummary() {
        return freeBillingSummary(); // customerId: null
      },
    };
    setBillingRegistry(buildRegistry({ resolver }));

    const response = await postPortal(
      jsonRequest("http://localhost/api/billing/portal-session", {}),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("no-customer");
  });

  it("creates a portal session when the user has a customer", async () => {
    const response = await postPortal(
      jsonRequest("http://localhost/api/billing/portal-session", {}),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe("https://billing.stripe.com/portal");
  });
});

describe("POST /api/billing/webhook", () => {
  it("rejects requests missing the Stripe-Signature header", async () => {
    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      body: JSON.stringify({ id: "evt_1", type: "x", data: {} }),
    });
    const response = await postWebhook(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("missing-signature");
  });

  it("rejects invalid Stripe signatures", async () => {
    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "sig_bad", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "evt_1", type: "x", data: {} }),
    });
    const response = await postWebhook(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("invalid-signature");
  });

  it("verifies using the raw body and dispatches the event", async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    const verifier = {
      verify: jest.fn((raw: string, sig: string) => {
        if (sig !== "sig_good") throw new Error("bad");
        return JSON.parse(raw) as { id: string; type: string; data: unknown };
      }),
    };
    setBillingRegistry(
      buildRegistry({ webhookHandler: handler, webhookVerifier: verifier }),
    );

    const event = { id: "evt_1", type: "customer.subscription.updated", data: { object: {} } };
    const rawBody = JSON.stringify(event);
    const request = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "sig_good", "Content-Type": "application/json" },
      body: rawBody,
    });

    const response = await postWebhook(request);
    expect(response.status).toBe(200);
    expect(verifier.verify).toHaveBeenCalledWith(rawBody, "sig_good");
    expect(handler.handle).toHaveBeenCalledWith(event);
  });

  it("is idempotent: duplicate event IDs run the handler exactly once", async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    const verifier = {
      verify: (raw: string) => JSON.parse(raw) as { id: string; type: string; data: unknown },
    };
    setBillingRegistry(
      buildRegistry({ webhookHandler: handler, webhookVerifier: verifier }),
    );
    // Use a fresh store so this test is not polluted by other suites.
    setWebhookIdempotencyStore(createMemoryIdempotencyStore());

    const event = { id: "evt_dupe", type: "invoice.paid", data: {} };
    const rawBody = JSON.stringify(event);
    const makeRequest = () =>
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "any", "Content-Type": "application/json" },
        body: rawBody,
      });

    const r1 = await postWebhook(makeRequest());
    const r2 = await postWebhook(makeRequest());

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const b2 = await r2.json();
    expect(b2.duplicate).toBe(true);
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it("does not mark an event processed when the handler throws (Stripe will retry)", async () => {
    const handler = { handle: jest.fn().mockRejectedValue(new Error("db down")) };
    const verifier = {
      verify: (raw: string) => JSON.parse(raw) as { id: string; type: string; data: unknown },
    };
    setBillingRegistry(
      buildRegistry({ webhookHandler: handler, webhookVerifier: verifier }),
    );
    setWebhookIdempotencyStore(createMemoryIdempotencyStore());

    const event = { id: "evt_retry", type: "x", data: {} };
    const rawBody = JSON.stringify(event);
    const req = () =>
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "any", "Content-Type": "application/json" },
        body: rawBody,
      });

    const r1 = await postWebhook(req());
    expect(r1.status).toBe(500);

    handler.handle.mockResolvedValueOnce(undefined);
    const r2 = await postWebhook(req());
    expect(r2.status).toBe(200);
    expect(handler.handle).toHaveBeenCalledTimes(2);
  });
});
