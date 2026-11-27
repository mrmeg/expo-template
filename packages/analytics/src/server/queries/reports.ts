/**
 * Reports: each fetches the rows it needs in parallel, then hands them to the
 * pure functions in `../../metrics`. Fetch windows are wider than the range
 * where a figure needs it: activity from 29 days before the range (MAU),
 * retention activity past the range end (windows run on), funnel steps past
 * the range end (the conversion window), and the full ledger history of every
 * subscription that could be live (state is a replay).
 *
 * Every report takes `deps` and an optional range (inclusive ISO dates,
 * default the last 30 days ending today in the configured zone, at most 400
 * days) and throws `MetricsInputError` for a range or option it cannot serve.
 */

import {
  NOTES,
  REVENUE_NOTES,
  activityWindowStart,
  addDays,
  computeActiveUsers,
  computeChannelFunnel,
  computeChurn,
  computeRefundReversals,
  currencyBreakdown,
  summarizeCurrencies,
  computeDailyCohorts,
  computeFunnel,
  computeRetentionHeadline,
  computeTrialConversion,
  computeWebTotals,
  computeWeeklyGrid,
  daysInclusive,
  eachDay,
  fillWebSeries,
  groupBreakdowns,
  indexLedger,
  indexUserActivity,
  isTimezone,
  maxDay,
  minDay,
  monthEndsInRange,
  mrrMovements,
  previousRange,
  resolveDateRange,
  resolveMetricsConfig,
  retentionReach,
  revenueSnapshot,
  settledRateCell,
  signupsByChannel,
  sortCounts,
  summarizeRevenueTotals,
  weeklyGridStart,
  zonedDate,
  zonedDayEnd,
  zonedDayStart,
  type AcquisitionReport,
  type ActivationSummary,
  type ActiveUsers,
  type ActiveUsersComparison,
  type ChannelCohortRow,
  type CurrencyInfo,
  type DailyCount,
  type DateRange,
  type EventPage,
  type FunnelReport,
  type ListEventsParams,
  type OverviewReport,
  type ProductReport,
  type ReportRange,
  type ResolvedMetricsConfig,
  type RetentionMode,
  type RetentionReport,
  type RevenueReport,
  type WebReport,
} from "../../metrics";
import { MetricsInputError, type MetricsDeps, type QueryScope } from "./context";
import { fetchEvents, type EventCursor } from "./events";
import { fetchFunnelEvents } from "./funnels";
import {
  fetchActivityRows,
  fetchChannelCohorts,
  fetchCohortActivity,
  fetchCohortMembers,
  fetchLinkClicksByChannel,
  fetchNewUsersByDay,
  fetchSignupsByPlatform,
} from "./product";
import { fetchCancellationReasons, fetchLedgerForReplay, fetchRefundRows, fetchRevenueTotals } from "./revenue";
import { fetchSessionBreakdowns, fetchTopPages, fetchWebTotals } from "./web";

/** Optional inclusive ISO dates, as a query string carries them. */
export interface RangeInput {
  from?: string | null;
  to?: string | null;
}

interface ReportContext {
  deps: MetricsDeps;
  config: ResolvedMetricsConfig;
  timezone: string;
  /** Today in the configured zone. */
  today: string;
  nowMs: number;
  range: DateRange;
  report: ReportRange;
  scope: QueryScope;
}

/**
 * Resolves config, zone and range. A bad config or zone is the host's mistake
 * and throws a plain `Error`; only the caller's range and options throw
 * `MetricsInputError`.
 */
function prepare(deps: MetricsDeps, input: RangeInput | undefined): ReportContext {
  const config = resolveMetricsConfig(deps.config);
  const timezone = config.timezone;
  if (!isTimezone(timezone)) throw new Error(`expo-analytics: unknown time zone "${timezone}"`);
  const today = zonedDate(deps.now, timezone);
  const resolution = resolveDateRange(input, today);
  if (!resolution.ok) throw new MetricsInputError(resolution.message);
  const range = resolution.range;
  return {
    deps,
    config,
    timezone,
    today,
    nowMs: deps.now.getTime(),
    range,
    report: { ...range, days: daysInclusive(range), timezone },
    scope: scopeFor(deps, timezone, range),
  };
}

function scopeFor(deps: MetricsDeps, timezone: string, range: DateRange): QueryScope {
  return { appId: deps.appId, timezone, range };
}

function withRange(ctx: ReportContext, range: DateRange): QueryScope {
  return scopeFor(ctx.deps, ctx.timezone, range);
}

