/**
 * Web traffic, from sessions (and `$pageview` events for the pages list) where
 * `platform = 'web'`.
 *
 * - Visitors: distinct `anonymous_id`. Visits: sessions. Pageviews: the sum of
 *   `sessions.pageviews`. The pages list counts the `$pageview` events of those
 *   same sessions by `path` (including views after midnight in a session that
 *   started in the range), so it reconciles with the totals.
 * - Views per visit: pageviews over visits.
 * - Bounce rate: sessions with `pageviews <= 1` and `custom_events = 0`, over
 *   sessions.
 * - Average visit duration: the mean of `last_seen_at - started_at`.
 * Sessions are placed on the day they started. Breakdowns are the top 20 by
 * visitors, then pageviews; a missing referrer is reported as "Direct", and
 * sessions without a UTM tag are left out of the UTM lists.
 */

import { eachDay } from "./dates";
import { BREAKDOWN_LIMIT, rateCell } from "./definitions";
import type { BreakdownRow, DateRange, WebBreakdown, WebDailyPoint, WebTotals, WebTotalsRow } from "./types";
import { WEB_BREAKDOWNS } from "./types";

export function computeWebTotals(row: WebTotalsRow | undefined): WebTotals {
  const visits = row?.visits ?? 0;
  const pageviews = row?.pageviews ?? 0;
  return {
    visitors: row?.visitors ?? 0,
    visits,
    pageviews,
    views_per_visit: visits > 0 ? pageviews / visits : null,
    bounce_rate: rateCell(row?.bounces ?? 0, visits),
    avg_visit_seconds: visits > 0 ? row?.avg_visit_seconds ?? null : null,
  };
}

/** One point per day of the range, zero where nothing started. */
export function fillWebSeries(rows: WebDailyPoint[], range: DateRange): WebDailyPoint[] {
  const byDay = new Map(rows.map((row) => [row.date, row]));
  return eachDay(range).map((date) => byDay.get(date) ?? { date, visitors: 0, visits: 0, pageviews: 0 });
}

/** Groups breakdown rows by dimension, each sorted and cut to the top 20. */
export function groupBreakdowns(rows: (BreakdownRow & { dimension: string })[]): Record<WebBreakdown, BreakdownRow[]> {
  const grouped = Object.fromEntries(WEB_BREAKDOWNS.map((key) => [key, [] as BreakdownRow[]])) as Record<WebBreakdown, BreakdownRow[]>;
  for (const row of rows) {
    const list = grouped[row.dimension as WebBreakdown];
    if (list) list.push({ key: row.key, visitors: row.visitors, pageviews: row.pageviews });
  }
  for (const key of WEB_BREAKDOWNS) {
    grouped[key] = grouped[key]
      .sort(
        (a, b) =>
          b.visitors - a.visitors ||
          b.pageviews - a.pageviews ||
          (a.key ?? "").localeCompare(b.key ?? ""),
      )
      .slice(0, BREAKDOWN_LIMIT);
  }
  return grouped;
}
