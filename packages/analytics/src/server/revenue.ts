/**
 * Revenue ledger writes. The input is camelCase and loose enough that a
 * `@mrmeg/expo-purchases` `LedgerRow` is assignable to it as is, without this
 * package depending on that one; any other provider maps onto the same shape.
 * Idempotent on `(app_id, provider, provider_event_id, event_type)`, so a
 * redelivered webhook writes nothing.
 */
import type { StoreContext } from "./config";
import { cleanText, isPlainObject, jsonParam, toDate } from "./util";

export interface RevenueEventInput {
  userId: string | null;
  provider: string;
  /** Normalized type: `purchased`, `renewed`, `refunded`, `trial_started`, ... */
  eventType: string;
  providerEventId: string;
  providerEventType?: string | null;
  providerSubscriptionId?: string | null;
  productId?: string | null;
  store?: string | null;
  periodType?: string | null;
  periodStart?: number | Date | null;
  periodEnd?: number | Date | null;
  /** Positive when paid, negative on refunds, 0 on trial starts, null on state-only rows. */
  amountCents?: number | null;
  currency?: string | null;
  renewalNumber?: number | null;
  cancelReason?: string | null;
  /** Default `production`. */
  environment?: string | null;
  occurredAt: number | Date;
  payload?: Record<string, unknown> | null;
}

const TEXT_MAX_LENGTH = 256;

function required(value: unknown, field: string, index: number): string {
  const text = cleanText(value, TEXT_MAX_LENGTH);
  if (text === null) throw new Error(`expo-analytics: revenue row ${index}: ${field} is required`);
  return text;
}

function optionalText(value: unknown): string | null {
  return cleanText(value, TEXT_MAX_LENGTH);
}

function timestamp(value: number | Date | null | undefined, field: string, index: number): string | null {
  if (value === null || value === undefined) return null;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) throw new Error(`expo-analytics: revenue row ${index}: ${field} is not a valid time`);
  return date.toISOString();
}

function integer(value: number | null | undefined, field: string, index: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) throw new Error(`expo-analytics: revenue row ${index}: ${field} must be an integer`);
  return value;
}

/** Validates every row before writing any, so a bad row fails the call instead of half of it. */
function toRecord(row: RevenueEventInput, index: number) {
  return {
    user_id: optionalText(row.userId),
    provider: required(row.provider, "provider", index),
    event_type: required(row.eventType, "eventType", index),
    provider_event_id: required(row.providerEventId, "providerEventId", index),
    provider_event_type: optionalText(row.providerEventType),
    provider_subscription_id: optionalText(row.providerSubscriptionId),
    product_id: optionalText(row.productId),
    store: optionalText(row.store),
    period_type: optionalText(row.periodType),
    period_start: timestamp(row.periodStart, "periodStart", index),
    period_end: timestamp(row.periodEnd, "periodEnd", index),
    amount_cents: integer(row.amountCents, "amountCents", index),
    currency: optionalText(row.currency)?.toLowerCase() ?? null,
    renewal_number: integer(row.renewalNumber, "renewalNumber", index),
    cancel_reason: optionalText(row.cancelReason),
    environment: optionalText(row.environment) ?? "production",
    occurred_at: timestamp(row.occurredAt, "occurredAt", index) ?? required(null, "occurredAt", index),
    payload: isPlainObject(row.payload) ? row.payload : null,
  };
}

/** Inserts the rows not already recorded and returns how many were new. */
export async function recordRevenueEvents(ctx: StoreContext, rows: readonly RevenueEventInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const records = rows.map(toRecord);
  const inserted = await ctx.sql.query<{ id: string }>(
    `insert into ${ctx.names.t.revenueEvents} (
       app_id, user_id, provider, event_type, provider_event_id, provider_event_type, provider_subscription_id,
       product_id, store, period_type, period_start, period_end, amount_cents, currency, renewal_number,
       cancel_reason, environment, occurred_at, payload
     )
     select $1, r.user_id, r.provider, r.event_type, r.provider_event_id, r.provider_event_type, r.provider_subscription_id,
       r.product_id, r.store, r.period_type, r.period_start, r.period_end, r.amount_cents, r.currency, r.renewal_number,
       r.cancel_reason, r.environment, r.occurred_at, r.payload
     from jsonb_to_recordset($2::text::jsonb) as r(
       user_id text, provider text, event_type text, provider_event_id text, provider_event_type text,
       provider_subscription_id text, product_id text, store text, period_type text, period_start timestamptz,
       period_end timestamptz, amount_cents integer, currency text, renewal_number integer, cancel_reason text,
       environment text, occurred_at timestamptz, payload jsonb
     )
     on conflict (app_id, provider, provider_event_id, event_type) do nothing
     returning id::text as id`,
    [ctx.appId, jsonParam(records)],
  );
  return inserted.length;
}
