import { toCsv, type RateCell, type RetentionReport, type RevenueReport } from "../../metrics";
import { CSV_TABLES, csvFilename, reportTable } from "../reportCsv";

const measured: RateCell = { numerator: 1, denominator: 4, rate: 0.25, status: "measured" };
const notYet: RateCell = { numerator: 0, denominator: 0, rate: null, status: "not_yet" };
const empty: RateCell = { numerator: 0, denominator: 0, rate: null, status: "empty" };

const retention: RetentionReport = {
  range: { from: "2026-11-01", to: "2026-11-02", days: 2, timezone: "UTC" },
  notes: [],
  days: [1],
  headline: [{ day: 1, mode: "on", cell: notYet, pending: 3 }],
  cohorts: [
    { cohort: "2026-11-01", size: 4, cells: [{ day: 1, mode: "on", cell: measured }] },
    { cohort: "2026-11-02", size: 0, cells: [{ day: 1, mode: "on", cell: empty }] },
  ],
  weekly: [{ cohort: "2026-10-26", label: "2026-W44", start: "2026-11-01", end: "2026-11-01", size: 4, weeks: [measured, notYet] }],
};

function revenueReport(currency: string | null, currencies: string[]): RevenueReport {
  const zero = { numerator: 0, denominator: 0, rate: null, status: "empty" as const };
  return {
    range: { from: "2026-11-01", to: "2026-11-30", days: 30, timezone: "UTC" },
    notes: [],
    currency,
    currencies,
    mrr: {
      current_cents: 3000,
      by_currency: [{ currency: "EUR", current_cents: 2000 }, { currency: "USD", current_cents: 1000 }].filter((part) => currencies.includes(part.currency)),
      at_range_start_cents: 3000,
      month_ends: [{ date: "2026-11-30", mrr_cents: 3000 }],
      movements: { new_cents: 0, expansion_cents: 0, contraction_cents: 0, churned_cents: 0, net_new_cents: 0 },
    },
    subscriptions: { active_paid: 2, active_trials: 0, paid_at_range_start: 2 },
    trial_conversion: { started: 0, converted: 0, pending: 0, cell: zero },
    churn: { customer: zero, revenue: zero },
    revenue: { gross_cents: 500, refunds_cents: 0, refunds_reversed_cents: 0, net_cents: 500 },
    event_counts: {
      trial_started: 0, trial_converted: 0, purchased: 1, renewed: 0, cancel_scheduled: 0, uncanceled: 0, expired: 0,
      billing_issue: 0, refunded: 0, refund_reversed: 0, product_changed: 0, reactivated: 0,
    },
    cancellations_by_reason: [],
  };
}

describe("revenue CSV currency", () => {
  it("labels money rows with the single currency", () => {
    const summary = reportTable("revenue", revenueReport("USD", ["USD"]));
    expect(summary.columns.at(-1)).toBe("currency");
    expect(summary.rows.filter((row) => row.metric === "mrr_cents")).toEqual([{ metric: "mrr_cents", value: 3000, currency: "USD" }]);
    expect(summary.rows.find((row) => row.metric === "refunds_reversed_cents")).toEqual({ metric: "refunds_reversed_cents", value: 0, currency: "USD" });
    expect(summary.rows.find((row) => row.metric === "active_paid")).toEqual({ metric: "active_paid", value: 2 });
    expect(reportTable("revenue", revenueReport("USD", ["USD"]), "mrr").rows).toEqual([{ date: "2026-11-30", mrr_cents: 3000, currency: "USD" }]);
  });

  it("marks mixed totals and adds one MRR row per currency", () => {
    const summary = reportTable("revenue", revenueReport(null, ["EUR", "USD"]));
    expect(summary.rows.filter((row) => row.metric === "mrr_cents")).toEqual([
      { metric: "mrr_cents", value: 3000, currency: "mixed" },
      { metric: "mrr_cents", value: 2000, currency: "EUR" },
      { metric: "mrr_cents", value: 1000, currency: "USD" },
    ]);
    expect(summary.rows.find((row) => row.metric === "gross_cents")?.currency).toBe("mixed");
    expect(reportTable("revenue", revenueReport(null, ["EUR", "USD"]), "mrr").rows[0].currency).toBe("mixed");
  });

  it("leaves the currency empty when there is no money", () => {
    const summary = reportTable("revenue", revenueReport(null, []));
    expect(summary.rows.find((row) => row.metric === "mrr_cents")?.currency).toBeNull();
  });
});

describe("report CSV tables", () => {
  it("keeps a rate's status next to it, so an open window never reads as a blank", () => {
    const weekly = reportTable("retention", retention);
    expect(toCsv(weekly.rows, weekly.columns).split("\r\n").slice(1, 3)).toEqual([
      "2026-10-26,2026-W44,2026-11-01,2026-11-01,4,0,1,4,0.25,measured",
      "2026-10-26,2026-W44,2026-11-01,2026-11-01,4,1,0,0,,not_yet",
    ]);
    const daily = reportTable("retention", retention, "daily");
    expect(daily.rows.map((row) => row.status)).toEqual(["measured", "empty"]);
    const headline = reportTable("retention", retention, "headline");
    expect(headline.rows).toEqual([{ day: 1, mode: "on", retained: 0, eligible: 0, rate: null, status: "not_yet", pending: 3 }]);
  });

  it("lists the default table first for every report", () => {
    expect(Object.fromEntries(Object.entries(CSV_TABLES).map(([name, tables]) => [name, tables[0]]))).toEqual({
      overview: "figures",
      product: "daily",
      retention: "weekly",
      funnels: "steps",
      acquisition: "channels",
      web: "daily",
      revenue: "summary",
    });
  });

  it("names the file after the report, a non-default table and the range", () => {
    expect(csvFilename("web", { from: "2026-10-01", to: "2026-10-31" })).toBe("analytics-web-2026-10-01_2026-10-31.csv");
    expect(csvFilename("web", { from: "2026-10-01", to: "2026-10-31" }, "utm_sources")).toBe("analytics-web-utm-sources-2026-10-01_2026-10-31.csv");
  });
});
