/**
 * @jest-environment node
 */

/**
 * `createStripeAdapter` — the one file that talks to the Stripe SDK. A real
 * Stripe client is constructed (no network: construction is local) and its
 * resource methods are stubbed at the SDK boundary, so these tests pin the
 * request parameters the adapter sends and the shapes it maps responses to.
 * Webhook verification runs the SDK's real HMAC check against signatures the
 * SDK's own test helper produces.
 */

import { createStripeAdapter } from "../stripeAdapter";

const WEBHOOK_SECRET = "whsec_test_secret";

function makeAdapter() {
  return createStripeAdapter({ secretKey: "sk_test_adapter", webhookSecret: WEBHOOK_SECRET });
}

function list<T>(data: T[]) {
  return { object: "list", data, has_more: false, url: "/v1/test" } as never;
}

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: "cus_1",
    object: "customer",
    email: "ada@example.com",
    metadata: { appUserId: "user_1" },
    ...overrides,
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    object: "subscription",
    status: "active",
    created: 100,
    cancel_at_period_end: false,
    customer: "cus_1",
    items: {
      data: [
        {
          current_period_end: 1_900_000_000,
          price: { id: "price_pro_month", recurring: { interval: "month" } },
        },
      ],
    },
    ...overrides,
  };
}

describe("createStripeAdapter customers port", () => {
  it("finds a customer by app user id through Search, escaping quotes", async () => {
    const adapter = makeAdapter();
    const search = jest
      .spyOn(adapter.stripe.customers, "search")
      .mockResolvedValue(list([customer({ metadata: { appUserId: "o'brien" } })]));

    await expect(adapter.customers.findByAppUserId("o'brien")).resolves.toEqual({
      id: "cus_1",
      email: "ada@example.com",
      metadata: { appUserId: "o'brien" },
    });
    expect(search).toHaveBeenCalledWith({ query: "metadata['appUserId']:'o\\'brien'", limit: 2 });

    search.mockResolvedValue(list([]));
    await expect(adapter.customers.findByAppUserId("nobody")).resolves.toBeNull();
  });

  it("lists customers by email and maps deleted and email-less ones safely", async () => {
    const adapter = makeAdapter();
    const listCustomers = jest.spyOn(adapter.stripe.customers, "list").mockResolvedValue(
      list([
        customer(),
        customer({ id: "cus_2", email: null, metadata: undefined }),
        { id: "cus_3", object: "customer", deleted: true },
      ]),
    );

    await expect(adapter.customers.findByEmail("ada@example.com")).resolves.toEqual([
      { id: "cus_1", email: "ada@example.com", metadata: { appUserId: "user_1" } },
      { id: "cus_2", email: null, metadata: {} },
      { id: "cus_3", email: null, metadata: {} },
    ]);
    expect(listCustomers).toHaveBeenCalledWith({ email: "ada@example.com", limit: 10 });
  });

  it("updates metadata and creates customers without sending a null email", async () => {
    const adapter = makeAdapter();
    const update = jest.spyOn(adapter.stripe.customers, "update").mockResolvedValue(customer() as never);
    const create = jest
      .spyOn(adapter.stripe.customers, "create")
      .mockResolvedValue(customer({ id: "cus_new", email: null, metadata: { appUserId: "user_2" } }) as never);

    await adapter.customers.updateMetadata("cus_1", { appUserId: "user_1" });
    expect(update).toHaveBeenCalledWith("cus_1", { metadata: { appUserId: "user_1" } });

    await expect(
      adapter.customers.create({ email: null, metadata: { appUserId: "user_2" } }),
    ).resolves.toEqual({ id: "cus_new", email: null, metadata: { appUserId: "user_2" } });
    expect(create).toHaveBeenCalledWith({ email: undefined, metadata: { appUserId: "user_2" } });
  });
});

