/**
 * Metrics contract: the configuration a host passes, the row shapes the
 * server's fetchers return, and every report the server assembles. Pure types,
 * shared by `./server` (which computes the reports) and any dashboard that
 * renders them, so the shape is declared once.
 *
 * Conventions: money is integer cents; rates are fractions 0..1 or null inside
 * a `RateCell`; dates are `YYYY-MM-DD` cut in the configured zone; instants are
 * ISO 8601 UTC strings.
 */

// ── Configuration ────────────────────────────────────────────────────────────

/** An ordered funnel. Other events may occur between steps. */
export interface FunnelDefinition {
  /** Stable id, used in URLs and exports. */
  key: string;
  name: string;
  /** Event names, in order. At least one. */
  steps: string[];
  /** Days after the actor's first step-1 event in which later steps count. Default 7. */
  windowDays?: number;
}

export interface MetricsConfig {
  /** IANA zone every day bucket is cut in. Default "UTC". */
  timezone?: string;
  /** The event that marks a user as activated, and how long after sign-up it may occur. */
  activation?: { event: string; withinDays?: number };
  /** Events that count as activity. Default: every event except "$session_end". */
  activeEvents?: readonly string[];
  /** N for the headline retention figures. Default [1, 7, 30, 90]. */
  retentionDays?: readonly number[];
  funnels?: readonly FunnelDefinition[];
}

// ── Shared figures ───────────────────────────────────────────────────────────

/** Inclusive ISO dates (`YYYY-MM-DD`). */
export interface DateRange {
  from: string;
  to: string;
}

/** The range a report covers, with the zone its days were cut in. */
export interface ReportRange extends DateRange {
  days: number;
  timezone: string;
}

/**
 * A ratio with its maturity. `rate` is `numerator / denominator` when `status`
 * is `measured`; null when the window has not closed yet (`not_yet`) or there
 * is nothing to measure (`empty`).
 */
export interface RateCell {
  numerator: number;
  denominator: number;
  rate: number | null;
  status: "measured" | "not_yet" | "empty";
}

/** A count keyed by a label (channel, platform, reason). */
export interface CountByKey {
  key: string;
  count: number;
}

/** A figure for the report's range next to the immediately preceding period of equal length. */
export interface Comparison {
  current: number;
  /** Null where the previous period is not computed. */
  previous: number | null;
}

/** Fields every report carries. */
export interface ReportBase {
  range: ReportRange;
  /** Caveats a dashboard shows verbatim. */
  notes: string[];
}

// ── Product ──────────────────────────────────────────────────────────────────

export interface ActiveUsersPoint {
  date: string;
  /** Distinct actors active on `date`. */
  dau: number;
  /** Distinct actors active in the 7 days ending on `date`. */
  wau: number;
  /** Distinct actors active in the 30 days ending on `date`. */
  mau: number;
}

export interface ActiveUsersCounts {
  dau: number;
  wau: number;
  mau: number;
}

export interface ActiveUsersVariant {
  /** One point per day of the range. */
  series: ActiveUsersPoint[];
  /** The point on the range's last day. */
  last: ActiveUsersCounts;
  /** Average DAU over the range divided by MAU on the last day. */
  stickiness: RateCell;
}

