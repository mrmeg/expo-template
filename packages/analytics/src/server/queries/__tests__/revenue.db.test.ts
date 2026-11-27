import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getOverviewReport, getRevenueReport } from "../reports";
import { deps, insertRevenue, insertUsers, installTables, type RevenueSeed } from "./seed";

const RANGE = { from: "2026-09-15", to: "2026-11-26" };

function period(type: string, sub: string, user: string, start: string, end: string, amount: number): RevenueSeed {
  return { type, sub, user, at: start, periodStart: start, periodEnd: end, amount };
}

describeDb("revenue report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [{ user: "ex", firstSeen: "2026-01-01T00:00:00Z", excluded: true }]);
    await insertRevenue(ctx.sql, names, [
      // Yearly plan: 12000 a year is 1000 a month throughout. A cancellation keeps it paying to the period end.
      period("purchased", "Y", "y", "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z", 12000),
      { type: "cancel_scheduled", sub: "Y", user: "y", at: "2026-11-15T00:00:00Z" },
      // Monthly plan, refunded after its last renewal.
      period("purchased", "M", "m", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", 999),
      period("renewed", "M", "m", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", 999),
      period("renewed", "M", "m", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", 999),
      { type: "cancel_scheduled", sub: "M", user: "m", at: "2026-11-10T00:00:00Z", cancelReason: "CUSTOMER_SUPPORT" },
      { type: "refunded", sub: "M", user: "m", at: "2026-11-10T00:00:00Z", amount: -999 },
      // Weekly plan: 300 a week is 1300 a month.
      period("purchased", "W", "w", "2026-11-20T00:00:00Z", "2026-11-27T00:00:00Z", 300),
      // A trial still open at the end: pending.
      { type: "trial_started", sub: "T", user: "t", at: "2026-11-20T00:00:00Z", periodEnd: "2026-11-27T00:00:00Z", amount: 0 },
      // A converted trial that later expires.
      { type: "trial_started", sub: "T2", user: "t2", at: "2026-10-05T00:00:00Z", periodEnd: "2026-10-12T00:00:00Z", amount: 0 },
      period("trial_converted", "T2", "t2", "2026-10-12T00:00:00Z", "2026-11-12T00:00:00Z", 999),
      { type: "expired", sub: "T2", user: "t2", at: "2026-11-12T00:00:00Z" },
      // A trial that lapses.
      { type: "trial_started", sub: "T3", user: "t3", at: "2026-10-10T00:00:00Z", periodEnd: "2026-10-17T00:00:00Z", amount: 0 },
      { type: "expired", sub: "T3", user: "t3", at: "2026-10-17T00:00:00Z" },
      // A trial that lapses without an expiry row, started just before the range in UTC.
      { type: "trial_started", sub: "T4", user: "t4", at: "2026-09-14T20:00:00Z", periodEnd: "2026-09-21T20:00:00Z", amount: 0 },
      // One-time purchase: revenue, never MRR.
      { type: "purchased", user: "l", at: "2026-10-15T00:00:00Z", amount: 4999 },
      // Reactivation after expiry, at a higher price.
      period("purchased", "R", "r", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z", 999),
      { type: "expired", sub: "R", user: "r", at: "2026-09-01T00:00:00Z" },
      period("purchased", "R", "r", "2026-11-05T00:00:00Z", "2026-12-05T00:00:00Z", 1999),
      { type: "reactivated", sub: "R", user: "r", at: "2026-11-05T00:00:00Z" },
      // Sandbox and excluded users never count.
      { ...period("purchased", "SB", "s", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", 5000), environment: "sandbox" },
      period("purchased", "EX", "ex", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", 7000),
    ]);
  });

  it("computes MRR at the range start, the end and each month end", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names), RANGE);
    expect(report.mrr.at_range_start_cents).toBe(1000 + 999);
    expect(report.mrr.current_cents).toBe(1000 + 1300 + 1999);
    expect(report.mrr.month_ends).toEqual([
      { date: "2026-09-30", mrr_cents: 1000 + 999 },
      { date: "2026-10-31", mrr_cents: 1000 + 999 + 999 },
    ]);
    expect(report.mrr.movements).toEqual({
      new_cents: 1300 + 1999,
      expansion_cents: 0,
      contraction_cents: 0,
      churned_cents: 999,
      net_new_cents: 1300 + 1999 - 999,
    });
  });

  it("counts subscriptions, trial conversion and churn", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names), RANGE);
    expect(report.subscriptions).toEqual({ active_paid: 3, active_trials: 1, paid_at_range_start: 2 });
    expect(report.trial_conversion).toEqual({
      started: 3,
      converted: 1,
      pending: 1,
      cell: { numerator: 1, denominator: 2, rate: 0.5, status: "measured" },
    });
    expect(report.churn.customer).toEqual({ numerator: 1, denominator: 2, rate: 0.5, status: "measured" });
    expect(report.churn.revenue).toEqual({ numerator: 999, denominator: 1999, rate: 999 / 1999, status: "measured" });
  });

  it("totals revenue in the range without sandbox or excluded rows", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names), RANGE);
    expect(report.revenue).toEqual({
      gross_cents: 999 + 999 + 300 + 999 + 4999 + 1999,
      refunds_cents: 999,
      refunds_reversed_cents: 0,
      net_cents: 999 + 300 + 999 + 4999 + 1999,
    });
    expect(report.currency).toBe("USD");
    expect(report.currencies).toEqual(["USD"]);
    expect(report.mrr.by_currency).toEqual([{ currency: "USD", current_cents: 1000 + 1300 + 1999 }]);
    expect(report.notes.some((note) => note.includes("combine"))).toBe(false);
    expect(report.event_counts).toEqual({
      trial_started: 3,
      trial_converted: 1,
      purchased: 3,
      renewed: 2,
      cancel_scheduled: 2,
      uncanceled: 0,
      expired: 2,
      billing_issue: 0,
      refunded: 1,
      refund_reversed: 0,
      product_changed: 0,
      reactivated: 1,
    });
    expect(report.cancellations_by_reason).toEqual([{ key: "CUSTOMER_SUPPORT", count: 1 }, { key: "unknown", count: 1 }]);
    expect(report.notes).toContain("Revenue is gross of App Store, Play Store and payment processor fees.");
  });

  it("cuts the range in the configured zone", async () => {
    // T4 started at 2026-09-14T20:00Z: the day before the range in UTC, 2026-09-15 05:00 in Tokyo.
    const utc = await getRevenueReport(deps(ctx.sql, names), RANGE);
    const tokyo = await getRevenueReport(deps(ctx.sql, names, { timezone: "Asia/Tokyo" }), RANGE);
    expect(utc.trial_conversion.started).toBe(3);
    expect(tokyo.range.timezone).toBe("Asia/Tokyo");
    expect(tokyo.trial_conversion).toMatchObject({ started: 4, converted: 1, pending: 1 });
    expect(tokyo.event_counts.trial_started).toBe(4);
  });
});