const BASE_NOTES = (ctx: ReportContext) => [NOTES.zone(ctx.timezone), NOTES.population];
/** The default activity rule, stated where a report counts activity and the host has not named the events. */
const ACTIVITY_NOTES = (ctx: ReportContext) => (ctx.config.activeEvents ? [] : [NOTES.activity]);

// ── Product ──────────────────────────────────────────────────────────────────

function fillDaily(rows: DailyCount[], range: DateRange): DailyCount[] {
  const byDay = new Map(rows.map((row) => [row.date, row.count]));
  return eachDay(range).map((date) => ({ date, count: byDay.get(date) ?? 0 }));
}

/**
 * Activation rate: of users first seen in the range, the share with the
 * activation event no later than `withinDays` after first seen. Users not yet
 * activated whose window is still open are pending: left out of the
 * denominator and counted in `pending`.
 */
function activationSummary(config: ResolvedMetricsConfig, cohorts: ChannelCohortRow[] | null): ActivationSummary | null {
  if (!config.activation || !cohorts) return null;
  let signups = 0;
  let activated = 0;
  let pending = 0;
  for (const row of cohorts) {
    signups += row.signups;
    activated += row.activated;
    pending += row.pending;
  }
  return {
    event: config.activation.event,
    within_days: config.activation.withinDays,
    signups,
    activated,
    pending,
    rate: settledRateCell(activated, signups - pending, pending),
  };
}

async function loadActiveUsers(ctx: ReportContext, range: DateRange): Promise<ActiveUsers> {
  const rows = await fetchActivityRows(
    ctx.deps.sql,
    ctx.deps.names,
    withRange(ctx, { from: activityWindowStart(range), to: range.to }),
    ctx.config.activeEvents,
  );
  return computeActiveUsers(rows, range);
}

/**
 * Active users (signed in and all, DAU/WAU/MAU series and stickiness), new
 * users (`first_seen_at` in range), and the activation rate when configured.
 */
export async function getProductReport(deps: MetricsDeps, input?: RangeInput): Promise<ProductReport> {
  const ctx = prepare(deps, input);
  const { sql, names } = deps;
  const [activeUsers, newUsers, cohorts] = await Promise.all([
    loadActiveUsers(ctx, ctx.range),
    fetchNewUsersByDay(sql, names, ctx.scope),
    ctx.config.activation
      ? fetchChannelCohorts(sql, names, ctx.scope, { now: deps.now, activation: ctx.config.activation })
      : Promise.resolve(null),
  ]);
  const series = fillDaily(newUsers, ctx.range);
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), NOTES.stitching, NOTES.activeUsers, ...ACTIVITY_NOTES(ctx)],
    active_users: activeUsers,
    new_users: { total: series.reduce((sum, day) => sum + day.count, 0), series },
    activation: activationSummary(ctx.config, cohorts),
  };
}

// ── Retention ────────────────────────────────────────────────────────────────

const RETENTION_MODES: readonly RetentionMode[] = ["on", "on_or_after", "bracket"];

async function loadRetentionInputs(ctx: ReportContext, options: { weekly: boolean; mode?: RetentionMode }) {
  const cohort: DateRange = {
    from: options.weekly ? minDay(ctx.range.from, weeklyGridStart(ctx.range)) : ctx.range.from,
    to: ctx.range.to,
  };
  const reach = retentionReach(ctx.config.retentionDays, options.mode);
  const offset = options.weekly ? reach.offset : Math.max(...ctx.config.retentionDays.map((day) => day + 6), 0);
  const activityTo = reach.openEnded
    ? maxDay(ctx.range.to, ctx.today)
    : maxDay(ctx.range.to, minDay(ctx.today, addDays(ctx.range.to, offset)));
  const [members, activity] = await Promise.all([
    fetchCohortMembers(ctx.deps.sql, ctx.deps.names, withRange(ctx, cohort)),
    fetchCohortActivity(ctx.deps.sql, ctx.deps.names, withRange(ctx, { from: cohort.from, to: activityTo }), cohort, ctx.config.activeEvents),
  ]);
  return { members, activity: indexUserActivity(activity) };
}

/**
 * Retention cohorted on first seen: headline figures for each `retentionDays`
 * N (default mode `on` for N = 1, `bracket` from N = 7, or `options.mode` for
 * all), one cohort row per day of the range, and the weekly grid of the last 12
 * weekly cohorts by weeks 0 to 12.
 */
