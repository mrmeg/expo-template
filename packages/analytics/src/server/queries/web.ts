/**
 * Web traffic fetchers. Sessions are maintained at ingest, so totals, the
 * daily series and every breakdown except pages read `sessions` only; pages
 * read `$pageview` events. All are limited to `platform = 'web'` and the
 * population filter.
 */

import {
  BREAKDOWN_LIMIT,
  DIRECT_REFERRER,
  type BreakdownRow,
  type WebDailyPoint,
  type WebTotalsRow,
} from "../../metrics";
import { RESERVED_EVENTS } from "../../shared/wire";
import type { Names } from "../schema";
import type { SqlClient } from "../sql";
import { QueryParams, dayOf, inRange, scopedEvents, toNumber, webSessions, type QueryScope } from "./context";

interface RawTotals {
  date: string | null;
  visitors: number;
  visits: number;
  pageviews: string | number;
  bounces: number;
  avg_visit_seconds: number | null;
}

const TOTALS_COLUMNS = `count(distinct anonymous_id)::int as visitors,
  count(*)::int as visits,
  coalesce(sum(pageviews), 0)::bigint as pageviews,
  count(*) filter (where pageviews <= 1 and custom_events = 0)::int as bounces,
  avg(extract(epoch from (last_seen_at - started_at)))::float8 as avg_visit_seconds`;

function totalsRow(row: RawTotals | undefined): WebTotalsRow | undefined {
  if (!row) return undefined;
  return {
    visitors: row.visitors,
    visits: row.visits,
    pageviews: toNumber(row.pageviews),
    bounces: row.bounces,
    avg_visit_seconds: row.avg_visit_seconds,
  };
}

/** Totals for the range, plus one row per day sessions started on when `daily`. */
export async function fetchWebTotals(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
  options: { daily: boolean },
): Promise<{ totals: WebTotalsRow | undefined; daily: WebDailyPoint[] }> {
  const params = new QueryParams(scope);
  const rows = await sql.query<RawTotals>(
    options.daily
      ? `with ${webSessions(names)}, d as (select ws.*, ${dayOf("ws.started_at")} as day from web_sessions ws)
        select day as date, ${TOTALS_COLUMNS}
        from d
        group by grouping sets ((day), ())`
      : `with ${webSessions(names)}
        select null::text as date, ${TOTALS_COLUMNS}
        from web_sessions`,
    params.values,
  );
  const daily: WebDailyPoint[] = [];
  let totals: RawTotals | undefined;
  for (const row of rows) {
    if (row.date === null) totals = row;
    else daily.push({ date: row.date, visitors: row.visitors, visits: row.visits, pageviews: toNumber(row.pageviews) });
  }
  return { totals: totalsRow(totals), daily };
}

/** Session dimensions, in the order of `grouping sets` below. */
const SESSION_DIMENSIONS: readonly [dimension: string, column: string][] = [
  ["entry_pages", "entry_path"],
  ["exit_pages", "exit_path"],
  ["referrers", "referrer"],
  ["utm_sources", "utm_source"],
  ["utm_campaigns", "utm_campaign"],
  ["devices", "device"],
  ["browsers", "browser"],
  ["os", "os"],
  ["countries", "country"],
];

type RawBreakdown = Omit<BreakdownRow, "pageviews"> & { dimension: string; pageviews: string | number };

/**
 * Top 20 per session dimension by visitors then pageviews, in one pass with
 * grouping sets. A missing referrer is "Direct"; sessions without a UTM tag
 * are left out of the UTM lists.
 */
export async function fetchSessionBreakdowns(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
): Promise<(BreakdownRow & { dimension: string })[]> {
  const params = new QueryParams(scope);
  const direct = params.add(DIRECT_REFERRER);
  const limit = params.add(BREAKDOWN_LIMIT);
  const dimension = `case ${SESSION_DIMENSIONS.map(([name, column]) => `when grouping(${column}) = 0 then '${name}'`).join(" ")} end`;
  const key = `case ${SESSION_DIMENSIONS.map(([, column]) => `when grouping(${column}) = 0 then ${column}`).join(" ")} end`;
  const rows = await sql.query<RawBreakdown>(
    `with ${webSessions(names)},
    b as (select ws.*, coalesce(ws.referrer_host, ${direct}::text) as referrer from web_sessions ws),
    g as (
      select ${dimension} as dimension, ${key} as key,
        count(distinct anonymous_id)::int as visitors,
        coalesce(sum(pageviews), 0)::bigint as pageviews
      from b
      group by grouping sets (${SESSION_DIMENSIONS.map(([, column]) => `(${column})`).join(", ")})
    ),
    ranked as (
      select g.*, row_number() over (partition by dimension order by visitors desc, pageviews desc, key asc nulls last) as rank
      from g
      where not (dimension in ('utm_sources', 'utm_campaigns') and key is null)
    )
    select dimension, key, visitors, pageviews from ranked where rank <= ${limit}::int`,
    params.values,
  );
  return rows.map((row) => ({ ...row, pageviews: toNumber(row.pageviews) }));
}

/** Top 20 paths by visitors then pageviews, from `$pageview` events on the web. */
export async function fetchTopPages(sql: SqlClient, names: Names, scope: QueryScope): Promise<BreakdownRow[]> {
  const params = new QueryParams(scope);
  const pageview = params.add(RESERVED_EVENTS.pageview);
  const limit = params.add(BREAKDOWN_LIMIT);
  const rows = await sql.query<Omit<BreakdownRow, "pageviews"> & { pageviews: string | number }>(
    `with ${scopedEvents(names, `e.name = ${pageview}::text and e.platform = 'web' and ${inRange("e.occurred_at")}`)}
    select path as key, count(distinct anonymous_id)::int as visitors, count(*)::bigint as pageviews
    from scoped
    group by path
    order by visitors desc, pageviews desc, key asc nulls last
    limit ${limit}::int`,
    params.values,
  );
  return rows.map((row) => ({ ...row, pageviews: toNumber(row.pageviews) }));
}
