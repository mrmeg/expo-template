/**
 * Subscription state, MRR, trial conversion and churn, from the revenue ledger.
 *
 * State is a pure replay of one `provider_subscription_id`'s rows up to an
 * instant, ordered by time and then by `LEDGER_REPLAY_RANK`:
 * - `trial_started` opens a trial (unless the subscription is already paying).
 * - A paid row (`purchased`, `trial_converted`, `renewed`) with a `period_end`
 *   makes it paying for that period. A paid row with no `period_end`, or any
 *   row with no `provider_subscription_id`, is a one-time purchase: revenue,
 *   never MRR, so it never enters the replay.
 * - `expired` ends it. `refunded` ends it too (the store revokes access), and a
 *   later `refund_reversed` restores what the refund ended.
 * - `cancel_scheduled`, `uncanceled`, `billing_issue`, `product_changed` and
 *   `reactivated` change nothing on their own: access runs to the period end,
 *   and a price change or reactivation arrives with its own paid row.
 * At the instant the replay stops, a paying subscription is `active` until
 * `GRACE_DAYS` after its paid period's end (so a renewal that lands a little
 * late does not read as churn), and a trial is `trialing` until its window
 * closes: `period_end` plus `GRACE_DAYS`, or `TRIAL_FALLBACK_WINDOW_DAYS` after
 * the start when no period end is known. Past those it is `ended`.
 *
 * MRR at an instant: for each subscription active and paid then, its latest
 * paid `amount_cents` normalized to one month from that period's length
 * (`period_start`..`period_end`, or the row's `occurred_at` when the start is
 * missing), rounded to whole cents per subscription so totals and movements
 * add up exactly.
 */

import { DAY_MS } from "./dates";
import {
  GRACE_DAYS,
  LEDGER_REPLAY_RANK,
  NOTES,
  TRIAL_FALLBACK_WINDOW_DAYS,
  isPaidEventType,
  rateCell,
  settledRateCell,
} from "./definitions";
import type {
  CountByKey,
  LedgerRow,
  MrrMovements,
  RateCell,
  RevenueEventType,
  RevenueTotals,
  RevenueTotalsRow,
  TrialConversion,
} from "./types";
import { REVENUE_EVENT_TYPES } from "./types";

// ── Normalization ────────────────────────────────────────────────────────────

const AVERAGE_MONTH_DAYS = 365.25 / 12;

/**
 * One period's amount as a monthly amount. Lengths near a standard plan snap to
 * it: 6 to 8 days weekly, 27.5 to 31.5 monthly, 85 to 95 quarterly, 175 to 190
 * half-yearly, 360 to 370 yearly. Anything else is prorated by days. Null for a
 * period with no positive length.
 */
export function monthlyAmount(amountCents: number, periodDays: number): number | null {
  if (!Number.isFinite(periodDays) || periodDays <= 0) return null;
  if (periodDays >= 6 && periodDays <= 8) return (amountCents * 52) / 12;
  if (periodDays >= 27.5 && periodDays <= 31.5) return amountCents;
  if (periodDays >= 85 && periodDays <= 95) return amountCents / 3;
  if (periodDays >= 175 && periodDays <= 190) return amountCents / 6;
  if (periodDays >= 360 && periodDays <= 370) return amountCents / 12;
  return (amountCents * AVERAGE_MONTH_DAYS) / periodDays;
}

// ── Replay ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = "trialing" | "active" | "ended";

export interface SubscriptionState {
  id: string;
  user_id: string | null;
  status: SubscriptionStatus;
  /** Whole cents; 0 unless `active`. */
  mrr_cents: number;
}

/** A ledger row parsed for replay (instants as epoch ms). */
export interface ReplayRow {
  type: string;
  at: number;
  rank: number;
  user_id: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  amount: number | null;
}

/** Ledger rows grouped by subscription and sorted for replay. */
export interface SubscriptionLedger {
  bySubscription: Map<string, ReplayRow[]>;
  /** `trial_started` rows with no subscription id: counted as trials, never linked to a conversion. */
  unlinkedTrials: number[];
}

function parseInstant(value: string | null): number | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function indexLedger(rows: LedgerRow[]): SubscriptionLedger {
  const bySubscription = new Map<string, ReplayRow[]>();
  const unlinkedTrials: number[] = [];
  for (const row of rows) {
    const at = Date.parse(row.occurred_at);
    if (Number.isNaN(at)) continue;
    if (row.provider_subscription_id === null) {
      if (row.event_type === "trial_started") unlinkedTrials.push(at);
      continue;
    }
    const list = bySubscription.get(row.provider_subscription_id) ?? [];
    list.push({
      type: row.event_type,
      at,
      rank: LEDGER_REPLAY_RANK[row.event_type] ?? 9,
      user_id: row.user_id,
      periodStart: parseInstant(row.period_start),
      periodEnd: parseInstant(row.period_end),
      amount: row.amount_cents,
    });
    bySubscription.set(row.provider_subscription_id, list);
  }
  for (const list of bySubscription.values()) list.sort((a, b) => a.at - b.at || a.rank - b.rank);
  return { bySubscription, unlinkedTrials };
}