export async function getRetentionReport(
  deps: MetricsDeps,
  input?: RangeInput,
  options: { mode?: RetentionMode } = {},
): Promise<RetentionReport> {
  const ctx = prepare(deps, input);
  if (options.mode !== undefined && !RETENTION_MODES.includes(options.mode)) {
    throw new MetricsInputError(`mode must be one of ${RETENTION_MODES.join(", ")}`);
  }
  const { members, activity } = await loadRetentionInputs(ctx, { weekly: true, mode: options.mode });
  const retentionInput = { members, activity, range: ctx.range, today: ctx.today, days: ctx.config.retentionDays, mode: options.mode };
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), NOTES.stitching, NOTES.retentionHeadline, ...ACTIVITY_NOTES(ctx)],
    days: [...ctx.config.retentionDays],
    headline: computeRetentionHeadline(retentionInput),
    cohorts: computeDailyCohorts(retentionInput),
    weekly: computeWeeklyGrid(retentionInput),
  };
}

// ── Funnels ──────────────────────────────────────────────────────────────────

/** Every configured funnel (or only `options.key`) for actors entering in the range. */
export async function getFunnelReport(
  deps: MetricsDeps,
  input?: RangeInput,
  options: { key?: string } = {},
): Promise<FunnelReport> {
  const ctx = prepare(deps, input);
  const funnels = ctx.config.funnels.filter((funnel) => options.key === undefined || funnel.key === options.key);
  if (options.key !== undefined && funnels.length === 0) throw new MetricsInputError(`no funnel with key "${options.key}"`);
  const bounds = {
    startMs: zonedDayStart(ctx.range.from, ctx.timezone),
    endMs: zonedDayEnd(ctx.range.to, ctx.timezone),
    nowMs: ctx.nowMs,
  };
  const results = await Promise.all(
    funnels.map(async (funnel) => {
      const rows = await fetchFunnelEvents(deps.sql, deps.names, ctx.scope, funnel);
      return computeFunnel(funnel, rows, bounds);
    }),
  );
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), NOTES.stitching, NOTES.funnelOpen],
    funnels: results,
  };
}

// ── Acquisition ──────────────────────────────────────────────────────────────

/** Sign-ups by channel and platform, link clicks by channel, and the per-channel funnel. */
export async function getAcquisitionReport(deps: MetricsDeps, input?: RangeInput): Promise<AcquisitionReport> {
  const ctx = prepare(deps, input);
  const { sql, names } = deps;
  const [cohorts, platforms, clicks] = await Promise.all([
    fetchChannelCohorts(sql, names, ctx.scope, { now: deps.now, activation: ctx.config.activation }),
    fetchSignupsByPlatform(sql, names, ctx.scope),
    fetchLinkClicksByChannel(sql, names, ctx.scope),
  ]);
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), NOTES.revenueProduction],
    signups_by_channel: signupsByChannel(cohorts),
    signups_by_platform: sortCounts(platforms),
    link_clicks_by_channel: sortCounts(clicks),
    channels: computeChannelFunnel({ cohorts, linkClicks: clicks, activationConfigured: ctx.config.activation !== null }),
  };
}

// ── Web ──────────────────────────────────────────────────────────────────────

/** Web totals for the range and the preceding period, a daily series, and the top-20 breakdowns. */
export async function getWebReport(deps: MetricsDeps, input?: RangeInput): Promise<WebReport> {
  const ctx = prepare(deps, input);
  const { sql, names } = deps;
  const previous = previousRange(ctx.range);
  const [current, before, sessionBreakdowns, pages] = await Promise.all([
    fetchWebTotals(sql, names, ctx.scope, { daily: true }),
    fetchWebTotals(sql, names, withRange(ctx, previous), { daily: false }),
    fetchSessionBreakdowns(sql, names, ctx.scope),
    fetchTopPages(sql, names, ctx.scope),
  ]);
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), NOTES.webScope],
    totals: computeWebTotals(current.totals),
    previous: { ...computeWebTotals(before.totals), range: previous },
    series: fillWebSeries(current.daily, ctx.range),
    breakdowns: groupBreakdowns([...sessionBreakdowns, ...pages.map((row) => ({ ...row, dimension: "pages" }))]),
  };
}

// ── Revenue ──────────────────────────────────────────────────────────────────

/** A snapshot instant, never later than the report's now. */
function snapshotAt(ctx: ReportContext, instantMs: number): number {
  return Math.min(instantMs, ctx.nowMs);
}

