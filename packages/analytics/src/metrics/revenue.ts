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
 * add up exactly. Each subscription's MRR is in its latest paid row's
 * currency; amounts in different currencies are never converted, so every
 * total also comes split by currency and the report says when it is mixed.
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
  CurrencyInfo,
  CurrencyMrr,
  LedgerRow,
  RefundRow,
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

// ── Currencies ───────────────────────────────────────────────────────────────

/** ISO 4217's "no currency" code, for ledger rows that recorded none. */
export const UNKNOWN_CURRENCY = "XXX";

/** A ledger currency as an upper-case ISO code; `XXX` when missing. */
export function normalizeCurrency(value: string | null | undefined): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return code.length > 0 ? code : UNKNOWN_CURRENCY;
}

function addTo(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/** Per-currency amounts, largest first, then by code. */
export function currencyBreakdown(byCurrency: Map<string, number>): CurrencyMrr[] {
  return [...byCurrency]
    .map(([currency, current_cents]) => ({ currency, current_cents }))
    .sort((a, b) => b.current_cents - a.current_cents || a.currency.localeCompare(b.currency));
}

/**
 * The currencies a report's money figures involve, ordered by current MRR,
 * then MRR at the start, then code; `currency` is the single one, or null when
 * there is more than one. `others` are currencies that contribute to a figure
 * but not to either MRR snapshot (month ends, revenue in the range).
 */
export function summarizeCurrencies(input: {
  current: Map<string, number>;
  start: Map<string, number>;
  others: Iterable<string>;
}): CurrencyInfo {
  const all = new Set<string>([...input.current.keys(), ...input.start.keys(), ...input.others]);
  const currencies = [...all].sort(
    (a, b) =>
      (input.current.get(b) ?? 0) - (input.current.get(a) ?? 0) ||
      (input.start.get(b) ?? 0) - (input.start.get(a) ?? 0) ||
      a.localeCompare(b),
  );
  return { currency: currencies.length === 1 ? currencies[0] : null, currencies };
}

// ── Replay ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = "trialing" | "active" | "ended";

export interface SubscriptionState {
  id: string;
  user_id: string | null;
  status: SubscriptionStatus;
  /** Whole cents; 0 unless `active`. */
  mrr_cents: number;
  /** The latest paid row's currency (normalized); for a trial, its own row's. */
  currency: string;
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
  currency: string;
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
      currency: normalizeCurrency(row.currency),
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
  let currency = UNKNOWN_CURRENCY;

  for (const row of rows) {
    if (row.at >= asOfMs) break;
    if (row.user_id !== null) userId = row.user_id;
    if (row.type === "trial_started") {
      if (phase !== "paid") {
        phase = "trialing";
        trialClose = trialCloseMs(row);
        beforeRefund = null;
        currency = row.currency;
      }
    } else if (isPaidEventType(row.type)) {
      if (row.periodEnd === null) continue; // one-time purchase
      phase = "paid";
      paid = row;
      beforeRefund = null;
      currency = row.currency;
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
    return { id, user_id: userId, status: asOfMs < trialClose ? "trialing" : "ended", mrr_cents: 0, currency };
  }
  if (phase === "paid" && paid !== null && paid.periodEnd !== null && asOfMs < paid.periodEnd + GRACE_DAYS * DAY_MS) {
    const periodDays = (paid.periodEnd - (paid.periodStart ?? paid.at)) / DAY_MS;
    const monthly = paid.amount === null ? 0 : monthlyAmount(paid.amount, periodDays) ?? 0;
    return { id, user_id: userId, status: "active", mrr_cents: Math.round(monthly), currency };
  }
  return { id, user_id: userId, status: "ended", mrr_cents: 0, currency };
}

export interface RevenueSnapshot {
  mrr_cents: number;
  active_paid: number;
  active_trials: number;
  /** MRR per currency, with an entry for every currency an active subscription is in. */
  mrr_by_currency: Map<string, number>;
  /** Every subscription with a state at the instant. */
  subscriptions: Map<string, SubscriptionState>;
}

/** Every subscription's state, MRR, and the active counts at `asOfMs`. */
export function revenueSnapshot(ledger: SubscriptionLedger, asOfMs: number): RevenueSnapshot {
  const subscriptions = new Map<string, SubscriptionState>();
  let mrr = 0;
  let activePaid = 0;
  let activeTrials = 0;
  const byCurrency = new Map<string, number>();
  for (const [id, rows] of ledger.bySubscription) {
    const state = replaySubscription(id, rows, asOfMs);
    if (!state) continue;
    subscriptions.set(id, state);
    if (state.status === "active") {
      activePaid += 1;
      mrr += state.mrr_cents;
      addTo(byCurrency, state.currency, state.mrr_cents);
    } else if (state.status === "trialing") {
      activeTrials += 1;
    }
  }
  return { mrr_cents: mrr, active_paid: activePaid, active_trials: activeTrials, mrr_by_currency: byCurrency, subscriptions };
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

/**
 * Amounts restored by `refund_reversed` rows inside the range, per currency.
 * Rows are replayed per lineage (subscription id, else `provider_event_id`) in
 * time order, refunds before reversals at one instant. Each reversal cancels
 * the most recent refund before it that no earlier reversal cancelled: it
 * restores its own amount when it has one (in its own currency), else the
 * refunded amount (in the refund's currency), else nothing. A reversal whose
 * refund fell before the range still counts, inside the range, where it
 * happened.
 */
export function computeRefundReversals(rows: RefundRow[]): Map<string, number> {
  const byLineage = new Map<string, { row: RefundRow; at: number; reversal: boolean }[]>();
  for (const row of rows) {
    if (row.event_type !== "refunded" && row.event_type !== "refund_reversed") continue;
    const list = byLineage.get(row.lineage) ?? [];
    list.push({ row, at: Date.parse(row.occurred_at), reversal: row.event_type === "refund_reversed" });
    byLineage.set(row.lineage, list);
  }
  const restored = new Map<string, number>();
  for (const list of byLineage.values()) {
    list.sort((a, b) => a.at - b.at || Number(a.reversal) - Number(b.reversal));
    const open: RefundRow[] = [];
    for (const entry of list) {
      if (!entry.reversal) {
        open.push(entry.row);
        continue;
      }
      const refund = open.pop();
      if (!entry.row.in_range) continue;
      if (entry.row.amount_cents !== null && entry.row.amount_cents !== 0) {
        addTo(restored, normalizeCurrency(entry.row.currency), Math.abs(entry.row.amount_cents));
      } else if (refund && refund.amount_cents !== null) {
        addTo(restored, normalizeCurrency(refund.currency), Math.abs(refund.amount_cents));
      }
    }
  }
  return restored;
}

export interface RevenueTotalsSummary {
  totals: RevenueTotals;
  event_counts: Record<RevenueEventType, number>;
  /** Net revenue per currency, for every currency with money in the range. */
  net_by_currency: Map<string, number>;
}

/**
 * Gross (positive amounts), refunds net of reversals, the reversed amount, net,
 * and counts per type. `refund_reversed` rows add to neither gross nor
 * refunds: their effect is `reversed`, from `computeRefundReversals`.
 */
export function summarizeRevenueTotals(rows: RevenueTotalsRow[], reversed: Map<string, number> = new Map()): RevenueTotalsSummary {
  const event_counts = Object.fromEntries(REVENUE_EVENT_TYPES.map((type) => [type, 0])) as Record<RevenueEventType, number>;
  const net = new Map<string, number>();
  let gross = 0;
  let refunds = 0;
  for (const row of rows) {
    if (row.event_type in event_counts) event_counts[row.event_type as RevenueEventType] += row.events;
    if (row.event_type === "refund_reversed") continue;
    if (row.gross_cents === 0 && row.refunds_cents === 0) continue;
    gross += row.gross_cents;
    refunds += row.refunds_cents;
    addTo(net, normalizeCurrency(row.currency), row.gross_cents - row.refunds_cents);
  }
  let restored = 0;
  for (const [currency, amount] of reversed) {
    restored += amount;
    addTo(net, currency, amount);
  }
  const refundsNet = refunds - restored;
  return {
    totals: { gross_cents: gross, refunds_cents: refundsNet, refunds_reversed_cents: restored, net_cents: gross - refundsNet },
    event_counts,
    net_by_currency: net,
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
  NOTES.revenueNow,
];
