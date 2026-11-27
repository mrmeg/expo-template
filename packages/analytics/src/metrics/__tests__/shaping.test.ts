import { computeChannelFunnel, signupsByChannel } from "../acquisition";
import { CSV_BOM, csvField, toCsv } from "../csv";
import { resolveMetricsConfig, settledRateCell, rateCell } from "../definitions";
import { formatCents, formatDuration, formatPercent, formatRateCell, relativeChange } from "../format";
import { computeWebTotals, fillWebSeries, groupBreakdowns } from "../web";

describe("rate cells", () => {
  it("distinguishes measured, not yet and empty", () => {
    expect(rateCell(1, 4)).toEqual({ numerator: 1, denominator: 4, rate: 0.25, status: "measured" });
    expect(rateCell(1, 4, false)).toEqual({ numerator: 1, denominator: 4, rate: null, status: "not_yet" });
    expect(rateCell(0, 0, false).status).toBe("empty");
    expect(settledRateCell(0, 0, 3).status).toBe("not_yet");
    expect(settledRateCell(0, 0, 0).status).toBe("empty");
    expect(settledRateCell(1, 2, 5).rate).toBe(0.5);
  });
});

describe("resolveMetricsConfig", () => {
  it("applies defaults", () => {
    expect(resolveMetricsConfig()).toEqual({ timezone: "UTC", activation: null, activeEvents: null, retentionDays: [1, 7, 30, 90], funnels: [] });
    const config = resolveMetricsConfig({
      activation: { event: "project_created" },
      retentionDays: [30, 1, 30],
      funnels: [{ key: "f", name: "F", steps: ["a", "b"] }],
    });
    expect(config.activation).toEqual({ event: "project_created", withinDays: 7 });
    expect(config.retentionDays).toEqual([1, 30]);
    expect(config.funnels[0].windowDays).toBe(7);
  });

  it("rejects unusable values", () => {
    expect(() => resolveMetricsConfig({ retentionDays: [1.5] })).toThrow(/retentionDays/);
    expect(() => resolveMetricsConfig({ funnels: [{ key: "f", name: "F", steps: [] }] })).toThrow(/no steps/);
  });
});

describe("computeChannelFunnel", () => {
  it("merges cohorts and clicks per channel", () => {
    const rows = computeChannelFunnel({
      cohorts: [
        { channel: "tiktok", signups: 5, activated: 3, pending: 1, trial_started: 2, paid: 1 },
        { channel: "unknown", signups: 2, activated: 0, pending: 0, trial_started: 0, paid: 0 },
      ],
      linkClicks: [{ key: "tiktok", count: 40 }, { key: "podcast", count: 3 }],
      activationConfigured: true,
    });
    expect(rows).toEqual([
      { channel: "tiktok", link_clicks: 40, signups: 5, activated: 3, trial_started: 2, paid: 1 },
      { channel: "unknown", link_clicks: 0, signups: 2, activated: 0, trial_started: 0, paid: 0 },
      { channel: "podcast", link_clicks: 3, signups: 0, activated: 0, trial_started: 0, paid: 0 },
    ]);
  });

  it("reports activation as null when it is not configured", () => {
    const rows = computeChannelFunnel({
      cohorts: [{ channel: "a", signups: 1, activated: 0, pending: 0, trial_started: 0, paid: 0 }],
      linkClicks: [],
      activationConfigured: false,
    });
    expect(rows[0].activated).toBeNull();
    expect(signupsByChannel([
      { channel: "b", signups: 1, activated: 0, pending: 0, trial_started: 0, paid: 0 },
      { channel: "a", signups: 1, activated: 0, pending: 0, trial_started: 0, paid: 0 },
      { channel: "c", signups: 3, activated: 0, pending: 0, trial_started: 0, paid: 0 },
    ])).toEqual([{ key: "c", count: 3 }, { key: "a", count: 1 }, { key: "b", count: 1 }]);
  });
});

describe("web shaping", () => {
  it("derives views per visit, bounce rate and duration", () => {
    expect(computeWebTotals({ visitors: 3, visits: 4, pageviews: 10, bounces: 1, avg_visit_seconds: 42.5 })).toEqual({
      visitors: 3,
      visits: 4,
      pageviews: 10,
      views_per_visit: 2.5,
      bounce_rate: { numerator: 1, denominator: 4, rate: 0.25, status: "measured" },
      avg_visit_seconds: 42.5,
    });
    expect(computeWebTotals(undefined)).toMatchObject({ visits: 0, views_per_visit: null, avg_visit_seconds: null, bounce_rate: { status: "empty" } });
  });

  it("fills missing days and cuts breakdowns to the top 20", () => {
    const series = fillWebSeries([{ date: "2026-11-02", visitors: 1, visits: 1, pageviews: 2 }], { from: "2026-11-01", to: "2026-11-03" });
    expect(series.map((p) => p.pageviews)).toEqual([0, 2, 0]);
    const rows = Array.from({ length: 25 }, (_, i) => ({ dimension: "pages", key: `/p${i}`, visitors: i, pageviews: i }));
    const grouped = groupBreakdowns([...rows, { dimension: "referrers", key: "Direct", visitors: 1, pageviews: 1 }, { dimension: "bogus", key: "x", visitors: 9, pageviews: 9 }]);
    expect(grouped.pages).toHaveLength(20);
    expect(grouped.pages[0]).toEqual({ key: "/p24", visitors: 24, pageviews: 24 });
    expect(grouped.referrers).toEqual([{ key: "Direct", visitors: 1, pageviews: 1 }]);
    expect(grouped.countries).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes per RFC 4180 and ends records with CRLF", () => {
    const csv = toCsv([{ a: "x,y", b: "say \"hi\"", c: "line\nbreak", d: null }], ["a", "b", "c", "d"]);
    expect(csv).toBe(`${CSV_BOM}a,b,c,d\r\n"x,y","say ""hi""","line\nbreak",\r\n`);
  });

  it("guards formula cells but leaves numbers alone", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("@user")).toBe("'@user");
    expect(csvField("=a,b")).toBe("\"'=a,b\"");
    expect(csvField(-500)).toBe("-500");
    expect(csvField(new Date("2026-11-27T00:00:00Z"))).toBe("2026-11-27T00:00:00.000Z");
    expect(csvField({ k: 1 })).toBe("\"{\"\"k\"\":1}\"");
  });
});

describe("format", () => {
  it("formats rates, money and durations", () => {
    expect(formatPercent(0.274)).toBe("27%");
    expect(formatRateCell({ numerator: 1, denominator: 3, rate: 1 / 3, status: "measured" }, 1)).toBe("33.3%");
    expect(formatRateCell({ numerator: 0, denominator: 3, rate: null, status: "not_yet" })).toBe("Not yet");
    expect(formatRateCell({ numerator: 0, denominator: 0, rate: null, status: "empty" })).toBe("No data");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(185)).toBe("3m 05s");
    expect(formatDuration(7440)).toBe("2h 04m");
    expect(formatDuration(null)).toBe("No data");
    expect(relativeChange(120, 100)).toBeCloseTo(0.2);
    expect(relativeChange(1, 0)).toBeNull();
  });
});
