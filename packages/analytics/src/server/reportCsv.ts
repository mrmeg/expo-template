/**
 * Flattens each report into the tables its CSV export offers. Pure.
 *
 * A report can hold several tables; `?table=<name>` picks one and the first
 * listed is the default (the report's main series). The names:
 *
 * - overview: `figures` (metric, current, previous, plus the rate columns for retention)
 * - product: `daily` (active users of both audiences and new users, one row per day)
 * - retention: `weekly` (one row per cohort and week), `daily` (one row per
 *   daily cohort and day N), `headline`
 * - funnels: `steps` (one row per funnel step)
 * - acquisition: `channels`, `platforms`, `link_clicks`
 * - web: `daily`, `totals` (current and previous period), `breakdowns` (every
 *   dimension, long), or one dimension by name (`pages`, `referrers`, ...)
 * - revenue: `summary` (one row per figure), `mrr` (month ends), `event_counts`, `cancellations`
 * - events: one table, the page of raw events
 *
 * Every `RateCell` becomes a rate column and a status column, so a figure whose
 * window is still open (`not_yet`) or has nothing to measure (`empty`) never
 * reads as a blank that could be taken for zero.
 */

import {
  WEB_BREAKDOWNS,
  type AcquisitionReport,
  type EventPage,
  type FunnelReport,
  type OverviewReport,
  type ProductReport,
  type RateCell,
  type RetentionReport,
  type RevenueReport,
  type WebReport,
  type WebTotals,
} from "../metrics";

export interface CsvTable {
  columns: readonly string[];
  rows: Record<string, unknown>[];
}

export interface ReportShapes {
  overview: OverviewReport;
  product: ProductReport;
  retention: RetentionReport;
  funnels: FunnelReport;
  acquisition: AcquisitionReport;
  web: WebReport;
  revenue: RevenueReport;
}

export type ReportName = keyof ReportShapes;

export const REPORT_NAMES: readonly ReportName[] = ["overview", "product", "retention", "funnels", "acquisition", "web", "revenue"];

/** Table names per report; the first is the default. */
export const CSV_TABLES: { readonly [K in ReportName]: readonly string[] } = {
  overview: ["figures"],
  product: ["daily"],
  retention: ["weekly", "daily", "headline"],
  funnels: ["steps"],
  acquisition: ["channels", "platforms", "link_clicks"],
  web: ["daily", "totals", "breakdowns", ...WEB_BREAKDOWNS],
  revenue: ["summary", "mrr", "event_counts", "cancellations"],
};

function rate(cell: RateCell) {
  return { rate: cell.rate, status: cell.status, numerator: cell.numerator, denominator: cell.denominator };
}

// ── Overview ─────────────────────────────────────────────────────────────────

function overviewFigures(report: OverviewReport): CsvTable {
  const rows: Record<string, unknown>[] = [];
  const add = (metric: string, figure: { current: number; previous: number | null }) =>
    rows.push({ metric, current: figure.current, previous: figure.previous });
  for (const audience of ["all", "signed_in"] as const) {
    for (const window of ["dau", "wau", "mau"] as const) {
      add(`active_users_${audience}_${window}`, report.active_users[audience][window]);
    }
  }
  add("new_users", report.new_users);
  add("web_visitors", report.web.visitors);
  add("web_pageviews", report.web.pageviews);
  add("mrr_cents", report.revenue.mrr_cents);
  add("active_subscriptions", report.revenue.active_subscriptions);
  add("gross_cents", report.revenue.gross_cents);
  add("net_cents", report.revenue.net_cents);
  for (const headline of report.retention) {
    const cell = rate(headline.cell);
    rows.push({
      metric: `retention_day_${headline.day}_${headline.mode}`,
      current: cell.rate,
      previous: null,
      status: cell.status,
      numerator: cell.numerator,
      denominator: cell.denominator,
      pending: headline.pending,
    });
  }
  return { columns: ["metric", "current", "previous", "status", "numerator", "denominator", "pending"], rows };
}

// ── Product ──────────────────────────────────────────────────────────────────

function productDaily(report: ProductReport): CsvTable {
  const signedIn = new Map(report.active_users.signed_in.series.map((point) => [point.date, point]));
  const newUsers = new Map(report.new_users.series.map((day) => [day.date, day.count]));
  const rows = report.active_users.all.series.map((point) => {
    const signed = signedIn.get(point.date);
    return {
      date: point.date,
      all_dau: point.dau,
      all_wau: point.wau,
      all_mau: point.mau,
      signed_in_dau: signed?.dau ?? null,
      signed_in_wau: signed?.wau ?? null,
      signed_in_mau: signed?.mau ?? null,
      new_users: newUsers.get(point.date) ?? 0,
    };
  });
  return {
    columns: ["date", "all_dau", "all_wau", "all_mau", "signed_in_dau", "signed_in_wau", "signed_in_mau", "new_users"],
    rows,
  };
}

