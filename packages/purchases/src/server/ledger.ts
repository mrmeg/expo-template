/**
 * Event → append-only ledger rows, normalized to one vocabulary so a metrics
 * dashboard can count trials, conversions, renewals, churn, refunds, and
 * reactivation without knowing which store the money moved through. Lifted from
 * NeuroSpicy `server/revenueCatEventProcessor.ts` (`buildRcLedgerRows`,
 * `mapRcStatus`, `providerSubscriptionId`) and `server/subscriptionLedger.ts`
 * (`SUBSCRIPTION_EVENT_TYPES`). Pure: the consumer owns idempotency
 * (`provider_event_id` + `event_type` unique), user resolution, and the insert.
 *
 * | RC type          | Rows                                                         |
 * |------------------|--------------------------------------------------------------|
 * | INITIAL_PURCHASE | `trial_started` (TRIAL) else `purchased`; + `reactivated`    |
 * |                  | when `previouslyExpired`                                     |
 * | NON_RENEWING_    | `purchased` (a one-time purchase is revenue too)             |
 * | PURCHASE         |                                                              |
 * | RENEWAL          | `trial_converted` when `isTrialConversion`, else `renewed`   |
 * | CANCELLATION     | `cancel_scheduled`; + `refunded` on the refund heuristic     |
 * | UNCANCELLATION   | `uncanceled`                                                 |
 * | EXPIRATION       | `expired`                                                    |
 * | BILLING_ISSUE    | `billing_issue`                                              |
 * | PRODUCT_CHANGE   | `product_changed`                                            |
 * | REFUND_REVERSED  | `refund_reversed`                                            |
 * | anything else    | none                                                         |
 */
import type { RevenueCatWebhookEvent } from "./webhook";

export const LEDGER_EVENT_TYPES = [
  "trial_started",
  "trial_converted",
  "purchased",
  "renewed",
  "cancel_scheduled",
  "uncanceled",
  "expired",
  "billing_issue",
  "refunded",
  "refund_reversed",
  "product_changed",
  "reactivated",
] as const;

export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

/** Rows that carry money; every other row is state-only with a null amount. */
const MONEY_ROWS: ReadonlySet<LedgerEventType> = new Set<LedgerEventType>([
  "purchased",
  "renewed",
  "trial_converted",
  "refunded",
]);

/** Current-state status derived from one event; the consumer's `subscriptions` row. */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface LedgerRow {
  userId: string;
  provider: "revenuecat";
  eventType: LedgerEventType;
  providerEventId: string;
  providerEventType: string;
  providerSubscriptionId: string;
  productId: string | null;
  /** Lowercased RevenueCat store (`app_store`, `play_store`, …). */
  store: string | null;
  /** Lowercased period type (`normal`, `trial`, `intro`, `promotional`). */
  periodType: string | null;
  /**
   * RevenueCat's USD price rounded to cents on the money rows: positive on
   * `purchased`, `renewed`, `trial_converted`, negative on `refunded`; 0 for
   * `trial_started`; null on state-only rows (`cancel_scheduled`,
   * `reactivated`, …). `SUM(amount)` is therefore net revenue.
   */
  amountCents: number | null;
  currency: "usd";
  renewalNumber: number | null;
  /** Only on CANCELLATION rows. */
  cancelReason: string | null;
  /** `production` or `sandbox`; defaults to production when RevenueCat sends nothing. */
  environment: string;
  /** `event_timestamp_ms`. */
  occurredAt: number;
  /** The event as received, minus subscriber attributes. */
  payload: Record<string, unknown>;
}

export interface BuildLedgerRowsOptions {
  /** The consumer's user id resolved from `appUserId`. */
  userId: string;
  /** The user had lapsed before this purchase (an `expired` row exists), so tag it `reactivated`. */
  previouslyExpired?: boolean;
}

/**
 * True when a CANCELLATION is really a refund: RevenueCat has no REFUND event
 * type and delivers one as CANCELLATION with `cancel_reason: "CUSTOMER_SUPPORT"`
 * and `expiration_at_ms` moved back to the revocation time — or absent, for a
 * refunded one-time (non-renewing) purchase that never had an expiration.
 */
