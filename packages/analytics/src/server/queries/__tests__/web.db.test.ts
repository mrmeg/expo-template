import { describeDb } from "../../../__tests__/dbHarness";
import type { Names } from "../../schema";
import { getWebReport } from "../reports";
import { deps, insertEvents, insertSessions, insertUsers, installTables } from "./seed";

const RANGE = { from: "2026-11-01", to: "2026-11-10" };

describeDb("web report", (ctx) => {
  let names: Names;

  beforeAll(async () => {
    names = await installTables(ctx.sql);
    await insertUsers(ctx.sql, names, [{ user: "staff", firstSeen: "2026-10-01T00:00:00Z", excluded: true }]);
    const desktop = { device: "desktop", browser: "Chrome", os: "macOS", country: "US" };
    await insertSessions(ctx.sql, names, [
      {
        id: "s1", anon: "v1", started: "2026-11-02T10:00:00Z", lastSeen: "2026-11-02T10:05:00Z", entry: "/", exit: "/pricing",
        pageviews: 3, referrer: "google.com", utmSource: "newsletter", utmCampaign: "fall", ...desktop,
      },
      { id: "s2", anon: "v1", started: "2026-11-03T10:00:00Z", entry: "/", exit: "/", pageviews: 1, ...desktop },
      {
        id: "s3", anon: "v2", started: "2026-11-03T12:00:00Z", lastSeen: "2026-11-03T12:01:00Z", entry: "/blog", exit: "/blog",
        pageviews: 1, customEvents: 1, referrer: "t.co", device: "mobile", browser: "Safari", os: "iOS", country: "CA",
      },
      { id: "s4", anon: "v3", started: "2026-11-03T12:00:00Z", platform: "ios", pageviews: 4 },
      { id: "s5", anon: "v4", user: "staff", started: "2026-11-04T12:00:00Z", pageviews: 9 },
      { id: "s6", anon: "v5", started: "2026-11-04T12:00:00Z", pageviews: 9 },
      { id: "s7", anon: "v6", started: "2026-10-25T12:00:00Z", pageviews: 2 },
    ]);
    const pageview = (anon: string, path: string, at: string, extra = {}) => ({ name: "$pageview", anon, path, at, platform: "web", ...extra });
    await insertEvents(ctx.sql, names, [
      pageview("v1", "/", "2026-11-02T10:00:00Z"),
      pageview("v1", "/", "2026-11-02T10:01:00Z"),
      pageview("v1", "/pricing", "2026-11-02T10:05:00Z"),
      pageview("v2", "/blog", "2026-11-03T12:00:00Z"),
      pageview("v4", "/secret", "2026-11-04T12:00:00Z", { user: "staff" }),
      // v5 signed in as staff once, so its anonymous session and pageviews are staff's too.
      pageview("v5", "/secret", "2026-11-04T11:00:00Z", { user: "staff" }),
      pageview("v5", "/secret", "2026-11-04T12:00:00Z"),
      { name: "$pageview", anon: "v3", path: "/native", at: "2026-11-03T12:00:00Z", platform: "ios" },
    ]);
  });

  it("computes totals, the previous period and a daily series", async () => {
    const report = await getWebReport(deps(ctx.sql, names), RANGE);
    expect(report.totals).toEqual({
      visitors: 2,
      visits: 3,
      pageviews: 5,
      views_per_visit: 5 / 3,
      bounce_rate: { numerator: 1, denominator: 3, rate: 1 / 3, status: "measured" },
      avg_visit_seconds: 120,
    });
    expect(report.previous).toMatchObject({ range: { from: "2026-10-22", to: "2026-10-31" }, visitors: 1, visits: 1, pageviews: 2 });
    expect(report.series).toHaveLength(10);
    expect(report.series.filter((p) => p.visits > 0)).toEqual([
      { date: "2026-11-02", visitors: 1, visits: 1, pageviews: 3 },
      { date: "2026-11-03", visitors: 2, visits: 2, pageviews: 2 },
    ]);
  });

  it("ranks the breakdowns", async () => {
    const { breakdowns } = await getWebReport(deps(ctx.sql, names), RANGE);
    expect(breakdowns.pages).toEqual([
      { key: "/", visitors: 1, pageviews: 2 },
      { key: "/blog", visitors: 1, pageviews: 1 },
      { key: "/pricing", visitors: 1, pageviews: 1 },
    ]);
    expect(breakdowns.entry_pages).toEqual([{ key: "/", visitors: 1, pageviews: 4 }, { key: "/blog", visitors: 1, pageviews: 1 }]);
    expect(breakdowns.exit_pages.map((r) => r.key)).toEqual(["/pricing", "/", "/blog"]);
    expect(breakdowns.referrers).toEqual([
      { key: "google.com", visitors: 1, pageviews: 3 },
      { key: "Direct", visitors: 1, pageviews: 1 },
      { key: "t.co", visitors: 1, pageviews: 1 },
    ]);
    expect(breakdowns.utm_sources).toEqual([{ key: "newsletter", visitors: 1, pageviews: 3 }]);
    expect(breakdowns.utm_campaigns).toEqual([{ key: "fall", visitors: 1, pageviews: 3 }]);
    expect(breakdowns.devices).toEqual([{ key: "desktop", visitors: 1, pageviews: 4 }, { key: "mobile", visitors: 1, pageviews: 1 }]);
    expect(breakdowns.browsers.map((r) => r.key)).toEqual(["Chrome", "Safari"]);
    expect(breakdowns.os.map((r) => r.key)).toEqual(["macOS", "iOS"]);
    expect(breakdowns.countries.map((r) => r.key)).toEqual(["US", "CA"]);
  });

  it("is empty for a range without sessions", async () => {
    const report = await getWebReport(deps(ctx.sql, names), { from: "2026-06-01", to: "2026-06-02" });
    expect(report.totals).toMatchObject({ visitors: 0, visits: 0, pageviews: 0, views_per_visit: null, avg_visit_seconds: null });
    expect(report.breakdowns.pages).toEqual([]);
  });
});
