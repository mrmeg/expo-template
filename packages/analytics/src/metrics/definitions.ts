/**
 * Metric constants, the `RateCell` constructors, and the caveats each report
 * shows verbatim. The definitions themselves are restated next to the function
 * that computes each figure.
 */

import { RESERVED_EVENTS } from "../shared/wire";
import { DEFAULT_TIMEZONE } from "./dates";
import type { FunnelDefinition, MetricsConfig, RateCell, RevenueEventType, RetentionMode } from "./types";

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_ACTIVATION_WINDOW_DAYS = 7;
export const DEFAULT_RETENTION_DAYS: readonly number[] = [1, 7, 30, 90];
export const DEFAULT_FUNNEL_WINDOW_DAYS = 7;
/** Events that never count as activity unless `activeEvents` lists them. */
export const INACTIVE_EVENTS: readonly string[] = [RESERVED_EVENTS.sessionEnd];
/** Days in a `bracket` retention window: [N, N + 6]. */
export const BRACKET_SPAN_DAYS = 7;
export const WEEKLY_COHORT_COUNT = 12;
/** Weekly grid columns: weeks 0 to 12. */
export const WEEKLY_GRID_WEEKS = 13;
export const BREAKDOWN_LIMIT = 20;
/** Label for sessions with no referrer. */
export const DIRECT_REFERRER = "Direct";
/** Channel recorded for a user with no attribution. */
export const UNKNOWN_CHANNEL = "unknown";

/** Headline default: `on` for day 1 (and any N under 7), `bracket` from day 7. */
export function defaultRetentionMode(day: number): RetentionMode {
  return day >= 7 ? "bracket" : "on";
}

// ── Revenue ledger ───────────────────────────────────────────────────────────

/** Ledger rows that pay for a period. */
export const PAID_EVENT_TYPES: readonly RevenueEventType[] = ["purchased", "trial_converted", "renewed"];

export function isPaidEventType(type: string): boolean {
  return (PAID_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Days after a period's end that a subscription (or a trial) is still counted
 * while its renewal or conversion arrives. Stores deliver those events at or
 * shortly after the period end.
 */
export const GRACE_DAYS = 2;
/** Trial window when a `trial_started` row has no `period_end`. */
export const TRIAL_FALLBACK_WINDOW_DAYS = 14;

/**
 * Order of same-instant ledger rows in the replay. Providers write pairs with
 * one timestamp (`purchased` + `reactivated`, `cancel_scheduled` + `refunded`),
 * and row ids are random, so the type decides: starts and payments first, then
 * state changes, then endings.
 */
export const LEDGER_REPLAY_RANK: Readonly<Record<string, number>> = {
  trial_started: 0,
  purchased: 1,
  trial_converted: 1,
  renewed: 1,
  reactivated: 2,
  uncanceled: 3,
  product_changed: 3,
  billing_issue: 4,
  cancel_scheduled: 5,
  refunded: 6,
  refund_reversed: 7,
  expired: 8,
};

// ── Configuration ────────────────────────────────────────────────────────────

export interface ResolvedMetricsConfig {
  timezone: string;
  activation: { event: string; withinDays: number } | null;
  /** Null means every event except `INACTIVE_EVENTS`. */
  activeEvents: readonly string[] | null;
  retentionDays: number[];
  funnels: Required<FunnelDefinition>[];
}

function wholeDays(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 3650) {
    throw new Error(`expo-analytics: ${label} must be a whole number of days between 0 and 3650 (got ${value})`);
  }
  return value;
}

/** Applies defaults and rejects values no report could use. */
export function resolveMetricsConfig(config: MetricsConfig = {}): ResolvedMetricsConfig {
  const retentionDays = [...new Set((config.retentionDays ?? DEFAULT_RETENTION_DAYS).map((day) => wholeDays(day, "retentionDays")))]
    .sort((a, b) => a - b);
  const funnels = (config.funnels ?? []).map((funnel) => {
    if (funnel.steps.length === 0) throw new Error(`expo-analytics: funnel "${funnel.key}" has no steps`);
    return {
      key: funnel.key,
      name: funnel.name,
      steps: [...funnel.steps],
      windowDays: wholeDays(funnel.windowDays ?? DEFAULT_FUNNEL_WINDOW_DAYS, `funnel "${funnel.key}" windowDays`),
    };
  });
  return {
    timezone: config.timezone ?? DEFAULT_TIMEZONE,
    activation: config.activation
      ? {
        event: config.activation.event,
        withinDays: wholeDays(config.activation.withinDays ?? DEFAULT_ACTIVATION_WINDOW_DAYS, "activation.withinDays"),
      }
      : null,
    activeEvents: config.activeEvents ? [...config.activeEvents] : null,
    retentionDays,
    funnels,
  };
}

// ── Rate cells ───────────────────────────────────────────────────────────────

/** `measured` when the window has closed and there is a denominator. */
export function rateCell(numerator: number, denominator: number, mature = true): RateCell {
  if (denominator === 0) return { numerator, denominator, rate: null, status: "empty" };
  if (!mature) return { numerator, denominator, rate: null, status: "not_yet" };
  return { numerator, denominator, rate: numerator / denominator, status: "measured" };
}

/**
 * A rate whose still-open members were left out of `denominator`: `not_yet`
 * when nobody has settled but some are pending, otherwise as `rateCell`.
 */
export function settledRateCell(numerator: number, denominator: number, pending: number): RateCell {
  if (denominator === 0 && pending > 0) return { numerator, denominator, rate: null, status: "not_yet" };
  return rateCell(numerator, denominator, true);
}

// ── Notes shown verbatim ─────────────────────────────────────────────────────

export const NOTES = {
  zone: (timezone: string) => `Days are cut in the ${timezone} time zone.`,
  population: "Users marked excluded are left out of every figure, together with their events, sessions and revenue.",
  stitching: "Events a device sent before signing in count toward the user who later signed in on it.",
  activeUsers: "Signed-in active users count events that carried a user id; all active users also count anonymous devices.",
  retentionHeadline:
    "Headline retention counts only users whose day-N window has closed; users still inside it are reported as pending.",
  funnelOpen: "Actors whose conversion window is still open may still complete later steps.",
  webScope: "Web traffic counts sessions and pageviews from the web platform only.",
  revenueGross: "Revenue is gross of App Store, Play Store and payment processor fees.",
  revenueProduction: "Only production ledger rows count; sandbox purchases are left out.",
  revenueOneTime: "One-time purchases count toward revenue and never toward MRR.",
  revenueActive: `A subscription counts as paying until it expires, is refunded, or its paid period ended more than ${GRACE_DAYS} days ago without a renewal.`,
  revenueCurrency: "Amounts are summed as recorded, without currency conversion, and the ledger holds more than one currency.",
  trialPending: `Trials still inside their window (period end plus ${GRACE_DAYS} days, or ${TRIAL_FALLBACK_WINDOW_DAYS} days when no period end is known) are pending and left out of the conversion rate.`,
} as const;