describe("createStripeAdapter listActiveSubscriptions", () => {
  it("requests every status with prices expanded", async () => {
    const adapter = makeAdapter();
    const listSubscriptions = jest.spyOn(adapter.stripe.subscriptions, "list").mockResolvedValue(list([]));

    await expect(adapter.customers.listActiveSubscriptions("cus_1")).resolves.toEqual([]);
    expect(listSubscriptions).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });
  });

  it("collapses onto the newest entitled subscription and maps it to the port shape", async () => {
    const adapter = makeAdapter();
    jest.spyOn(adapter.stripe.subscriptions, "list").mockResolvedValue(
      list([
        subscription({ id: "sub_old_active", created: 100 }),
        subscription({ id: "sub_newer_canceled", status: "canceled", created: 300 }),
        subscription({
          id: "sub_new_past_due",
          status: "past_due",
          created: 200,
          cancel_at_period_end: true,
          customer: { id: "cus_1", object: "customer" },
          items: {
            data: [{ current_period_end: 1_800_000_000, price: { id: "price_pro_year", recurring: { interval: "year" } } }],
          },
        }),
      ]),
    );

    await expect(adapter.customers.listActiveSubscriptions("cus_1")).resolves.toEqual([
      {
        status: "past_due",
        cancel_at_period_end: true,
        current_period_end: 1_800_000_000,
        items: { data: [{ price: { id: "price_pro_year", recurring: { interval: "year" } } }] },
        customer: { id: "cus_1" },
      },
    ]);
  });

  it("falls back to the newest subscription when none is entitled", async () => {
    const adapter = makeAdapter();
    jest.spyOn(adapter.stripe.subscriptions, "list").mockResolvedValue(
      list([
        subscription({ id: "sub_a", status: "canceled", created: 100 }),
        subscription({ id: "sub_b", status: "incomplete_expired", created: 200 }),
      ]),
    );

    const [chosen] = await adapter.customers.listActiveSubscriptions("cus_1");
    expect(chosen.status).toBe("incomplete_expired");
  });

  it("reads the period end from the item, then the legacy subscription field, else null", async () => {
    const adapter = makeAdapter();
    const listSubscriptions = jest.spyOn(adapter.stripe.subscriptions, "list");

    listSubscriptions.mockResolvedValue(
      list([
        subscription({
          current_period_end: 1_700_000_000,
          items: { data: [{ price: { id: "price_legacy", recurring: null } }] },
        }),
      ]),
    );
    const [legacy] = await adapter.customers.listActiveSubscriptions("cus_1");
    expect(legacy.current_period_end).toBe(1_700_000_000);
    expect(legacy.items.data[0].price).toEqual({ id: "price_legacy", recurring: null });

    listSubscriptions.mockResolvedValue(
      list([subscription({ items: { data: [{ price: { id: "price_x", recurring: { interval: "month" } } }] } })]),
    );
    const [missing] = await adapter.customers.listActiveSubscriptions("cus_1");
    expect(missing.current_period_end).toBeNull();
  });
});

describe("createStripeAdapter sessions", () => {
  it("creates a subscription Checkout Session carrying the app user and plan", async () => {
    const adapter = makeAdapter();
    const create = jest.spyOn(adapter.stripe.checkout.sessions, "create").mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/cs_1",
      expires_at: 1_900_000_000,
    } as never);

    await expect(
      adapter.createCheckoutSession({
        userId: "user_1",
        email: "ada@example.com",
        customerId: "cus_1",
        planId: "pro",
        interval: "month",
        priceId: "price_pro_month",
        successUrl: "https://app.example.com/billing/return?status=success",
        cancelUrl: "https://app.example.com/billing/return?status=cancel",
      }),
    ).resolves.toEqual({
      url: "https://checkout.stripe.com/c/cs_1",
      expiresAt: new Date(1_900_000_000 * 1000).toISOString(),
    });

    expect(create).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_1",
      line_items: [{ price: "price_pro_month", quantity: 1 }],
      success_url: "https://app.example.com/billing/return?status=success",
      cancel_url: "https://app.example.com/billing/return?status=cancel",
      client_reference_id: "user_1",
      subscription_data: { metadata: { appUserId: "user_1", planId: "pro" } },
    });
  });

  it("maps a session without a url or expiry to empty values", async () => {
    const adapter = makeAdapter();
    jest.spyOn(adapter.stripe.checkout.sessions, "create").mockResolvedValue({
      id: "cs_2",
      url: null,
      expires_at: null,
    } as never);

    await expect(
      adapter.createCheckoutSession({
        userId: "user_1",
        email: null,
        customerId: "cus_1",
        planId: "pro",
        interval: "year",
        priceId: "price_pro_year",
        successUrl: "https://app.example.com/s",
        cancelUrl: "https://app.example.com/c",
      }),
    ).resolves.toEqual({ url: "", expiresAt: null });
  });

  it("creates a Billing Portal session with the return URL", async () => {
    const adapter = makeAdapter();
    const create = jest.spyOn(adapter.stripe.billingPortal.sessions, "create").mockResolvedValue({
      id: "bps_1",
      url: "https://billing.stripe.com/p/session/bps_1",
    } as never);

    await expect(
      adapter.createPortalSession({ customerId: "cus_1", returnUrl: "https://app.example.com/billing/return?status=portal" }),
    ).resolves.toEqual({ url: "https://billing.stripe.com/p/session/bps_1" });
    expect(create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app.example.com/billing/return?status=portal",
    });
  });
});

describe("createStripeAdapter webhookVerifier", () => {
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_1", status: "active" } },
  });

  it("verifies a genuine signature and returns the event's id, type, and data", () => {
    const adapter = makeAdapter();
    const signature = adapter.stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    expect(adapter.webhookVerifier.verify(payload, signature)).toEqual({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active" } },
    });
  });

  it("rejects a tampered body, a foreign secret, and a stale timestamp", () => {
    const adapter = makeAdapter();
    const signature = adapter.stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    expect(() => adapter.webhookVerifier.verify(payload.replace("active", "canceled"), signature)).toThrow();

    const foreign = adapter.stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    expect(() => adapter.webhookVerifier.verify(payload, foreign)).toThrow();

    const stale = adapter.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3_600,
    });
    expect(() => adapter.webhookVerifier.verify(payload, stale)).toThrow(/tolerance/i);
  });
});