describeDb("revenue report: currencies", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    // Two annual plans bought before the range, in different currencies; nothing happens inside it.
    await insertRevenue(ctx.sql, names, [
      { ...period("purchased", "US", "a", "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z", 12000), currency: "usd" },
      { ...period("purchased", "EU", "b", "2026-03-01T00:00:00Z", "2027-03-01T00:00:00Z", 24000), currency: "eur" },
    ]);
  });

  it("never reports a mixed MRR as one currency, wherever in time the rows fall", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-26" });
    expect(report.mrr.current_cents).toBe(3000);
    expect(report.currency).toBeNull();
    expect(report.currencies).toEqual(["EUR", "USD"]);
    expect(report.mrr.by_currency).toEqual([
      { currency: "EUR", current_cents: 2000 },
      { currency: "USD", current_cents: 1000 },
    ]);
    expect(report.notes).toContain(
      "Money figures here combine EUR, USD: amounts are added as recorded, never converted, so read the per-currency MRR instead of a combined total.",
    );
    const overview = await getOverviewReport(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-26" });
    expect(overview.revenue).toMatchObject({
      currency: null,
      currencies: ["EUR", "USD"],
      mrr_by_currency: [{ currency: "EUR", current_cents: 2000 }, { currency: "USD", current_cents: 1000 }],
    });
    expect(overview.notes.some((note) => note.startsWith("Money figures here combine EUR, USD"))).toBe(true);
  });

  it("names the one currency when only one is involved", async () => {
    await insertRevenue(ctx.sql, names, [{ type: "purchased", user: "c", at: "2026-01-10T00:00:00Z", amount: 500, currency: "gbp" }]);
    // January: only the one-time GBP purchase has money in the range, but both plans pay MRR.
    const january = await getRevenueReport(deps(ctx.sql, names), { from: "2026-01-01", to: "2026-01-31" });
    expect(january).toMatchObject({ currency: "GBP", currencies: ["GBP"], revenue: { gross_cents: 500 } });
    expect(january.mrr.current_cents).toBe(0);
  });
});