type Phase = "none" | "trialing" | "paid" | "ended";

function trialCloseMs(row: ReplayRow): number {
  return row.periodEnd !== null ? row.periodEnd + GRACE_DAYS * DAY_MS : row.at + TRIAL_FALLBACK_WINDOW_DAYS * DAY_MS;
}

/** State of one subscription from rows strictly before `asOfMs`; null when none of its rows set a state yet. */
export function replaySubscription(id: string, rows: ReplayRow[], asOfMs: number): SubscriptionState | null {
  let phase: Phase = "none";
  let beforeRefund: Phase | null = null;
  let trialClose = 0;
  let paid: ReplayRow | null = null;
  let userId: string | null = null;

  for (const row of rows) {
    if (row.at >= asOfMs) break;
    if (row.user_id !== null) userId = row.user_id;
    if (row.type === "trial_started") {
      if (phase !== "paid") {
        phase = "trialing";
        trialClose = trialCloseMs(row);
        beforeRefund = null;
      }
    } else if (isPaidEventType(row.type)) {
      if (row.periodEnd === null) continue; // one-time purchase
      phase = "paid";
      paid = row;
      beforeRefund = null;
    } else if (row.type === "expired") {
      phase = phase === "none" ? "none" : "ended";
      beforeRefund = null;
    } else if (row.type === "refunded") {
      if (phase === "paid" || phase === "trialing") {
        beforeRefund = phase;
        phase = "ended";
      }
    } else if (row.type === "refund_reversed") {
      if (phase === "ended" && beforeRefund !== null) {
        phase = beforeRefund;
        beforeRefund = null;
      }
    }
  }

  if (phase === "none") return null;
  if (phase === "trialing") {
    return { id, user_id: userId, status: asOfMs < trialClose ? "trialing" : "ended", mrr_cents: 0 };
  }
  if (phase === "paid" && paid !== null && paid.periodEnd !== null && asOfMs < paid.periodEnd + GRACE_DAYS * DAY_MS) {
    const periodDays = (paid.periodEnd - (paid.periodStart ?? paid.at)) / DAY_MS;
    const monthly = paid.amount === null ? 0 : monthlyAmount(paid.amount, periodDays) ?? 0;
    return { id, user_id: userId, status: "active", mrr_cents: Math.round(monthly) };
  }
  return { id, user_id: userId, status: "ended", mrr_cents: 0 };
}

export interface RevenueSnapshot {
  mrr_cents: number;
  active_paid: number;
  active_trials: number;
  /** Every subscription with a state at the instant. */
  subscriptions: Map<string, SubscriptionState>;
}

/** Every subscription's state, MRR, and the active counts at `asOfMs`. */
export function revenueSnapshot(ledger: SubscriptionLedger, asOfMs: number): RevenueSnapshot {
  const subscriptions = new Map<string, SubscriptionState>();
  let mrr = 0;
  let activePaid = 0;
  let activeTrials = 0;
  for (const [id, rows] of ledger.bySubscription) {
    const state = replaySubscription(id, rows, asOfMs);
    if (!state) continue;
    subscriptions.set(id, state);
    if (state.status === "active") {
      activePaid += 1;
      mrr += state.mrr_cents;
    } else if (state.status === "trialing") {
      activeTrials += 1;
    }
  }
  return { mrr_cents: mrr, active_paid: activePaid, active_trials: activeTrials, subscriptions };
}

/**
 * MRR movements between two snapshots, per subscription: new (not paying at
 * the start, paying at the end), churned (paying at the start, not at the end),
 * expansion and contraction (paying at both, MRR changed). `net_new` is the sum,
 * which equals end MRR minus start MRR.
 */
export function mrrMovements(start: RevenueSnapshot, end: RevenueSnapshot): MrrMovements {
  let fresh = 0;
  let expansion = 0;
  let contraction = 0;
  let churned = 0;
  const ids = new Set([...start.subscriptions.keys(), ...end.subscriptions.keys()]);
  for (const id of ids) {
    const before = start.subscriptions.get(id);
    const after = end.subscriptions.get(id);
    const wasPaying = before?.status === "active";
    const isPaying = after?.status === "active";
    if (!wasPaying && isPaying) fresh += after.mrr_cents;
    else if (wasPaying && !isPaying) churned += before.mrr_cents;
    else if (wasPaying && isPaying) {
      const delta = after.mrr_cents - before.mrr_cents;
      if (delta > 0) expansion += delta;
      else contraction -= delta;
    }
  }
  return {
    new_cents: fresh,
    expansion_cents: expansion,
    contraction_cents: contraction,
    churned_cents: churned,
    net_new_cents: fresh + expansion - contraction - churned,
  };
}