async function loadRevenueTotals(ctx: ReportContext, scope: QueryScope) {
  const [rows, refunds] = await Promise.all([
    fetchRevenueTotals(ctx.deps.sql, ctx.deps.names, scope),
    fetchRefundRows(ctx.deps.sql, ctx.deps.names, scope),
  ]);
  return summarizeRevenueTotals(rows, computeRefundReversals(refunds));
}

function currencyNotes(info: CurrencyInfo): string[] {
  return info.currencies.length > 1 ? [NOTES.revenueCurrency(info.currencies)] : [];
}

/**
 * MRR at the range's end, at its start and at each month end in it, with
 * movements; active trials and paid subscriptions; trial conversion; customer
 * and revenue churn; revenue totals, counts per event type, and cancellations
 * by reason. Snapshots are taken at those instants or at `now`, whichever is
 * earlier. Money is in `currency`, or mixed when that is null.
 */
export async function getRevenueReport(deps: MetricsDeps, input?: RangeInput): Promise<RevenueReport> {
  const ctx = prepare(deps, input);
  const { sql, names } = deps;
  const [ledgerRows, summary, reasons] = await Promise.all([
    fetchLedgerForReplay(sql, names, ctx.scope),
    loadRevenueTotals(ctx, ctx.scope),
    fetchCancellationReasons(sql, names, ctx.scope),
  ]);
  const ledger = indexLedger(ledgerRows);
  const startMs = zonedDayStart(ctx.range.from, ctx.timezone);
  const endMs = zonedDayEnd(ctx.range.to, ctx.timezone);
  const start = revenueSnapshot(ledger, snapshotAt(ctx, startMs));
  const end = revenueSnapshot(ledger, snapshotAt(ctx, endMs));
  const monthEnds = monthEndsInRange(ctx.range).map((date) => ({
    date,
    snapshot: revenueSnapshot(ledger, snapshotAt(ctx, zonedDayEnd(date, ctx.timezone))),
  }));
  const movements = mrrMovements(start, end);
  const currencies = summarizeCurrencies({
    current: end.mrr_by_currency,
    start: start.mrr_by_currency,
    others: [...monthEnds.flatMap((m) => [...m.snapshot.mrr_by_currency.keys()]), ...summary.net_by_currency.keys()],
  });
  return {
    range: ctx.report,
    notes: [...BASE_NOTES(ctx), ...REVENUE_NOTES, ...currencyNotes(currencies)],
    ...currencies,
    mrr: {
      current_cents: end.mrr_cents,
      by_currency: currencyBreakdown(end.mrr_by_currency),
      at_range_start_cents: start.mrr_cents,
      month_ends: monthEnds.map((m) => ({ date: m.date, mrr_cents: m.snapshot.mrr_cents })),
      movements,
    },
    subscriptions: { active_paid: end.active_paid, active_trials: end.active_trials, paid_at_range_start: start.active_paid },
    trial_conversion: computeTrialConversion(ledger, { startMs, endMs, nowMs: ctx.nowMs }),
    churn: computeChurn(start, end, movements),
    revenue: summary.totals,
    event_counts: summary.event_counts,
    cancellations_by_reason: sortCounts(reasons),
  };
}

// ── Overview ─────────────────────────────────────────────────────────────────

function compareActive(current: ActiveUsers, previous: ActiveUsers, variant: "signed_in" | "all"): ActiveUsersComparison {
  const now = current[variant].last;
  const then = previous[variant].last;
  return {
    dau: { current: now.dau, previous: then.dau },
    wau: { current: now.wau, previous: then.wau },
    mau: { current: now.mau, previous: then.mau },
  };
}

/**
 * The landing page: active users on the last day, new users, headline
 * retention, web visitors and pageviews, MRR, active subscriptions and revenue,
 * each against the preceding period of equal length except retention.
 */
