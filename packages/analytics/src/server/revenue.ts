/**
 * Revenue ledger writes. The input is camelCase and loose enough that a
 * `@mrmeg/expo-purchases` `LedgerRow` is assignable to it, without this
 * package depending on that one; any other provider maps onto the same shape.
 * A `LedgerRow` carries no paid period, though, and a paid row without
 * `periodEnd` counts as a one-time purchase: add `periodStart` and
 * `periodEnd` from the webhook event or the subscription never reaches MRR.
 * Idempotent on `(app_id, provider, provider_event_id, event_type)`, so a
 * redelivered webhook writes nothing.
 *
 * The vocabulary columns are normalized on write (trimmed, lowercased), and
 * `eventType` and `environment` must be known values: every metric matches
 * them exactly, so a row spelled `"Purchased"` or `"PRODUCTION"` would count
 * in some figures and vanish from others. A bad row throws before anything is
 * written, so a mapping mistake is loud instead of silently wrong.
 */
import { REVENUE_EVENT_TYPES, type RevenueEventType } from "../metrics/types";
import type { StoreContext } from "./config";
import { cleanText, isPlainObject, jsonParam, toDate } from "./util";

/** The twelve ledger event types the metrics understand (shared with `./metrics`). */
export { REVENUE_EVENT_TYPES, type RevenueEventType };

export const REVENUE_ENVIRONMENTS = ["production", "sandbox"] as const;
export type RevenueEnvironment = (typeof REVENUE_ENVIRONMENTS)[number];

const EVENT_TYPES: ReadonlySet<string> = new Set(REVENUE_EVENT_TYPES);
const ENVIRONMENTS: ReadonlySet<string> = new Set(REVENUE_ENVIRONMENTS);
/** The column is `integer`; a value outside it would fail the whole insert with a driver error. */
const INT32_MAX = 2_147_483_647;

export interface RevenueEventInput {
  userId: string | null;
  provider: string;
  /** One of `REVENUE_EVENT_TYPES` (case-insensitive); anything else throws. */
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
  /** `production` or `sandbox` (case-insensitive); default `production`; anything else throws. */
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

/** `row` names the row in errors, e.g. `row 3 (providerEventId "evt_1")`. */
function timestamp(value: number | Date | null | undefined, field: string, row: string): string | null {
  if (value === null || value === undefined) return null;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) throw new Error(`expo-analytics: revenue ${row}: ${field} is not a valid time`);
  return date.toISOString();
}

function integer(value: number | null | undefined, field: string, row: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > INT32_MAX) {
    throw new Error(`expo-analytics: revenue ${row}: ${field} must be a finite integer (got ${String(value)})`);
  }
  return value;
}

function lower(value: string | null): string | null {
  return value === null ? null : value.toLowerCase();
}

/** Validates every row before writing any, so a bad row fails the call instead of half of it. */
function toRecord(row: RevenueEventInput, index: number) {
  const providerEventId = required(row.providerEventId, "providerEventId", index);
  const where = `row ${index} (providerEventId "${providerEventId}")`;
  const describe = (field: string, value: unknown) => `expo-analytics: revenue ${where}: ${field} ${JSON.stringify(value)}`;

  const eventType = lower(optionalText(row.eventType));
  if (eventType === null || !EVENT_TYPES.has(eventType)) {
    throw new Error(`${describe("eventType", row.eventType ?? null)} is not one of ${REVENUE_EVENT_TYPES.join(", ")}`);
  }
  const environment = lower(optionalText(row.environment)) ?? "production";
  if (!ENVIRONMENTS.has(environment)) {
    throw new Error(`${describe("environment", row.environment)} is not one of ${REVENUE_ENVIRONMENTS.join(", ")}`);
  }

  return {
    user_id: optionalText(row.userId),
    provider: required(row.provider, "provider", index).toLowerCase(),
    event_type: eventType,
    provider_event_id: providerEventId,
    provider_event_type: optionalText(row.providerEventType),
    provider_subscription_id: optionalText(row.providerSubscriptionId),
    product_id: optionalText(row.productId),
    store: lower(optionalText(row.store)),
    period_type: lower(optionalText(row.periodType)),
    period_start: timestamp(row.periodStart, "periodStart", where),
    period_end: timestamp(row.periodEnd, "periodEnd", where),
    amount_cents: integer(row.amountCents, "amountCents", where),
    currency: lower(optionalText(row.currency)),
    renewal_number: integer(row.renewalNumber, "renewalNumber", where),
    cancel_reason: optionalText(row.cancelReason),
    environment,
    occurred_at: timestamp(row.occurredAt, "occurredAt", where) ?? required(null, "occurredAt", index),
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