describeDb("revenue report: refund reversals", (ctx) => {
  let names: Names;
  const RANGE_NOV = { from: "2026-11-01", to: "2026-11-26" };

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertRevenue(ctx.sql, names, [
      // Refunded, then the refund reversed with no amount (what @mrmeg/expo-purchases writes).
      period("purchased", "S", "u", "2026-11-02T00:00:00Z", "2026-12-02T00:00:00Z", 1000),
      { type: "refunded", sub: "S", user: "u", at: "2026-11-05T00:00:00Z", amount: -1000 },
      { type: "refund_reversed", sub: "S", user: "u", at: "2026-11-08T00:00:00Z" },
      // A one-time purchase with no subscription: matched on its provider_event_id.
      { type: "purchased", user: "o", at: "2026-11-03T00:00:00Z", amount: 700, providerEventId: "order-1" },
      { type: "refunded", user: "o", at: "2026-11-04T00:00:00Z", amount: -700, providerEventId: "order-1" },
      { type: "refund_reversed", user: "o", at: "2026-11-06T00:00:00Z", providerEventId: "order-1" },
      // Refunded in October, reversed in November with its own amount.
      period("purchased", "R", "r", "2026-10-02T00:00:00Z", "2026-11-02T00:00:00Z", 400),
      { type: "refunded", sub: "R", user: "r", at: "2026-10-10T00:00:00Z", amount: -400 },
      { type: "refund_reversed", sub: "R", user: "r", at: "2026-11-10T00:00:00Z", amount: 400 },
    ]);
  });

  it("restores the refunded amount, so revenue agrees with MRR", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names), RANGE_NOV);
    expect(report.mrr.current_cents).toBe(1000);
    expect(report.revenue).toEqual({
      gross_cents: 1000 + 700,
      refunds_cents: 1000 + 700 - (1000 + 700 + 400),
      refunds_reversed_cents: 1000 + 700 + 400,
      net_cents: 1000 + 700 + 400,
    });
    expect(report.event_counts).toMatchObject({ refunded: 2, refund_reversed: 3 });
    const october = await getRevenueReport(deps(ctx.sql, names), { from: "2026-10-01", to: "2026-10-31" });
    expect(october.revenue).toEqual({ gross_cents: 400, refunds_cents: 400, refunds_reversed_cents: 0, net_cents: 0 });
  });
});

describeDb("revenue report: snapshots never pass now", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    // Period ended 2026-11-25T13:00Z; the 2-day grace runs to 11-27T13:00Z, past now (12:00) but before the day ends.
    await insertRevenue(ctx.sql, names, [period("purchased", "G", "g", "2026-10-25T13:00:00Z", "2026-11-25T13:00:00Z", 999)]);
  });

  it("counts a subscription still in its grace period now as paying", async () => {
    const report = await getRevenueReport(deps(ctx.sql, names));
    expect(report.range.to).toBe("2026-11-27");
    expect(report.mrr.current_cents).toBe(999);
    expect(report.subscriptions.active_paid).toBe(1);
    expect(report.mrr.movements.churned_cents).toBe(0);
    expect(report.churn.customer.numerator).toBe(0);
    // A month end still to come is taken now too.
    const month = await getRevenueReport(deps(ctx.sql, names), { from: "2026-11-01", to: "2026-11-30" });
    expect(month.mrr.month_ends).toEqual([{ date: "2026-11-30", mrr_cents: 999 }]);
    const overview = await getOverviewReport(deps(ctx.sql, names));
    expect(overview.revenue.mrr_cents.current).toBe(999);
  });
});
