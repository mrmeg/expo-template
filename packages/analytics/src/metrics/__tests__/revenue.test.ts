import {
  computeChurn,
  computeRefundReversals,
  currencyBreakdown,
  normalizeCurrency,
  summarizeCurrencies,
  computeTrialConversion,
  indexLedger,
  monthlyAmount,
  mrrMovements,
  replaySubscription,
  revenueSnapshot,
  summarizeRevenueTotals,
} from "../revenue";
import type { LedgerRow, RefundRow } from "../types";

function row(
  sub: string | null,
  event_type: string,
  occurred_at: string,
  extra: Partial<Omit<LedgerRow, "provider_subscription_id" | "event_type" | "occurred_at">> = {},
): LedgerRow {
  return {
    provider_subscription_id: sub,
    user_id: "u1",
    event_type,
    occurred_at,
    period_start: null,
    period_end: null,
    amount_cents: null,
    currency: "usd",
    ...extra,
  };
}

/** A paid row for the period [start, end). */
function paid(sub: string, type: string, start: string, end: string, amount: number, user = "u1"): LedgerRow {
  return row(sub, type, start, { period_start: start, period_end: end, amount_cents: amount, user_id: user });
}

const at = (iso: string) => Date.parse(iso);

function stateAt(rows: LedgerRow[], sub: string, iso: string) {
  const ledger = indexLedger(rows);
  return replaySubscription(sub, ledger.bySubscription.get(sub) ?? [], at(iso));
}

describe("monthlyAmount", () => {
  it("snaps standard plan lengths", () => {
    expect(monthlyAmount(1200, 7)).toBe(5200);
    expect(monthlyAmount(999, 28)).toBe(999);
    expect(monthlyAmount(999, 31)).toBe(999);
    expect(monthlyAmount(999, 30.96)).toBe(999); // a month across a DST change
    expect(monthlyAmount(3000, 92)).toBe(1000);
    expect(monthlyAmount(6000, 181)).toBe(1000);
    expect(monthlyAmount(12000, 365)).toBe(1000);
    expect(monthlyAmount(12000, 366)).toBe(1000);
  });

  it("prorates anything else and rejects empty periods", () => {
    expect(monthlyAmount(1400, 14)).toBeCloseTo((1400 * 365.25) / 12 / 14);
    expect(monthlyAmount(1000, 0)).toBeNull();
    expect(monthlyAmount(1000, -3)).toBeNull();
  });
});

