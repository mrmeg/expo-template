/**
 * Pure helpers for a RevenueCat webhook receiver: request authorization, payload
 * parsing, and an entitlement reducer. No React, React Native, Node, or SDK
 * imports, so the same code runs in Expo API routes, Express, Convex HTTP
 * actions, Cloudflare Workers, and Jest. Lifted from Mindmap
 * `convex/revenuecatEvents.ts` with the entitlement id made a parameter and the
 * event widened to the fields NeuroSpicy's processor reads.
 *
 * Webhook reference: https://www.revenuecat.com/docs/integrations/webhooks
 */
import { LIFETIME_UNTIL } from "../constants";
import { isRefundCancellation } from "./ledger";

/** Event types that grant or extend access until `expiration_at_ms`. */
export const GRANT_EVENT_TYPES: ReadonlySet<string> = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  // App Store undoing a refund: the customer keeps the purchase and
  // `expiration_at_ms` carries the restored term end.
  "REFUND_REVERSED",
]);

/** Event types that end access. There is no REFUND type: a refund is a CANCELLATION (see `isRefundCancellation`). */
export const REVOKE_EVENT_TYPES: ReadonlySet<string> = new Set(["EXPIRATION"]);

/** CamelCase view of the webhook `event` object. Unset fields are null, arrays empty. */
export interface RevenueCatWebhookEvent {
  id: string;
  type: string;
  /** Empty only for TRANSFER events. */
  appUserId: string;
  originalAppUserId: string | null;
  aliases: string[];
  productId: string | null;
  /** On PRODUCT_CHANGE: the product the customer moved to. */
  newProductId: string | null;
  entitlementIds: string[];
  /** NORMAL, TRIAL, INTRO, PROMOTIONAL. */
  periodType: string | null;
  purchasedAtMs: number | null;
  expirationAtMs: number | null;
  /** On BILLING_ISSUE: when the store's grace period ends. */
  gracePeriodExpirationAtMs: number | null;
  eventTimestampMs: number;
  /** SANDBOX or PRODUCTION. */
  environment: string | null;
  /** APP_STORE, PLAY_STORE, STRIPE, … */
  store: string | null;
  originalTransactionId: string | null;
  /** On CANCELLATION: UNSUBSCRIBE, BILLING_ERROR, CUSTOMER_SUPPORT, … */
  cancelReason: string | null;
  /** On EXPIRATION: UNSUBSCRIBE, BILLING_ERROR, CUSTOMER_SUPPORT, … */
  expirationReason: string | null;
  /** Gross price in USD (RevenueCat converts); 0 for trials. */
  price: number | null;
  priceInPurchasedCurrency: number | null;
  currency: string | null;
  /** 1 for the first paid period, incremented per renewal. */
  renewalNumber: number | null;
  /** True on the RENEWAL that converts a trial to paid. */
  isTrialConversion: boolean | null;
  countryCode: string | null;
  offerCode: string | null;
  transferredFrom: string[];
  transferredTo: string[];
  /** The event object as received, minus `subscriber_attributes`. */
  raw: Record<string, unknown>;
}

export interface EntitlementRecord {
  /**
   * Access until this ms timestamp; null = no access recorded. A grant with no
   * expiration stores `LIFETIME_UNTIL` so it is never mistaken for "nothing".
   */
  until: number | null;
  productId: string | null;
  /** `event_timestamp_ms` of the last applied event, for out-of-order protection. */
  updatedAt: number | null;
}

export type EntitlementReduction =
  | { action: "skip"; reason: "not-entitlement" | "stale" | "no-op" | "malformed" }
  | { action: "set"; next: EntitlementRecord };

/**
 * Constant-time comparison of the request's `Authorization` header with the
 * configured secret. Accepts the bare secret or `Bearer <secret>`, which is how
 * the dashboard field is usually filled in.
 */
export function isAuthorizedWebhook(header: string | null | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  return timingSafeEqual(header, secret) || timingSafeEqual(header, `Bearer ${secret}`);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Parse a webhook body. Returns null when the payload is not a RevenueCat event. */
export function parseRevenueCatWebhook(body: unknown): RevenueCatWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const event = (body as { event?: unknown }).event;
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;

  const id = asString(e.id);
  const type = asString(e.type);
  const appUserId = asString(e.app_user_id);
  const eventTimestampMs = asNumber(e.event_timestamp_ms);
  if (!id || !type || !eventTimestampMs) return null;
  if (!appUserId && type !== "TRANSFER") return null;

  const entitlementIds = asStringArray(e.entitlement_ids);
  const legacyEntitlement = asString(e.entitlement_id);
  if (legacyEntitlement && !entitlementIds.includes(legacyEntitlement)) {
    entitlementIds.push(legacyEntitlement);
  }

  const raw: Record<string, unknown> = { ...e };
  delete raw.subscriber_attributes;

  return {
    id,
    type,
    appUserId: appUserId ?? "",
    originalAppUserId: asString(e.original_app_user_id),
    aliases: asStringArray(e.aliases),
    productId: asString(e.product_id),
    newProductId: asString(e.new_product_id),
    entitlementIds,
    periodType: asString(e.period_type),
    purchasedAtMs: asNumber(e.purchased_at_ms),
    expirationAtMs: asNumber(e.expiration_at_ms),
    gracePeriodExpirationAtMs: asNumber(e.grace_period_expiration_at_ms),
    eventTimestampMs,
    environment: asString(e.environment),
    store: asString(e.store),
    originalTransactionId: asString(e.original_transaction_id),
    cancelReason: asString(e.cancel_reason),
    expirationReason: asString(e.expiration_reason),
    price: asNumber(e.price),
    priceInPurchasedCurrency: asNumber(e.price_in_purchased_currency),
    currency: asString(e.currency),
    renewalNumber: asNumber(e.renewal_number),
    isTrialConversion: asBoolean(e.is_trial_conversion),
    countryCode: asString(e.country_code),
    offerCode: asString(e.offer_code),
    transferredFrom: asStringArray(e.transferred_from),
    transferredTo: asStringArray(e.transferred_to),
    raw,
  };
}

