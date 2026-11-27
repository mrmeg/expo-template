import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getRevenueReport } from "../reports";
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
    expect(report.revenue).toEqual({ gross_cents: 999 + 999 + 300 + 999 + 4999 + 1999, refunds_cents: 999, net_cents: 999 + 300 + 999 + 4999 + 1999 });
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