describe("replaySubscription", () => {
  const trial = row("S", "trial_started", "2026-11-01T00:00:00Z", { amount_cents: 0, period_end: "2026-11-08T00:00:00Z" });
  const converted = paid("S", "trial_converted", "2026-11-08T00:00:00Z", "2026-12-08T00:00:00Z", 999);

  it("moves from trialing to active on conversion", () => {
    expect(stateAt([trial, converted], "S", "2026-11-05T00:00:00Z")).toMatchObject({ status: "trialing", mrr_cents: 0 });
    expect(stateAt([trial, converted], "S", "2026-11-09T00:00:00Z")).toMatchObject({ status: "active", mrr_cents: 999 });
    expect(stateAt([trial, converted], "S", "2026-10-30T00:00:00Z")).toBeNull();
  });

  it("ends a trial that lapses past its period end plus grace", () => {
    expect(stateAt([trial], "S", "2026-11-09T23:59:59Z")?.status).toBe("trialing");
    expect(stateAt([trial], "S", "2026-11-10T00:00:00Z")?.status).toBe("ended");
    const noEnd = row("T", "trial_started", "2026-11-01T00:00:00Z");
    expect(stateAt([noEnd], "T", "2026-11-14T23:00:00Z")?.status).toBe("trialing");
    expect(stateAt([noEnd], "T", "2026-11-15T00:00:00Z")?.status).toBe("ended");
  });

  it("keeps a cancelled subscription paying until its period ends, then ends it", () => {
    const rows = [converted, row("S", "cancel_scheduled", "2026-11-20T00:00:00Z")];
    expect(stateAt(rows, "S", "2026-12-01T00:00:00Z")?.status).toBe("active");
    expect(stateAt(rows, "S", "2026-12-09T23:00:00Z")?.status).toBe("active"); // inside the grace
    expect(stateAt(rows, "S", "2026-12-10T00:00:00Z")?.status).toBe("ended");
  });

  it("ends on expiry even before the period end", () => {
    const rows = [converted, row("S", "expired", "2026-11-20T00:00:00Z")];
    expect(stateAt(rows, "S", "2026-11-21T00:00:00Z")).toMatchObject({ status: "ended", mrr_cents: 0 });
  });

  it("ends on a refund after a renewal, and restores on refund_reversed", () => {
    const renewal = paid("S", "renewed", "2026-12-08T00:00:00Z", "2027-01-08T00:00:00Z", 999);
    const refund = row("S", "refunded", "2026-12-10T00:00:00Z", { amount_cents: -999 });
    const cancel = row("S", "cancel_scheduled", "2026-12-10T00:00:00Z");
    expect(stateAt([converted, renewal, cancel, refund], "S", "2026-12-11T00:00:00Z")?.status).toBe("ended");
    const reversed = row("S", "refund_reversed", "2026-12-15T00:00:00Z");
    expect(stateAt([converted, renewal, refund, reversed], "S", "2026-12-16T00:00:00Z")).toMatchObject({ status: "active", mrr_cents: 999 });
  });

  it("reactivates after expiry with a new paid period", () => {
    const rows = [
      converted,
      row("S", "expired", "2026-12-08T00:00:00Z"),
      paid("S", "purchased", "2027-02-01T00:00:00Z", "2028-02-01T00:00:00Z", 12000),
      row("S", "reactivated", "2027-02-01T00:00:00Z"),
    ];
    expect(stateAt(rows, "S", "2027-01-15T00:00:00Z")?.status).toBe("ended");
    expect(stateAt(rows, "S", "2027-02-02T00:00:00Z")).toMatchObject({ status: "active", mrr_cents: 1000 });
  });

  it("orders same-instant rows by type, not input order", () => {
    // Expiry and a re-purchase in one instant: the purchase replays first, so the expiry wins.
    const rows = [
      row("S", "expired", "2026-12-08T00:00:00Z"),
      paid("S", "renewed", "2026-12-08T00:00:00Z", "2027-01-08T00:00:00Z", 999),
    ];
    expect(stateAt([converted, ...rows], "S", "2026-12-09T00:00:00Z")?.status).toBe("ended");
  });

  it("treats a paid row with no period end as a one-time purchase", () => {
    const rows = [row("L", "purchased", "2026-11-01T00:00:00Z", { amount_cents: 4999 })];
    expect(stateAt(rows, "L", "2026-11-02T00:00:00Z")).toBeNull();
  });

  it("falls back to occurred_at when the period start is missing", () => {
    const rows = [row("W", "purchased", "2026-11-01T00:00:00Z", { amount_cents: 300, period_end: "2026-11-08T00:00:00Z" })];
    expect(stateAt(rows, "W", "2026-11-03T00:00:00Z")?.mrr_cents).toBe(1300);
  });
});