export interface ActiveUsers {
  /** Distinct `user_id` on events that carried one. */
  signed_in: ActiveUsersVariant;
  /** Distinct actor (`user_id`, stitched user, or `anonymous_id`), so anonymous devices count. */
  all: ActiveUsersVariant;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface ActivationSummary {
  event: string;
  within_days: number;
  /** Users first seen in the range. */
  signups: number;
  /** Of those, users with the activation event no later than `within_days` after first seen. */
  activated: number;
  /** Not activated yet and still inside their window; left out of the denominator. */
  pending: number;
  /** `activated / (signups - pending)`. */
  rate: RateCell;
}

export interface ProductReport extends ReportBase {
  active_users: ActiveUsers;
  /** Users whose `first_seen_at` falls in the range. */
  new_users: { total: number; series: DailyCount[] };
  /** Null when `activation` is not configured. */
  activation: ActivationSummary | null;
}

// ── Retention ────────────────────────────────────────────────────────────────

/**
 * - `on`: active on exactly day N after first seen.
 * - `on_or_after`: active on day N or any later day (up to today).
 * - `bracket`: active on any day in [N, N + 6].
 */
export type RetentionMode = "on" | "on_or_after" | "bracket";

export interface RetentionHeadline {
  day: number;
  mode: RetentionMode;
  /** Over users first seen in the range whose day-N window has closed. */
  cell: RateCell;
  /** Users first seen in the range whose window is still open; not in `cell`. */
  pending: number;
}

export interface RetentionCohortCell {
  day: number;
  mode: RetentionMode;
  cell: RateCell;
}

/** Users first seen on one day. */
export interface RetentionCohortRow {
  cohort: string;
  size: number;
  cells: RetentionCohortCell[];
}

/** Users first seen in one ISO week (Monday start), clipped to the range end. */
export interface WeeklyRetentionCohort {
  /** Monday of the week. */
  cohort: string;
  /** `YYYY-Www`. */
  label: string;
  start: string;
  end: string;
  size: number;
  /** Index w is week w: active on any day in [7w, 7w + 6] after first seen. Weeks 0 to 12. */
  weeks: RateCell[];
}

export interface RetentionReport extends ReportBase {
  /** The N values, from `retentionDays`. */
  days: number[];
  headline: RetentionHeadline[];
  /** One row per day of the range. */
  cohorts: RetentionCohortRow[];
  /** The last 12 weekly cohorts, oldest first, ending with the week containing the range end. */
  weekly: WeeklyRetentionCohort[];
}

// ── Funnels ──────────────────────────────────────────────────────────────────

export interface FunnelStepResult {
  step: string;
  /** Actors who did steps 1..k in order inside their window. */
  actors: number;
  from_first: RateCell;
  from_previous: RateCell;
  /** Median seconds from the previous step; null for step 1 or when nobody reached it. */
  median_seconds_from_previous: number | null;
}

export interface FunnelResult {
  key: string;
  name: string;
  window_days: number;
  steps: FunnelStepResult[];
  /** Actors who have not finished every step and whose window is still open. */
  open: number;
}

export interface FunnelReport extends ReportBase {
  funnels: FunnelResult[];
}

// ── Acquisition ──────────────────────────────────────────────────────────────

/** One channel: clicks in the range, and the users who signed up in it. */
export interface ChannelFunnelRow {
  channel: string;
  link_clicks: number;
  signups: number;
  /** Null when `activation` is not configured. */
  activated: number | null;
  /** Of the sign-ups, users with a `trial_started` ledger row. */
  trial_started: number;
  /** Of the sign-ups, users with a paid ledger row (`purchased`, `trial_converted`, `renewed`). */
  paid: number;
}

export interface AcquisitionReport extends ReportBase {
  signups_by_channel: CountByKey[];
  signups_by_platform: CountByKey[];
  link_clicks_by_channel: CountByKey[];
  channels: ChannelFunnelRow[];
}

// ── Web traffic ──────────────────────────────────────────────────────────────

export interface WebTotals {
  /** Distinct `anonymous_id`. */
  visitors: number;
  /** Sessions. */
  visits: number;
  pageviews: number;
  /** Pageviews over visits; null without visits. */
  views_per_visit: number | null;
  /** Sessions with at most one pageview and no custom events, over sessions. */
  bounce_rate: RateCell;
  /** Mean of `last_seen_at - started_at`; null without visits. */
  avg_visit_seconds: number | null;
}

export interface WebDailyPoint {
  date: string;
  visitors: number;
  visits: number;
  pageviews: number;
}

export interface BreakdownRow {
  /** The page, referrer, source and so on. Null where it was not recorded. */
  key: string | null;
  visitors: number;
  pageviews: number;
}

export const WEB_BREAKDOWNS = [
  "pages",
  "entry_pages",
  "exit_pages",
  "referrers",
  "utm_sources",
  "utm_campaigns",
  "devices",
  "browsers",
  "os",
  "countries",
] as const;
export type WebBreakdown = (typeof WEB_BREAKDOWNS)[number];

export interface WebReport extends ReportBase {
  totals: WebTotals;
  previous: WebTotals & { range: DateRange };
  series: WebDailyPoint[];
  /** Top 20 of each, by visitors then pageviews. */
  breakdowns: Record<WebBreakdown, BreakdownRow[]>;
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export interface MrrPoint {
  date: string;
  mrr_cents: number;
}

/** Changes between MRR at the range start and on its last day. `net_new = new + expansion - contraction - churned`. */
export interface MrrMovements {
  /** Subscriptions not paying at the start that pay at the end. */
  new_cents: number;
  /** Subscriptions paying at both whose MRR rose. */
  expansion_cents: number;
  /** Subscriptions paying at both whose MRR fell. */
  contraction_cents: number;
  /** Subscriptions paying at the start that no longer pay at the end. */
  churned_cents: number;
  net_new_cents: number;
}

export interface TrialConversion {
  /** Trials started in the range. */
  started: number;
  converted: number;
  /** Not converted, not ended, and still inside their window; left out of the denominator. */
  pending: number;
  cell: RateCell;
}

export interface RevenueTotals {
  /** Sum of positive amounts. */
  gross_cents: number;
  /** Sum of negative amounts, as a positive number. */
  refunds_cents: number;
  /** `gross - refunds`. */
  net_cents: number;
}

export interface RevenueReport extends ReportBase {
  mrr: {
    /** MRR at the end of the range's last day. */
    current_cents: number;
    /** MRR at the start of the range's first day. */
    at_range_start_cents: number;
    /** MRR at the end of each month end inside the range. */
    month_ends: MrrPoint[];
    movements: MrrMovements;
  };
  subscriptions: {
    /** Paying at the end of the range's last day. */
    active_paid: number;
    /** Trialing at the end of the range's last day. */
    active_trials: number;
    /** Paying at the start of the range. */
    paid_at_range_start: number;
  };
  trial_conversion: TrialConversion;
  churn: {
    /** Subscriptions paying at the range start and not at its end, over those paying at the start. */
    customer: RateCell;
    /** Churned MRR over MRR at the range start (cents over cents). */
    revenue: RateCell;
  };
  revenue: RevenueTotals;
  /** Ledger rows in the range, by event type (every type present, zero when none). */
  event_counts: Record<RevenueEventType, number>;
  /** `cancel_scheduled` rows in the range by `cancel_reason` ("unknown" when null). */
  cancellations_by_reason: CountByKey[];
}

export const REVENUE_EVENT_TYPES = [
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
export type RevenueEventType = (typeof REVENUE_EVENT_TYPES)[number];

// ── Overview ─────────────────────────────────────────────────────────────────

export interface ActiveUsersComparison {
  dau: Comparison;
  wau: Comparison;
  mau: Comparison;
}

export interface OverviewReport extends ReportBase {
  /** The immediately preceding period of equal length every `previous` refers to. */
  previous_range: DateRange;
  /** On the last day of each period. */
  active_users: { signed_in: ActiveUsersComparison; all: ActiveUsersComparison };
  new_users: Comparison;
  /** Current period only. */
  retention: RetentionHeadline[];
  web: { visitors: Comparison; pageviews: Comparison };
  revenue: {
    /** At the end of each period's last day. */
    mrr_cents: Comparison;
    active_subscriptions: Comparison;
    gross_cents: Comparison;
    net_cents: Comparison;
  };
}

// ── Raw events ───────────────────────────────────────────────────────────────

export interface ListEventsParams {
  /** Inclusive ISO dates in the configured zone. */
  from: string;
  to: string;
  name?: string;
  userId?: string;
  /** Clamped to 1..1000. */
  limit: number;
  /** `next_before` from the previous page. */
  before?: string;
}

export interface EventRow {
  id: string;
  name: string;
  /** ISO 8601 UTC, microsecond precision. */
  occurred_at: string;
  received_at: string;
  user_id: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  platform: string | null;
  app_version: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
}

export interface EventPage {
  range: ReportRange;
  /** Newest first. */
  events: EventRow[];
  /** Cursor for the next (older) page; null on the last page. */
  next_before: string | null;
}

// ── Fetcher rows (what `./server` hands the pure functions) ──────────────────

/** One actor active on one day. An actor can have a signed-in and an anonymous row for the same day. */
export interface ActivityRow {
  actor: string;
  day: string;
  /** The event carried a `user_id` (then `actor` is that id). */
  signed_in: boolean;
}

/** A user and the day they were first seen. */
export interface CohortMember {
  user_id: string;
  first_day: string;
}

/** A known user (directly or by stitching) active on a day. */
export interface UserActivityRow {
  user_id: string;
  day: string;
}

export interface FunnelEventRow {
  actor: string;
  name: string;
  /** ISO 8601 UTC. */
  occurred_at: string;
}

/** Sign-ups in a range for one channel, with what they went on to do. */
export interface ChannelCohortRow {
  channel: string;
  signups: number;
  activated: number;
  pending: number;
  trial_started: number;
  paid: number;
}

/** One revenue ledger row, as the subscription replay needs it. */
export interface LedgerRow {
  provider_subscription_id: string | null;
  user_id: string | null;
  event_type: string;
  /** ISO 8601 UTC. */
  occurred_at: string;
  period_start: string | null;
  period_end: string | null;
  amount_cents: number | null;
}

/** Ledger rows in a range grouped by type and currency. */
export interface RevenueTotalsRow {
  event_type: string;
  currency: string | null;
  events: number;
  gross_cents: number;
  refunds_cents: number;
}

export interface WebTotalsRow {
  visitors: number;
  visits: number;
  pageviews: number;
  bounces: number;
  avg_visit_seconds: number | null;
}