export function isRefundCancellation(event: RevenueCatWebhookEvent): boolean {
  return (
    event.type === "CANCELLATION" &&
    event.cancelReason === "CUSTOMER_SUPPORT" &&
    (event.expirationAtMs === null || event.expirationAtMs <= event.eventTimestampMs)
  );
}

export function toAmountCents(price: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return Math.round(price * 100);
}

/**
 * Stable per-user-per-product identity for the RevenueCat subscription. Prefers
 * RC's `original_transaction_id` (constant across renewals); falls back to a
 * store+product+user composite that is still unique per user.
 */
export function providerSubscriptionId(event: RevenueCatWebhookEvent): string {
  if (event.originalTransactionId) return `rc:${event.originalTransactionId}`;
  return `rc:${event.store ?? "store"}:${event.productId ?? "product"}:${event.appUserId}`;
}

/**
 * Map an event to the consumer's current-state status enum.
 *
 * - INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION / REFUND_REVERSED /
 *   NON_RENEWING_PURCHASE / SUBSCRIPTION_EXTENDED / TEMPORARY_ENTITLEMENT_GRANT
 *   → `trialing` when the period is TRIAL, else `active`.
 * - CANCELLATION → `canceled` (auto-renew off; access continues until the
 *   expiration, which the consumer honours). Refunds ride this path with the
 *   expiration moved back, so access ends immediately.
 * - EXPIRATION → `canceled` with the (now past) expiration.
 * - BILLING_ISSUE → `past_due` (grace window applies).
 * - Unknown → `canceled` (fail closed).
 */
export function deriveSubscriptionStatus(event: RevenueCatWebhookEvent): SubscriptionStatus {
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "REFUND_REVERSED":
    case "NON_RENEWING_PURCHASE":
    case "SUBSCRIPTION_EXTENDED":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return event.periodType === "TRIAL" ? "trialing" : "active";
    case "BILLING_ISSUE":
      return "past_due";
    case "CANCELLATION":
    case "EXPIRATION":
      return "canceled";
    default:
      return "canceled";
  }
}

/** Map one event to zero or more normalized ledger rows. */
export function buildLedgerRows(event: RevenueCatWebhookEvent, options: BuildLedgerRowsOptions): LedgerRow[] {
  const types: LedgerEventType[] = [];
  switch (event.type) {
    case "INITIAL_PURCHASE":
      types.push(event.periodType === "TRIAL" ? "trial_started" : "purchased");
      if (options.previouslyExpired) types.push("reactivated");
      break;
    case "NON_RENEWING_PURCHASE":
      types.push("purchased");
      break;
    case "RENEWAL":
      types.push(event.isTrialConversion === true ? "trial_converted" : "renewed");
      break;
    case "CANCELLATION":
      types.push("cancel_scheduled");
      if (isRefundCancellation(event)) types.push("refunded");
      break;
    case "UNCANCELLATION":
      types.push("uncanceled");
      break;
    case "EXPIRATION":
      types.push("expired");
      break;
    case "BILLING_ISSUE":
      types.push("billing_issue");
      break;
    case "PRODUCT_CHANGE":
      types.push("product_changed");
      break;
    case "REFUND_REVERSED":
      types.push("refund_reversed");
      break;
    default:
      return [];
  }

  const amountCents = toAmountCents(event.price);
  const amountFor = (eventType: LedgerEventType): number | null => {
    if (eventType === "trial_started") return 0;
    if (eventType === "refunded") return amountCents === null ? null : -Math.abs(amountCents);
    return MONEY_ROWS.has(eventType) ? amountCents : null;
  };

  return types.map((eventType) => ({
    userId: options.userId,
    provider: "revenuecat" as const,
    eventType,
    providerEventId: event.id,
    providerEventType: event.type,
    providerSubscriptionId: providerSubscriptionId(event),
    productId: eventType === "product_changed" ? event.newProductId ?? event.productId : event.productId,
    store: event.store ? event.store.toLowerCase() : null,
    periodType: event.periodType ? event.periodType.toLowerCase() : null,
    amountCents: amountFor(eventType),
    currency: "usd" as const,
    renewalNumber: event.renewalNumber,
    cancelReason: event.type === "CANCELLATION" ? event.cancelReason : null,
    environment: (event.environment ?? "PRODUCTION").toLowerCase(),
    occurredAt: event.eventTimestampMs,
    payload: event.raw,
  }));
}