/**
 * Customer churn rate: subscriptions paying at the range start that are not
 * paying at its end, over subscriptions paying at the start. Revenue churn
 * rate: churned MRR over MRR at the range start. Comparing the two snapshots
 * means a subscription that ended and was reactivated inside the range has not
 * churned, which keeps the customer figure consistent with churned MRR.
 */
export function computeChurn(start: RevenueSnapshot, end: RevenueSnapshot, movements: MrrMovements): { customer: RateCell; revenue: RateCell } {
  let churnedSubscriptions = 0;
  for (const [id, before] of start.subscriptions) {
    if (before.status !== "active") continue;
    if (end.subscriptions.get(id)?.status !== "active") churnedSubscriptions += 1;
  }
  return {
    customer: rateCell(churnedSubscriptions, start.active_paid),
    revenue: rateCell(movements.churned_cents, start.mrr_cents),
  };
}

/**
 * Trial conversion, cohorted by trial start: trials started in
 * `[startMs, endMs)`, converted when the same subscription has a paid row
 * between the start and the window's close (period end plus `GRACE_DAYS`, or
 * `TRIAL_FALLBACK_WINDOW_DAYS` after the start without a period end). A trial
 * that has not converted, has not expired or been refunded, and whose window
 * is still open at `nowMs` is pending and left out of the denominator.
 */
export function computeTrialConversion(
  ledger: SubscriptionLedger,
  bounds: { startMs: number; endMs: number; nowMs: number },
): TrialConversion {
  let started = 0;
  let converted = 0;
  let pending = 0;
  const inRange = (at: number) => at >= bounds.startMs && at < bounds.endMs;

  for (const rows of ledger.bySubscription.values()) {
    rows.forEach((trial, i) => {
      if (trial.type !== "trial_started" || !inRange(trial.at)) return;
      started += 1;
      const close = trialCloseMs(trial);
      let outcome: "converted" | "ended" | null = null;
      for (let j = i + 1; j < rows.length && outcome === null; j += 1) {
        const row = rows[j];
        if (row.at > bounds.nowMs || row.at > close) break;
        if (isPaidEventType(row.type)) outcome = "converted";
        else if (row.type === "expired" || row.type === "refunded") outcome = "ended";
      }
      if (outcome === "converted") converted += 1;
      else if (outcome === null && bounds.nowMs < close) pending += 1;
    });
  }
  for (const at of ledger.unlinkedTrials) {
    if (!inRange(at)) continue;
    started += 1;
    if (bounds.nowMs < at + TRIAL_FALLBACK_WINDOW_DAYS * DAY_MS) pending += 1;
  }
  return { started, converted, pending, cell: settledRateCell(converted, started - pending, pending) };
}

// ── Range totals ─────────────────────────────────────────────────────────────

export interface RevenueTotalsSummary {
  totals: RevenueTotals;
  event_counts: Record<RevenueEventType, number>;
  /** More than one non-null currency appeared. */
  mixed_currencies: boolean;
}

/** Gross (positive amounts), refunds (negative amounts, as a positive number), net, and counts per type. */
export function summarizeRevenueTotals(rows: RevenueTotalsRow[]): RevenueTotalsSummary {
  const event_counts = Object.fromEntries(REVENUE_EVENT_TYPES.map((type) => [type, 0])) as Record<RevenueEventType, number>;
  const currencies = new Set<string>();
  let gross = 0;
  let refunds = 0;
  for (const row of rows) {
    if (row.event_type in event_counts) event_counts[row.event_type as RevenueEventType] += row.events;
    if (row.currency !== null) currencies.add(row.currency.toLowerCase());
    gross += row.gross_cents;
    refunds += row.refunds_cents;
  }
  return {
    totals: { gross_cents: gross, refunds_cents: refunds, net_cents: gross - refunds },
    event_counts,
    mixed_currencies: currencies.size > 1,
  };
}

/** Counts sorted by count, then key. */
export function sortCounts(rows: CountByKey[]): CountByKey[] {
  return [...rows].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const REVENUE_NOTES: readonly string[] = [
  NOTES.revenueGross,
  NOTES.revenueProduction,
  NOTES.revenueOneTime,
  NOTES.revenueActive,
  NOTES.trialPending,
];
