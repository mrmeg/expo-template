/**
 * What every fetcher and report takes, and the SQL fragments they share.
 *
 * Parameter layout every scoped query starts with, so the fragments below can
 * refer to fixed positions:
 * - `$1` app id
 * - `$2` IANA zone (always cast `::text`)
 * - `$3` first day of the range (always cast `::date`)
 * - `$4` the day after the range's last day (always cast `::date`)
 * Later parameters are added with `QueryParams.add`, which returns the
 * placeholder. Table names are only ever interpolated from `Names`.
 */

import { addDays, type DateRange, type MetricsConfig } from "../../metrics";
import type { Names } from "../schema";
import type { SqlClient, SqlParam } from "../sql";

export interface MetricsDeps {
  sql: SqlClient;
  names: Names;
  appId: string;
  config: MetricsConfig;
  /** The report's "now": windows still open at this instant are pending. */
  now: Date;
}

/** Thrown for a range or parameter a report cannot serve; an HTTP layer maps it to 400. */
export class MetricsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricsInputError";
  }
}

/** The app, zone and inclusive day range a scoped query covers. */
export interface QueryScope {
  appId: string;
  timezone: string;
  range: DateRange;
}

export class QueryParams {
  readonly values: SqlParam[];

  constructor(scope: QueryScope) {
    this.values = [scope.appId, scope.timezone, scope.range.from, addDays(scope.range.to, 1)];
  }

  /** Appends a parameter and returns its placeholder. */
  add(value: SqlParam): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/** The instant the range's first day begins in the zone. */
export const RANGE_START = "($3::date::timestamp at time zone $2::text)";
/** The instant after the range's last day ends in the zone. */
export const RANGE_END = "($4::date::timestamp at time zone $2::text)";

/** `column` falls inside the range. Sargable: both bounds are constants. */
export function inRange(column: string): string {
  return `${column} >= ${RANGE_START} and ${column} < ${RANGE_END}`;
}

/** Calendar day of `column` in the zone, as `YYYY-MM-DD`. */
export function dayOf(column: string): string {
  return `to_char((${column} at time zone $2::text)::date, 'YYYY-MM-DD')`;
}

/** The instant midnight of a date parameter falls on in the zone. */
export function dayStart(placeholder: string): string {
  return `(${placeholder}::date::timestamp at time zone $2::text)`;
}

/** An instant as ISO 8601 UTC with microseconds, so it round-trips exactly through `::timestamptz`. */
export function isoInstant(column: string): string {
  return `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/**
 * `days` elapsed days as a fixed-length interval (`days * 86400` seconds).
 * Adding `make_interval(days => n)` to a `timestamptz` instead counts calendar
 * days in the connection's `TimeZone`, so the same data would give different
 * answers on differently configured connections.
 */
export function elapsedDays(placeholder: string): string {
  return `(${placeholder}::int * interval '86400 seconds')`;
}

/**
 * Activity filter on `e`: the configured `activeEvents` (any platform), or by
 * default every event except `$session_end` and except events whose platform
 * is `server` (what the host records with `track()`, such as a renewal webhook,
 * says nothing about the user opening the app).
 */
export function activeEventsFilter(
  params: QueryParams,
  activeEvents: readonly string[] | null,
  inactive: { events: readonly string[]; platforms: readonly string[] },
): string {
  if (activeEvents) return `e.name in (select jsonb_array_elements_text(${params.add(JSON.stringify(activeEvents))}::text::jsonb))`;
  const names = params.add(JSON.stringify(inactive.events));
  const platforms = params.add(JSON.stringify(inactive.platforms));
  return `e.name not in (select jsonb_array_elements_text(${names}::text::jsonb))
    and (e.platform is null or e.platform not in (select jsonb_array_elements_text(${platforms}::text::jsonb)))`;
}

/** Leaves out rows whose user (`expression`) is excluded. `not exists`, so a null user passes. */
export function notExcluded(names: Names, expression: string): string {
  return `not exists (select 1 from ${names.t.users} x where x.app_id = $1 and x.user_id = ${expression} and x.excluded)`;
}

/**
 * CTEs `win`, `stitch` and `scoped` over the events matching `where` (alias
 * `e`, with `e.app_id = $1` already applied).
 *
 * Stitching: an `anonymous_id` that appears on any event together with a
 * `user_id` belongs to that user, the one on the earliest such event if
 * several. Only anonymous ids that occur unsigned in the window are looked up.
 * `scoped` adds `person_id` (`coalesce(user_id, stitched user)`) and `actor`
 * (`coalesce(user_id, stitched user, anonymous_id)`), and drops events whose
 * person is excluded.
 */
export function scopedEvents(names: Names, where: string): string {
  return `win as (
    select e.id, e.name, e.occurred_at, e.user_id, e.anonymous_id, e.platform, e.path
    from ${names.t.events} e where e.app_id = $1 and ${where}
  ),
  stitch as (
    select distinct on (s.anonymous_id) s.anonymous_id, s.user_id
    from ${names.t.events} s
    where s.app_id = $1 and s.user_id is not null
      and s.anonymous_id in (select w.anonymous_id from win w where w.user_id is null and w.anonymous_id is not null)
    order by s.anonymous_id, s.occurred_at, s.id
  ),
  scoped as (
    select w.*, coalesce(w.user_id, st.user_id) as person_id, coalesce(w.user_id, st.user_id, w.anonymous_id) as actor
    from win w
    left join stitch st on w.user_id is null and st.anonymous_id = w.anonymous_id
    where ${notExcluded(names, "coalesce(w.user_id, st.user_id)")}
  )`;
}

/**
 * CTE `web_sessions`: web sessions started in the range, minus those whose
 * user (directly or by the same stitching rule as events) is excluded.
 */
export function webSessions(names: Names): string {
  return `swin as (
    select s.* from ${names.t.sessions} s
    where s.app_id = $1 and s.platform = 'web' and ${inRange("s.started_at")}
  ),
  sstitch as (
    select distinct on (e.anonymous_id) e.anonymous_id, e.user_id
    from ${names.t.events} e
    where e.app_id = $1 and e.user_id is not null
      and e.anonymous_id in (select w.anonymous_id from swin w where w.user_id is null and w.anonymous_id is not null)
    order by e.anonymous_id, e.occurred_at, e.id
  ),
  web_sessions as (
    select w.* from swin w
    left join sstitch st on w.user_id is null and st.anonymous_id = w.anonymous_id
    where ${notExcluded(names, "coalesce(w.user_id, st.user_id)")}
  )`;
}

/** Revenue rows that count: production, and not an excluded user's. Alias `r`. */
export function countedRevenue(names: Names): string {
  return `r.app_id = $1 and r.environment = 'production' and ${notExcluded(names, "r.user_id")}`;
}

/** `sum(...)::bigint` and other numeric columns arrive as strings from both drivers. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}