// ── Retention ────────────────────────────────────────────────────────────────

const RATE_COLUMNS = ["retained", "eligible", "rate", "status"] as const;

function rateColumns(cell: RateCell) {
  return { retained: cell.numerator, eligible: cell.denominator, rate: cell.rate, status: cell.status };
}

function retentionTable(report: RetentionReport, table: string): CsvTable {
  if (table === "daily") {
    const rows = report.cohorts.flatMap((row) =>
      row.cells.map((cell) => ({ cohort: row.cohort, size: row.size, day: cell.day, mode: cell.mode, ...rateColumns(cell.cell) })),
    );
    return { columns: ["cohort", "size", "day", "mode", ...RATE_COLUMNS], rows };
  }
  if (table === "headline") {
    const rows = report.headline.map((headline) => ({
      day: headline.day,
      mode: headline.mode,
      ...rateColumns(headline.cell),
      pending: headline.pending,
    }));
    return { columns: ["day", "mode", ...RATE_COLUMNS, "pending"], rows };
  }
  const rows = report.weekly.flatMap((cohort) =>
    cohort.weeks.map((cell, week) => ({
      cohort: cohort.cohort,
      label: cohort.label,
      start: cohort.start,
      end: cohort.end,
      size: cohort.size,
      week,
      ...rateColumns(cell),
    })),
  );
  return { columns: ["cohort", "label", "start", "end", "size", "week", ...RATE_COLUMNS], rows };
}

// ── Funnels ──────────────────────────────────────────────────────────────────

function funnelSteps(report: FunnelReport): CsvTable {
  const rows = report.funnels.flatMap((funnel) =>
    funnel.steps.map((step, index) => ({
      funnel_key: funnel.key,
      funnel_name: funnel.name,
      window_days: funnel.window_days,
      step_number: index + 1,
      step: step.step,
      actors: step.actors,
      from_first_rate: step.from_first.rate,
      from_first_status: step.from_first.status,
      from_previous_rate: step.from_previous.rate,
      from_previous_status: step.from_previous.status,
      median_seconds_from_previous: step.median_seconds_from_previous,
      open: funnel.open,
    })),
  );
  return {
    columns: [
      "funnel_key",
      "funnel_name",
      "window_days",
      "step_number",
      "step",
      "actors",
      "from_first_rate",
      "from_first_status",
      "from_previous_rate",
      "from_previous_status",
      "median_seconds_from_previous",
      "open",
    ],
    rows,
  };
}

// ── Acquisition ──────────────────────────────────────────────────────────────

function acquisitionTable(report: AcquisitionReport, table: string): CsvTable {
  if (table === "platforms") {
    return { columns: ["platform", "signups"], rows: report.signups_by_platform.map((row) => ({ platform: row.key, signups: row.count })) };
  }
  if (table === "link_clicks") {
    return { columns: ["channel", "clicks"], rows: report.link_clicks_by_channel.map((row) => ({ channel: row.key, clicks: row.count })) };
  }
  return {
    columns: ["channel", "link_clicks", "signups", "activated", "trial_started", "paid"],
    rows: report.channels.map((row) => ({ ...row })),
  };
}

// ── Web ──────────────────────────────────────────────────────────────────────

function webTotalsRow(period: string, range: { from: string; to: string }, totals: WebTotals) {
  return {
    period,
    from: range.from,
    to: range.to,
    visitors: totals.visitors,
    visits: totals.visits,
    pageviews: totals.pageviews,
    views_per_visit: totals.views_per_visit,
    bounce_rate: totals.bounce_rate.rate,
    bounce_status: totals.bounce_rate.status,
    avg_visit_seconds: totals.avg_visit_seconds,
  };
}