/**
 * Decide how an event changes a user's stored entitlement.
 *
 * Webhook events are per product, while the record is per entitlement, so the
 * reducer never lets one product's event shorten access another product
 * granted:
 * - Grants set `until` to the later of the current value and the event's
 *   expiration. Only a NON_RENEWING_PURCHASE may lack one (a lifetime product:
 *   `LIFETIME_UNTIL`); any other grant without `expiration_at_ms` is malformed
 *   and skipped rather than turned into permanent access. Because the rule is
 *   monotonic, a grant delivered late (older than the last applied event) is
 *   still applied; only revocations honour the out-of-order guard. A grant
 *   skipped for a missing expiration is reported as `malformed`, distinct from
 *   the `no-op` of an intentionally ignored event, so consumers can alert on it.
 * - EXPIRATION sets `until` to the event's expiration (falling back to the event
 *   time) unless the current record already runs longer, in which case it stays
 *   — except when `expiration_reason` is `CUSTOMER_SUPPORT` or
 *   `DEVELOPER_INITIATED`: those are deliberate early revocations and always cut.
 * - A refund CANCELLATION (`isRefundCancellation`) moves `until` back to the
 *   event's expiration (the event time for a refunded one-time purchase)
 *   unconditionally: the store has already revoked access, and a refund is the
 *   one case where the record is cut even if another product on the same
 *   entitlement ran longer — key records per product if you sell overlapping
 *   products on one entitlement.
 * - Other CANCELLATION / BILLING_ISSUE / SUBSCRIPTION_PAUSED / TEST leave access
 *   in place until the following EXPIRATION arrives.
 * - TRANSFER carries no entitlement ids and is skipped here; revoke the losing
 *   side with `revokedByTransfer` instead.
 * - Revocations older than the last applied event are ignored (webhook retries
 *   can arrive out of order); an equal timestamp is applied (idempotent retry).
 */
export function reduceEntitlement(
  current: EntitlementRecord,
  event: RevenueCatWebhookEvent,
  options: { entitlement: string },
): EntitlementReduction {
  if (!event.entitlementIds.includes(options.entitlement)) {
    return { action: "skip", reason: "not-entitlement" };
  }
  const stale = current.updatedAt !== null && event.eventTimestampMs < current.updatedAt;

  if (GRANT_EVENT_TYPES.has(event.type)) {
    if (event.expirationAtMs === null && event.type !== "NON_RENEWING_PURCHASE") {
      return { action: "skip", reason: "malformed" };
    }
    const granted = event.expirationAtMs ?? LIFETIME_UNTIL;
    const until = current.until !== null && current.until > granted ? current.until : granted;
    const eventProductId = event.newProductId ?? event.productId;
    return {
      action: "set",
      next: {
        until,
        // A late grant never overwrites the product the newer event recorded.
        productId: stale ? current.productId ?? eventProductId : eventProductId ?? current.productId,
        updatedAt: Math.max(current.updatedAt ?? 0, event.eventTimestampMs),
      },
    };
  }

  if (stale) return { action: "skip", reason: "stale" };

  const productId = event.productId ?? current.productId;
  const updatedAt = event.eventTimestampMs;

  if (REVOKE_EVENT_TYPES.has(event.type)) {
    const ended = event.expirationAtMs ?? event.eventTimestampMs;
    const forced = event.expirationReason === "CUSTOMER_SUPPORT" || event.expirationReason === "DEVELOPER_INITIATED";
    const preserved = !forced && current.until !== null && current.until > ended;
    return {
      action: "set",
      // When a longer term survives, it still belongs to the product that granted it.
      next: { until: preserved ? current.until : ended, productId: preserved ? current.productId : productId, updatedAt },
    };
  }

  if (isRefundCancellation(event)) {
    return { action: "set", next: { until: event.expirationAtMs ?? event.eventTimestampMs, productId, updatedAt } };
  }

  return { action: "skip", reason: "no-op" };
}

/**
 * TRANSFER moves purchases between app user ids. The losing side is revoked
 * with this record; the receiving side is refreshed by the SDK on device and by
 * the next subscription event RevenueCat emits for it.
 */
export function revokedByTransfer(event: RevenueCatWebhookEvent): EntitlementRecord {
  return { until: event.eventTimestampMs, productId: null, updatedAt: event.eventTimestampMs };
}
