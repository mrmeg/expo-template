import {
  DEFAULT_PLAN_CATALOG,
  FREE_PLAN_ID,
  freeBillingSummary,
  isEntitled,
  normalizeStripeSubscription,
  type PlanDefinition,
  type StripeSubscriptionLike,
} from "../billing";

const FIXED_NOW = new Date("2026-04-15T12:00:00.000Z");
const now = () => FIXED_NOW;

const proPlan: PlanDefinition = {
  id: "pro",
  label: "Pro",
  stripePriceIdMonth: "price_pro_month",
  stripePriceIdYear: "price_pro_year",
  features: ["export.csv", "media.upload"],
};

const catalog: PlanDefinition[] = [...DEFAULT_PLAN_CATALOG, proPlan];

const baseSubscription = (overrides: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike => ({
  status: "active",
  cancel_at_period_end: false,
  current_period_end: Math.floor(new Date("2026-05-20T00:00:00.000Z").getTime() / 1000),
  items: {
    data: [
      {
        price: {
          id: "price_pro_month",
          recurring: { interval: "month" },
        },
      },
    ],
  },
  customer: "cus_123",
  ...overrides,
});

describe("freeBillingSummary", () => {
  it("returns a normalized free summary when no options are provided", () => {
    const summary = freeBillingSummary({ sourceUpdatedAt: FIXED_NOW.toISOString() });
    expect(summary).toMatchObject({
      customerId: null,
      planId: FREE_PLAN_ID,
      planLabel: "Free",
      status: "free",
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      features: [],
      sourceUpdatedAt: FIXED_NOW.toISOString(),
    });
  });

  it("preserves a customerId when the user has a Stripe record but no subscription", () => {
    const summary = freeBillingSummary({
      customerId: "cus_abc",
      sourceUpdatedAt: FIXED_NOW.toISOString(),
    });
    expect(summary.customerId).toBe("cus_abc");
    expect(summary.status).toBe("free");
  });
});

describe("isEntitled", () => {
  it.each(["trialing", "active", "past_due"] as const)("entitles %s", (status) => {
    expect(isEntitled({ status })).toBe(true);
  });

  it.each(["free", "canceled", "incomplete"] as const)("does not entitle %s", (status) => {
    expect(isEntitled({ status })).toBe(false);
  });
});

describe("normalizeStripeSubscription", () => {
  it("maps a known Stripe price into its plan, preserving renewal and interval", () => {
    const summary = normalizeStripeSubscription(baseSubscription(), catalog, now);
    expect(summary).toMatchObject({
      customerId: "cus_123",
      planId: "pro",
      planLabel: "Pro",
      status: "active",
      interval: "month",
      cancelAtPeriodEnd: false,
      features: ["export.csv", "media.upload"],
      sourceUpdatedAt: FIXED_NOW.toISOString(),
    });
    expect(summary.currentPeriodEnd).toBe("2026-05-20T00:00:00.000Z");
  });

  it("falls back to the free plan but preserves the subscription status when the price is unknown", () => {
    const summary = normalizeStripeSubscription(
      baseSubscription({
        items: {
          data: [{ price: { id: "price_missing", recurring: { interval: "year" } } }],
        },
      }),
      catalog,
      now,
    );
    expect(summary.planId).toBe(FREE_PLAN_ID);
    expect(summary.status).toBe("active");
    expect(summary.interval).toBe("year");
  });

  it("collapses 'incomplete_expired' and 'unpaid' to 'canceled'", () => {
    expect(
      normalizeStripeSubscription(baseSubscription({ status: "incomplete_expired" }), catalog, now)
        .status,
    ).toBe("canceled");
    expect(
      normalizeStripeSubscription(baseSubscription({ status: "unpaid" }), catalog, now).status,
    ).toBe("canceled");
  });

  it("accepts a customer reference as an object or string", () => {
    const byObject = normalizeStripeSubscription(
      baseSubscription({ customer: { id: "cus_obj" } }),
      catalog,
      now,
    );
    expect(byObject.customerId).toBe("cus_obj");
  });

  it("reports cancelAtPeriodEnd when Stripe flags it", () => {
    const summary = normalizeStripeSubscription(
      baseSubscription({ cancel_at_period_end: true }),
      catalog,
      now,
    );
    expect(summary.cancelAtPeriodEnd).toBe(true);
  });
});
