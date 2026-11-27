import { toCsv, type RateCell, type RetentionReport } from "../../metrics";
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