export async function getOverviewReport(deps: MetricsDeps, input?: RangeInput): Promise<OverviewReport> {
  const ctx = prepare(deps, input);
  const { sql, names } = deps;
  const previous = previousRange(ctx.range);
  const lastDay = { from: ctx.range.to, to: ctx.range.to };
  const previousLastDay = { from: previous.to, to: previous.to };
  const [
    activeNow,
    activeBefore,
    newNow,
    newBefore,
    retention,
    webNow,
    webBefore,
    ledgerRows,
    revenueNow,
    revenueBefore,
  ] = await Promise.all([
    loadActiveUsers(ctx, lastDay),
    loadActiveUsers(ctx, previousLastDay),
    fetchNewUsersByDay(sql, names, ctx.scope),
    fetchNewUsersByDay(sql, names, withRange(ctx, previous)),
    loadRetentionInputs(ctx, { weekly: false }),
    fetchWebTotals(sql, names, ctx.scope, { daily: false }),
    fetchWebTotals(sql, names, withRange(ctx, previous), { daily: false }),
    fetchLedgerForReplay(sql, names, ctx.scope),
    loadRevenueTotals(ctx, ctx.scope),
    loadRevenueTotals(ctx, withRange(ctx, previous)),
  ]);

  const ledger = indexLedger(ledgerRows);
  // The previous period ends where this one starts. Neither snapshot is later than now.
  const start = revenueSnapshot(ledger, snapshotAt(ctx, zonedDayStart(ctx.range.from, ctx.timezone)));
  const end = revenueSnapshot(ledger, snapshotAt(ctx, zonedDayEnd(ctx.range.to, ctx.timezone)));
  const currencies = summarizeCurrencies({
    current: end.mrr_by_currency,
    start: start.mrr_by_currency,
    others: [...revenueNow.net_by_currency.keys(), ...revenueBefore.net_by_currency.keys()],
  });
  const sum = (rows: DailyCount[]) => rows.reduce((total, row) => total + row.count, 0);
  const web = computeWebTotals(webNow.totals);
  const webPrevious = computeWebTotals(webBefore.totals);

  return {
    range: ctx.report,
    notes: [
      ...BASE_NOTES(ctx),
      NOTES.stitching,
      NOTES.retentionHeadline,
      ...ACTIVITY_NOTES(ctx),
      NOTES.revenueGross,
      NOTES.revenueProduction,
      NOTES.revenueNow,
      ...currencyNotes(currencies),
    ],
    previous_range: previous,
    active_users: {
      signed_in: compareActive(activeNow, activeBefore, "signed_in"),
      all: compareActive(activeNow, activeBefore, "all"),
    },
    new_users: { current: sum(newNow), previous: sum(newBefore) },
    retention: computeRetentionHeadline({
      members: retention.members,
      activity: retention.activity,
      range: ctx.range,
      today: ctx.today,
      days: ctx.config.retentionDays,
    }),
    web: {
      visitors: { current: web.visitors, previous: webPrevious.visitors },
      pageviews: { current: web.pageviews, previous: webPrevious.pageviews },
    },
    revenue: {
      ...currencies,
      mrr_cents: { current: end.mrr_cents, previous: start.mrr_cents },
      mrr_by_currency: currencyBreakdown(end.mrr_by_currency),
      active_subscriptions: { current: end.active_paid, previous: start.active_paid },
      gross_cents: { current: revenueNow.totals.gross_cents, previous: revenueBefore.totals.gross_cents },
      net_cents: { current: revenueNow.totals.net_cents, previous: revenueBefore.totals.net_cents },
    },
  };
}

// ── Raw events ───────────────────────────────────────────────────────────────

export const LIST_EVENTS_MAX_LIMIT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

/** `<occurred_at ISO with microseconds>_<id>`. Opaque to callers. */
export function encodeEventCursor(cursor: EventCursor): string {
  return `${cursor.occurredAt}_${cursor.id}`;
}

export function decodeEventCursor(value: string): EventCursor {
  const [occurredAt, id, extra] = value.split("_");
  if (extra !== undefined || !CURSOR_INSTANT.test(occurredAt ?? "") || !UUID.test(id ?? "")) {
    throw new MetricsInputError("before must be a cursor returned as next_before");
  }
  return { occurredAt, id };
}

/**
 * Raw events in `[from, to]` (zone days), newest first, optionally one name
 * or one user, with the population filter applied. `limit` is clamped to
 * 1..1000; `next_before` is null on the last page.
 */
export async function listEvents(deps: MetricsDeps, params: ListEventsParams): Promise<EventPage> {
  const ctx = prepare(deps, { from: params.from, to: params.to });
  const limit = Math.min(Math.max(Math.floor(Number(params.limit) || 0), 1), LIST_EVENTS_MAX_LIMIT);
  const rows = await fetchEvents(deps.sql, deps.names, ctx.scope, {
    name: params.name,
    userId: params.userId,
    before: params.before ? decodeEventCursor(params.before) : undefined,
    limit: limit + 1,
  });
  const events = rows.slice(0, limit);
  const last = events[events.length - 1];
  return {
    range: ctx.report,
    events,
    next_before: rows.length > limit && last ? encodeEventCursor({ occurredAt: last.occurred_at, id: last.id }) : null,
  };
}