function webTable(report: WebReport, table: string): CsvTable {
  if (table === "totals") {
    return {
      columns: ["period", "from", "to", "visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "bounce_status", "avg_visit_seconds"],
      rows: [webTotalsRow("current", report.range, report.totals), webTotalsRow("previous", report.previous.range, report.previous)],
    };
  }
  if (table === "breakdowns") {
    const rows = WEB_BREAKDOWNS.flatMap((dimension) => report.breakdowns[dimension].map((row) => ({ dimension, ...row })));
    return { columns: ["dimension", "key", "visitors", "pageviews"], rows };
  }
  if ((WEB_BREAKDOWNS as readonly string[]).includes(table)) {
    const rows = report.breakdowns[table as (typeof WEB_BREAKDOWNS)[number]].map((row) => ({ ...row }));
    return { columns: ["key", "visitors", "pageviews"], rows };
  }
  return { columns: ["date", "visitors", "visits", "pageviews"], rows: report.series.map((point) => ({ ...point })) };
}

// ── Revenue ──────────────────────────────────────────────────────────────────

function revenueTable(report: RevenueReport, table: string): CsvTable {
  if (table === "mrr") {
    return { columns: ["date", "mrr_cents"], rows: report.mrr.month_ends.map((point) => ({ ...point })) };
  }
  if (table === "event_counts") {
    return {
      columns: ["event_type", "count"],
      rows: Object.entries(report.event_counts).map(([eventType, count]) => ({ event_type: eventType, count })),
    };
  }
  if (table === "cancellations") {
    return { columns: ["reason", "count"], rows: report.cancellations_by_reason.map((row) => ({ reason: row.key, count: row.count })) };
  }
  const rows: Record<string, unknown>[] = [];
  const add = (metric: string, value: number) => rows.push({ metric, value });
  const addRate = (metric: string, cell: RateCell) => {
    const r = rate(cell);
    rows.push({ metric, value: r.rate, status: r.status, numerator: r.numerator, denominator: r.denominator });
  };
  const { mrr, subscriptions, trial_conversion: trials, churn, revenue } = report;
  add("mrr_cents", mrr.current_cents);
  add("mrr_at_range_start_cents", mrr.at_range_start_cents);
  add("mrr_new_cents", mrr.movements.new_cents);
  add("mrr_expansion_cents", mrr.movements.expansion_cents);
  add("mrr_contraction_cents", mrr.movements.contraction_cents);
  add("mrr_churned_cents", mrr.movements.churned_cents);
  add("mrr_net_new_cents", mrr.movements.net_new_cents);
  add("active_paid", subscriptions.active_paid);
  add("active_trials", subscriptions.active_trials);
  add("paid_at_range_start", subscriptions.paid_at_range_start);
  add("trials_started", trials.started);
  add("trials_converted", trials.converted);
  add("trials_pending", trials.pending);
  addRate("trial_conversion_rate", trials.cell);
  addRate("customer_churn_rate", churn.customer);
  addRate("revenue_churn_rate", churn.revenue);
  add("gross_cents", revenue.gross_cents);
  add("refunds_cents", revenue.refunds_cents);
  add("net_cents", revenue.net_cents);
  return { columns: ["metric", "value", "status", "numerator", "denominator"], rows };
}

// ── Entry points ─────────────────────────────────────────────────────────────

/** The table for `report`; `table` must be one of `CSV_TABLES[name]` (callers validate). */
export function reportTable<K extends ReportName>(name: K, report: ReportShapes[K], table: string = CSV_TABLES[name][0]): CsvTable {
  switch (name) {
    case "overview":
      return overviewFigures(report as OverviewReport);
    case "product":
      return productDaily(report as ProductReport);
    case "retention":
      return retentionTable(report as RetentionReport, table);
    case "funnels":
      return funnelSteps(report as FunnelReport);
    case "acquisition":
      return acquisitionTable(report as AcquisitionReport, table);
    case "web":
      return webTable(report as WebReport, table);
    default:
      return revenueTable(report as RevenueReport, table);
  }
}

export const EVENT_COLUMNS = [
  "id",
  "occurred_at",
  "received_at",
  "name",
  "user_id",
  "anonymous_id",
  "session_id",
  "platform",
  "app_version",
  "path",
  "properties",
] as const;

export function eventsTable(page: EventPage): CsvTable {
  return { columns: EVENT_COLUMNS, rows: page.events.map((event) => ({ ...event })) };
}

/**
 * `analytics-<report>[-<table>]-<from>_<to>.csv`. The table is named only when
 * it is not the default, so the common download keeps the short name. Every
 * part is a fixed name or a validated date, so nothing needs quoting.
 */
export function csvFilename(report: string, range: { from: string; to: string }, table?: string): string {
  return `analytics-${report}${table ? `-${table.replace(/_/g, "-")}` : ""}-${range.from}_${range.to}.csv`;
}