describe("revenueSnapshot and movements", () => {
  const rows: LedgerRow[] = [
    // Weekly plan, paying throughout: 300 a week is 1300 a month.
    paid("weekly", "purchased", "2026-10-28T00:00:00Z", "2026-11-04T00:00:00Z", 300, "w"),
    paid("weekly", "renewed", "2026-11-04T00:00:00Z", "2026-11-11T00:00:00Z", 300, "w"),
    paid("weekly", "renewed", "2026-11-11T00:00:00Z", "2026-11-18T00:00:00Z", 300, "w"),
    paid("weekly", "renewed", "2026-11-18T00:00:00Z", "2026-11-25T00:00:00Z", 300, "w"),
    paid("weekly", "renewed", "2026-11-25T00:00:00Z", "2026-12-02T00:00:00Z", 300, "w"),
    // Yearly plan bought before the range: 12000 a year is 1000 a month.
    paid("yearly", "purchased", "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z", 12000, "y"),
    // Monthly plan that upgrades from 999 to 1999 inside the range.
    paid("upgrade", "purchased", "2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z", 999, "g"),
    paid("upgrade", "renewed", "2026-11-15T00:00:00Z", "2026-12-15T00:00:00Z", 1999, "g"),
    // Monthly plan that churns inside the range.
    paid("churn", "purchased", "2026-10-10T00:00:00Z", "2026-11-10T00:00:00Z", 500, "c"),
    row("churn", "expired", "2026-11-10T00:00:00Z", { user_id: "c" }),
    // New monthly plan inside the range.
    paid("fresh", "purchased", "2026-11-20T00:00:00Z", "2026-12-20T00:00:00Z", 2000, "n"),
    // A trial running at the end.
    row("trial", "trial_started", "2026-11-28T00:00:00Z", { amount_cents: 0, period_end: "2026-12-05T00:00:00Z", user_id: "t" }),
    // One-time purchases: revenue, never MRR.
    row(null, "purchased", "2026-11-05T00:00:00Z", { amount_cents: 4999 }),
    row("lifetime", "purchased", "2026-11-06T00:00:00Z", { amount_cents: 9999 }),
  ];
  const ledger = indexLedger(rows);
  const start = revenueSnapshot(ledger, at("2026-11-01T00:00:00Z"));
  const end = revenueSnapshot(ledger, at("2026-12-01T00:00:00Z"));

  it("sums normalized MRR for active paid subscriptions, leaving out one-time purchases and trials", () => {
    expect(start).toMatchObject({ mrr_cents: 1300 + 1000 + 999 + 500, active_paid: 4, active_trials: 0 });
    expect(end).toMatchObject({ mrr_cents: 1300 + 1000 + 1999 + 2000, active_paid: 4, active_trials: 1 });
    expect(end.subscriptions.has("lifetime")).toBe(false);
  });

  it("splits the change into new, expansion, contraction and churn", () => {
    const movements = mrrMovements(start, end);
    expect(movements).toEqual({ new_cents: 2000, expansion_cents: 1000, contraction_cents: 0, churned_cents: 500, net_new_cents: 2500 });
    expect(movements.net_new_cents).toBe(end.mrr_cents - start.mrr_cents);
    const back = mrrMovements(end, start);
    expect(back.contraction_cents).toBe(1000);
    expect(back.net_new_cents).toBe(start.mrr_cents - end.mrr_cents);
  });

  it("computes customer and revenue churn against the start", () => {
    const churn = computeChurn(start, end, mrrMovements(start, end));
    expect(churn.customer).toEqual({ numerator: 1, denominator: 4, rate: 0.25, status: "measured" });
    expect(churn.revenue).toEqual({ numerator: 500, denominator: 3799, rate: 500 / 3799, status: "measured" });
  });

  it("is empty with no subscriptions", () => {
    const none = revenueSnapshot(indexLedger([]), at("2026-12-01T00:00:00Z"));
    expect(none).toMatchObject({ mrr_cents: 0, active_paid: 0, active_trials: 0 });
    const churn = computeChurn(none, none, mrrMovements(none, none));
    expect(churn.customer.status).toBe("empty");
    expect(churn.revenue.status).toBe("empty");
  });
});

