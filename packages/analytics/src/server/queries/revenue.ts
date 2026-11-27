/**
 * Revenue ledger fetchers. Every query keeps production rows only and drops
 * excluded users' rows (`not exists`, so rows without a user stay).
 */

import { TRIAL_FALLBACK_WINDOW_DAYS, type CountByKey, type LedgerRow, type RevenueTotalsRow } from "../../metrics";
import type { Names } from "../schema";
import type { SqlClient } from "../sql";
import { QueryParams, RANGE_START, countedRevenue, inRange, isoInstant, toNumber, type QueryScope } from "./context";

/**
 * Every row (no upper time bound, so conversions after the range end are
 * seen) of each subscription that could be trialing or paying at the range
 * start or later: one with a row whose `coalesce(period_end, occurred_at)` is
 * within `TRIAL_FALLBACK_WINDOW_DAYS` before the range start or after it. That
 * bound covers a paid period still in its grace and a trial with no period
 * end. Also the range's `trial_started` rows that have no subscription id.
 */
export async function fetchLedgerForReplay(sql: SqlClient, names: Names, scope: QueryScope): Promise<LedgerRow[]> {
  const params = new QueryParams(scope);
  const lookback = params.add(TRIAL_FALLBACK_WINDOW_DAYS);
  return sql.query<LedgerRow>(
    `with subs as (
      select distinct r.provider_subscription_id
      from ${names.t.revenueEvents} r
      where ${countedRevenue(names)} and r.provider_subscription_id is not null
        and coalesce(r.period_end, r.occurred_at) > ${RANGE_START} - make_interval(days => ${lookback}::int)
    )
    select r.provider_subscription_id, r.user_id, r.event_type,
      ${isoInstant("r.occurred_at")} as occurred_at,
      ${isoInstant("r.period_start")} as period_start,
      ${isoInstant("r.period_end")} as period_end,
      r.amount_cents
    from ${names.t.revenueEvents} r
    where ${countedRevenue(names)}
      and (
        r.provider_subscription_id in (select provider_subscription_id from subs)
        or (r.provider_subscription_id is null and r.event_type = 'trial_started' and ${inRange("r.occurred_at")})
      )
    order by r.provider_subscription_id, r.occurred_at`,
    params.values,
  );
}

/** Rows in the range by type and currency: counts, positive sum, and negative sum as a positive number. */
export async function fetchRevenueTotals(sql: SqlClient, names: Names, scope: QueryScope): Promise<RevenueTotalsRow[]> {
  const params = new QueryParams(scope);
  const rows = await sql.query<{ event_type: string; currency: string | null; events: number; gross_cents: string; refunds_cents: string }>(
    `select r.event_type, lower(r.currency) as currency, count(*)::int as events,
      coalesce(sum(r.amount_cents) filter (where r.amount_cents > 0), 0)::bigint as gross_cents,
      coalesce(-sum(r.amount_cents) filter (where r.amount_cents < 0), 0)::bigint as refunds_cents
    from ${names.t.revenueEvents} r
    where ${countedRevenue(names)} and ${inRange("r.occurred_at")}
    group by 1, 2`,
    params.values,
  );
  return rows.map((row) => ({ ...row, gross_cents: toNumber(row.gross_cents), refunds_cents: toNumber(row.refunds_cents) }));
}

/** `cancel_scheduled` rows in the range by `cancel_reason` ("unknown" when null). */
export async function fetchCancellationReasons(sql: SqlClient, names: Names, scope: QueryScope): Promise<CountByKey[]> {
  const params = new QueryParams(scope);
  return sql.query<CountByKey>(
    `select coalesce(r.cancel_reason, 'unknown') as key, count(*)::int as count
    from ${names.t.revenueEvents} r
    where ${countedRevenue(names)} and r.event_type = 'cancel_scheduled' and ${inRange("r.occurred_at")}
    group by 1`,
    params.values,
  );
}
