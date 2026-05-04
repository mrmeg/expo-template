/**
 * Billing domain types shared between client and server.
 *
 * The template's default billing architecture is documented in
 * `Agent/Docs/BILLING.md` (hosted-external mode: Stripe Checkout +
 * Billing Portal, webhook-authoritative server state). These types
 * define the single normalized contract the client consumes — raw
 * Stripe objects do not cross this boundary.
 */

export type BillingStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type BillingInterval = "month" | "year";

/**
 * Normalized, app-facing subscription summary.
 *
 * Keyed to the authenticated app user (Cognito `sub`), not email.
 * The client reads this shape from `GET /api/billing/summary`.
 */
export interface BillingSummary {
  /** Stripe customer id for the app user, or null if no customer exists yet. */
  customerId: string | null;
  /** Stable plan identifier from the app's plan catalog (e.g. `free`, `pro`). */
  planId: string;
  /** Human-readable label for the plan, safe to render in UI. */
  planLabel: string;
  /** Normalized lifecycle state. */
  status: BillingStatus;
  /** Billing interval when subscribed; null on `free`. */
  interval: BillingInterval | null;
  /** ISO 8601 timestamp of the current period end; null on `free`. */
  currentPeriodEnd: string | null;
  /** True when Stripe has scheduled cancellation at period end. */
  cancelAtPeriodEnd: boolean;
  /** Feature keys the plan entitles the user to (e.g. `["media.upload", "export.csv"]`). */
  features: string[];
  /** ISO 8601 timestamp of when the summary was last materialized server-side. */
  sourceUpdatedAt: string;
}

/**
 * Plan catalog entry. Plans live in code (or Stripe price metadata),
 * never in UI string constants.
 */
export interface PlanDefinition {
  id: string;
  label: string;
  /** Stripe price id for monthly billing. `null` for the `free` plan. */
  stripePriceIdMonth: string | null;
  /** Stripe price id for yearly billing. `null` for the `free` plan. */
  stripePriceIdYear: string | null;
  features: string[];
}

/**
 * The canonical id of the default "no paid subscription" plan.
 * Every app user who has no active subscription resolves to this plan.
 */
export const FREE_PLAN_ID = "free";

/**
 * Default plan catalog. Concrete apps are expected to replace this at
 * the server boundary (e.g. by loading from Stripe product metadata or
 * a config file). The shape is the contract; the contents are a
 * template default.
 */
export const DEFAULT_PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    id: FREE_PLAN_ID,
    label: "Free",
    stripePriceIdMonth: null,
    stripePriceIdYear: null,
    features: [],
  },
];

/**
 * Returns the canonical `free` summary for a user with no Stripe
 * customer record. Servers should use this as the default response
 * from `/api/billing/summary` when no subscription exists.
 */
export function freeBillingSummary(
  options: { customerId?: string | null; sourceUpdatedAt?: string } = {},
): BillingSummary {
  return {
    customerId: options.customerId ?? null,
    planId: FREE_PLAN_ID,
    planLabel: "Free",
    status: "free",
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    features: [],
    sourceUpdatedAt: options.sourceUpdatedAt ?? new Date().toISOString(),
  };
}

/**
 * A subscription is *entitled* (the user can access paid features) when
 * its status is active, in a trial, or inside the past-due grace window.
 *
 * Feature gates must call this helper rather than inspecting
 * `summary.status` directly, so entitlement policy lives in one place.
 */
export function isEntitled(summary: Pick<BillingSummary, "status">): boolean {
  return (
    summary.status === "trialing" ||
    summary.status === "active" ||
    summary.status === "past_due"
  );
}

/**
 * Minimal shape of a Stripe `Subscription` object we consume when
 * building a `BillingSummary`. Servers pass the real Stripe object;
 * tests pass a fixture. This keeps `normalizeStripeSubscription` free of
 * a hard dependency on the Stripe SDK types.
 */
export interface StripeSubscriptionLike {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  items: {
    data: Array<{
      price: {
        id: string;
        recurring?: { interval?: string | null } | null;
      };
    }>;
  };
  customer: string | { id: string };
}

/**
 * Normalize a Stripe subscription into a `BillingSummary` using the
 * provided plan catalog. Unknown price ids resolve to the `free` plan
 * with the incoming subscription status preserved, so operators can
 * diagnose misconfigured catalogs without the app crashing.
 */
export function normalizeStripeSubscription(
  subscription: StripeSubscriptionLike,
  catalog: readonly PlanDefinition[] = DEFAULT_PLAN_CATALOG,
  now: () => Date = () => new Date(),
): BillingSummary {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = priceId
    ? catalog.find(
      (p) =>
        p.stripePriceIdMonth === priceId || p.stripePriceIdYear === priceId,
    )
    : undefined;

  const interval = (() => {
    const raw = subscription.items.data[0]?.price.recurring?.interval;
    if (raw === "month" || raw === "year") return raw;
    return null;
  })();

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  return {
    customerId,
    planId: plan?.id ?? FREE_PLAN_ID,
    planLabel: plan?.label ?? "Free",
    status: toBillingStatus(subscription.status),
    interval,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    features: plan?.features ?? [],
    sourceUpdatedAt: now().toISOString(),
  };
}

function toBillingStatus(raw: string): BillingStatus {
  switch (raw) {
  case "trialing":
  case "active":
  case "past_due":
  case "canceled":
  case "incomplete":
    return raw;
  case "incomplete_expired":
  case "unpaid":
    return "canceled";
  case "paused":
    return "past_due";
  default:
    return "free";
  }
}