describe("computeTrialConversion", () => {
  const bounds = { startMs: at("2026-11-01T00:00:00Z"), endMs: at("2026-12-01T00:00:00Z"), nowMs: at("2026-12-03T00:00:00Z") };
  const trial = (sub: string, start: string, periodEnd: string | null) =>
    row(sub, "trial_started", start, { amount_cents: 0, period_end: periodEnd });

  it("counts conversions inside the window and leaves open trials pending", () => {
    const rows = [
      trial("A", "2026-11-01T00:00:00Z", "2026-11-08T00:00:00Z"),
      paid("A", "trial_converted", "2026-11-08T01:00:00Z", "2026-12-08T00:00:00Z", 999),
      trial("B", "2026-11-05T00:00:00Z", "2026-11-12T00:00:00Z"), // lapsed
      trial("C", "2026-11-05T00:00:00Z", "2026-11-12T00:00:00Z"),
      paid("C", "trial_converted", "2026-11-15T00:00:00Z", "2026-12-15T00:00:00Z", 999), // after the window
      trial("D", "2026-11-28T00:00:00Z", "2026-12-05T00:00:00Z"), // still open: pending
      trial("E", "2026-11-28T00:00:00Z", "2026-12-05T00:00:00Z"),
      row("E", "expired", "2026-12-01T00:00:00Z"), // ended early: settled, not pending
      trial("F", "2026-11-25T00:00:00Z", null), // no period end: 14-day window, pending
      trial("OLD", "2026-10-25T00:00:00Z", "2026-11-01T00:00:00Z"),
      paid("OLD", "trial_converted", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", 999),
      row(null, "trial_started", "2026-11-10T00:00:00Z", { amount_cents: 0 }), // unlinked: matured, not converted
    ];
    const result = computeTrialConversion(indexLedger(rows), bounds);
    expect(result).toEqual({
      started: 7,
      converted: 1,
      pending: 2,
      cell: { numerator: 1, denominator: 5, rate: 0.2, status: "measured" },
    });
  });

  it("is not_yet while every trial is pending and empty without trials", () => {
    const rows = [trial("A", "2026-11-30T00:00:00Z", "2026-12-07T00:00:00Z")];
    expect(computeTrialConversion(indexLedger(rows), bounds).cell.status).toBe("not_yet");
    expect(computeTrialConversion(indexLedger([]), bounds).cell.status).toBe("empty");
  });
});

describe("summarizeRevenueTotals", () => {
  it("sums gross, refunds and net and fills every event type", () => {
    const summary = summarizeRevenueTotals([
      { event_type: "purchased", currency: "usd", events: 3, gross_cents: 3000, refunds_cents: 0 },
      { event_type: "renewed", currency: "USD", events: 2, gross_cents: 1998, refunds_cents: 0 },
      { event_type: "refunded", currency: "usd", events: 1, gross_cents: 0, refunds_cents: 999 },
      { event_type: "cancel_scheduled", currency: null, events: 4, gross_cents: 0, refunds_cents: 0 },
    ]);
    expect(summary.totals).toEqual({ gross_cents: 4998, refunds_cents: 999, refunds_reversed_cents: 0, net_cents: 3999 });
    expect(summary.event_counts).toMatchObject({ purchased: 3, renewed: 2, refunded: 1, cancel_scheduled: 4, expired: 0, reactivated: 0 });
    expect(Object.keys(summary.event_counts)).toHaveLength(12);
    // Only currencies that carry money are involved; the null-currency cancellation is not.
    expect([...summary.net_by_currency]).toEqual([["USD", 3999]]);
  });

  it("reports refunds net of reversals and never counts a reversal's own amount as gross", () => {
    const summary = summarizeRevenueTotals(
      [
        { event_type: "purchased", currency: "usd", events: 1, gross_cents: 1000, refunds_cents: 0 },
        { event_type: "refunded", currency: "usd", events: 1, gross_cents: 0, refunds_cents: 1000 },
        { event_type: "refund_reversed", currency: "usd", events: 1, gross_cents: 1000, refunds_cents: 0 },
      ],
      new Map([["USD", 1000]]),
    );
    expect(summary.totals).toEqual({ gross_cents: 1000, refunds_cents: 0, refunds_reversed_cents: 1000, net_cents: 1000 });
    expect(summary.event_counts.refund_reversed).toBe(1);
  });
});

describe("computeRefundReversals", () => {
  const refund = (lineage: string, at: string, amount: number | null, extra: Partial<RefundRow> = {}): RefundRow => ({
    lineage, event_type: "refunded", occurred_at: at, amount_cents: amount, currency: "usd", in_range: true, ...extra,
  });
  const reversal = (lineage: string, at: string, amount: number | null = null, extra: Partial<RefundRow> = {}): RefundRow => ({
    lineage, event_type: "refund_reversed", occurred_at: at, amount_cents: amount, currency: "usd", in_range: true, ...extra,
  });

  it("restores the refunded amount when the reversal carries none", () => {
    expect([...computeRefundReversals([refund("S", "2026-11-02T00:00:00Z", -1000), reversal("S", "2026-11-05T00:00:00Z")])]).toEqual([["USD", 1000]]);
  });

  it("uses the reversal's own amount when it has one", () => {
    expect([...computeRefundReversals([refund("S", "2026-11-02T00:00:00Z", -1000), reversal("S", "2026-11-05T00:00:00Z", 400)])]).toEqual([["USD", 400]]);
  });

  it("cancels the most recent unreversed refund, one reversal per refund", () => {
    const rows = [
      refund("S", "2026-11-01T00:00:00Z", -300),
      refund("S", "2026-11-02T00:00:00Z", -500),
      reversal("S", "2026-11-03T00:00:00Z"),
      reversal("S", "2026-11-04T00:00:00Z"),
      reversal("S", "2026-11-05T00:00:00Z"), // nothing left to reverse
      refund("OTHER", "2026-11-01T00:00:00Z", -9999),
    ];
    expect([...computeRefundReversals(rows)]).toEqual([["USD", 800]]);
  });

  it("matches a refund before the range and counts only reversals inside it", () => {
    const rows = [
      refund("S", "2026-10-02T00:00:00Z", -700, { in_range: false, currency: "eur" }),
      reversal("S", "2026-11-05T00:00:00Z", null, { currency: null }),
      refund("T", "2026-10-02T00:00:00Z", -100, { in_range: false }),
      reversal("T", "2026-10-05T00:00:00Z", null, { in_range: false }),
    ];
    expect([...computeRefundReversals(rows)]).toEqual([["EUR", 700]]);
  });

  it("orders a refund before a reversal at the same instant", () => {
    expect([...computeRefundReversals([reversal("S", "2026-11-02T00:00:00Z"), refund("S", "2026-11-02T00:00:00Z", -250)])]).toEqual([["USD", 250]]);
  });
});

describe("currencies", () => {
  it("normalizes codes and marks a missing one", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
    expect(normalizeCurrency(null)).toBe("XXX");
    expect(normalizeCurrency("")).toBe("XXX");
  });

  it("carries each subscription's currency into per-currency MRR", () => {
    const ledger = indexLedger([
      paid("U", "purchased", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z", 12000),
      { ...paid("E", "purchased", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z", 24000), currency: "eur" },
      { ...paid("N", "purchased", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", 500), currency: null },
    ]);
    const snapshot = revenueSnapshot(ledger, at("2026-01-15T00:00:00Z"));
    expect(snapshot.mrr_cents).toBe(1000 + 2000 + 500);
    expect(currencyBreakdown(snapshot.mrr_by_currency)).toEqual([
      { currency: "EUR", current_cents: 2000 },
      { currency: "USD", current_cents: 1000 },
      { currency: "XXX", current_cents: 500 },
    ]);
  });

  it("names the single currency, or null with every currency most MRR first", () => {
    expect(summarizeCurrencies({ current: new Map([["USD", 100]]), start: new Map(), others: ["USD"] })).toEqual({ currency: "USD", currencies: ["USD"] });
    expect(summarizeCurrencies({ current: new Map([["USD", 100], ["EUR", 300]]), start: new Map([["GBP", 50]]), others: ["JPY"] })).toEqual({
      currency: null,
      currencies: ["EUR", "USD", "GBP", "JPY"],
    });
    expect(summarizeCurrencies({ current: new Map(), start: new Map(), others: [] })).toEqual({ currency: null, currencies: [] });
  });
});
