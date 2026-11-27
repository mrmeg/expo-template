/**
 * @jest-environment node
 */
import { describeDb } from "../../__tests__/dbHarness";
import type { EventPage, FunnelReport, MetricsConfig, OverviewReport, RetentionReport, RevenueReport, WebReport } from "../../metrics";
import type { MetaResponse } from "../queryApi";
import { APP, insertEvents, insertLinkClicks, insertRevenue, insertSessions, insertUsers } from "../queries/__tests__/seed";
import { resolveNames } from "../schema";
import { ROUTES, createAnalyticsServer, type AnalyticsServer } from "../server";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const RANGE = "from=2026-11-01&to=2026-11-27";
const METRICS: MetricsConfig = {
  activation: { event: "project_created", withinDays: 7 },
  funnels: [{ key: "onboarding", name: "Onboarding", steps: ["signup_started", "profile_completed", "project_created"] }],
};
const REPORTS = ["overview", "product", "retention", "funnels", "acquisition", "web", "revenue"] as const;

function get(server: AnalyticsServer, path: string, admin = true) {
  return server.handle(new Request(`https://api.example.com/analytics${path}`, { headers: admin ? { "x-admin": "1" } : {} }));
}

async function getJson<T>(server: AnalyticsServer, path: string): Promise<T> {
  const response = await get(server, path);
  expect({ path, status: response?.status }).toEqual({ path, status: 200 });
  expect(response?.headers.get("cache-control")).toBe("no-store");
  return (await response!.json()) as T;
}

/** CSV body without its byte order mark, split into records. */
async function csvRecords(response: Response | null): Promise<string[]> {
  const text = new TextDecoder().decode(await response!.arrayBuffer());
  return text.replace(/\r\n$/, "").split("\r\n");
}

describeDb("query API against Postgres", (ctx) => {
  let server: AnalyticsServer;

  beforeAll(() => {
    server = createAnalyticsServer({
      sql: ctx.sql,
      appId: APP,
      now: () => NOW,
      isAdmin: (request) => request.headers.get("x-admin") === "1",
      links: { web: "https://example.com/start" },
      metrics: METRICS,
      onError: (error) => {
        throw error;
      },
    });
  });

  it("answers 409 on every report route before install, and meta reports it", async () => {
    for (const path of [...REPORTS.map((name) => `/api/${name}`), "/api/events", "/api/web?format=csv"]) {
      const response = await get(server, path);
      expect({ path, status: response?.status }).toEqual({ path, status: 409 });
      await expect(response?.json()).resolves.toMatchObject({ error: "not_installed", installed: false });
    }
    const meta = await getJson<MetaResponse>(server, "/api/meta");
    expect(meta.install).toEqual({ installed: false, version: 0, latest: 1, pending: [1] });
  });

  describe("installed and seeded", () => {
    beforeAll(async () => {
      await server.install();
      const names = resolveNames();
      await insertUsers(ctx.sql, names, [
        { user: "u1", firstSeen: "2026-11-02T10:00:00Z", channel: "tiktok", platform: "ios" },
        { user: "u2", firstSeen: "2026-11-10T10:00:00Z", channel: "web_direct", platform: "web" },
        { user: "u3", firstSeen: "2026-11-20T10:00:00Z", channel: "reddit", platform: "android" },
        { user: "ex", firstSeen: "2026-11-12T10:00:00Z", excluded: true },
      ]);
      await insertEvents(ctx.sql, names, [
        { name: "signup_started", at: "2026-11-02T10:00:00Z", user: "u1" },
        { name: "profile_completed", at: "2026-11-02T10:05:00Z", user: "u1" },
        { name: "project_created", at: "2026-11-03T09:00:00Z", user: "u1" },
        { name: "app_open", at: "2026-11-09T09:00:00Z", user: "u1" },
        { name: "app_open", at: "2026-11-20T09:00:00Z", user: "u1" },
        { name: "signup_started", at: "2026-11-10T10:00:00Z", user: "u2", platform: "web" },
        { name: "app_open", at: "2026-11-11T10:00:00Z", user: "u2", platform: "web" },
        { name: "signup_started", at: "2026-11-20T10:00:00Z", user: "u3", platform: "android" },
        { name: "profile_completed", at: "2026-11-21T10:00:00Z", user: "u3", platform: "android" },
        { name: "app_open", at: "2026-11-12T10:00:00Z", user: "ex" },
        { name: "$pageview", at: "2026-11-15T10:00:00Z", anon: "v1", platform: "web", path: "/" },
        { name: "$pageview", at: "2026-11-15T10:01:00Z", anon: "v1", platform: "web", path: "/pricing" },
        // Attacker-controlled text from the public endpoint: must come out of CSV defused.
        { name: "$pageview", at: "2026-11-25T10:00:00Z", anon: "v2", platform: "web", path: "=HYPERLINK(\"https://evil.example\")" },
      ]);
      await insertSessions(ctx.sql, names, [
        {
          id: "w1",
          anon: "v1",
          started: "2026-11-15T10:00:00Z",
          lastSeen: "2026-11-15T10:01:00Z",
          entry: "/",
          exit: "/pricing",
          pageviews: 2,
          referrer: "news.ycombinator.com",
          utmSource: "hn",
          device: "desktop",
          browser: "Chrome",
          os: "macOS",
          country: "US",
        },
        { id: "w2", anon: "v2", started: "2026-11-25T10:00:00Z", entry: "/", exit: "/", pageviews: 1, device: "mobile" },
      ]);
      await insertRevenue(ctx.sql, names, [
        { type: "purchased", sub: "P", user: "u1", at: "2026-11-05T00:00:00Z", periodStart: "2026-11-05T00:00:00Z", periodEnd: "2026-12-05T00:00:00Z", amount: 999 },
        { type: "trial_started", sub: "T", user: "u3", at: "2026-11-20T00:00:00Z", periodStart: "2026-11-20T00:00:00Z", periodEnd: "2026-11-27T00:00:00Z", amount: 0 },
        { type: "cancel_scheduled", sub: "P", user: "u1", at: "2026-11-21T00:00:00Z", cancelReason: "too_expensive" },
      ]);
      await insertLinkClicks(ctx.sql, names, [
        { channel: "tiktok", at: "2026-11-01T09:00:00Z" },
        { channel: "tiktok", at: "2026-11-02T09:00:00Z" },
      ]);
    });

    it("describes the install and configuration in meta", async () => {
      const meta = await getJson<MetaResponse>(server, "/api/meta");
      expect(meta).toMatchObject({
        appId: APP,
        basePath: "/analytics",
        timezone: "UTC",
        today: "2026-11-27",
        install: { installed: true, version: 1, pending: [] },
        activation: { event: "project_created", withinDays: 7 },
        links: true,
        funnels: [{ key: "onboarding", name: "Onboarding" }],
      });
    });

    it("answers every report as JSON with the seeded figures", async () => {
      const overview = await getJson<OverviewReport>(server, `/api/overview?${RANGE}`);
      expect(overview.range).toMatchObject({ from: "2026-11-01", to: "2026-11-27", days: 27 });
      expect(overview.new_users.current).toBe(3);
      expect(overview.revenue.mrr_cents.current).toBe(999);
      expect(overview.notes.length).toBeGreaterThan(0);

      const product = await getJson<{ new_users: { total: number }; activation: { activated: number; signups: number } }>(server, `/api/product?${RANGE}`);
      expect(product.new_users.total).toBe(3);
      expect(product.activation).toMatchObject({ signups: 3, activated: 1 });

      const retention = await getJson<RetentionReport>(server, `/api/retention?${RANGE}`);
      expect(retention.weekly).toHaveLength(12);
      expect(retention.headline.map((h) => h.day)).toEqual([1, 7, 30, 90]);
      // Day 90 cannot have closed for anyone first seen in November.
      expect(retention.headline.find((h) => h.day === 90)?.cell.status).toBe("not_yet");
      const on = await getJson<RetentionReport>(server, `/api/retention?${RANGE}&mode=on`);
      expect(new Set(on.headline.map((h) => h.mode))).toEqual(new Set(["on"]));

      const funnels = await getJson<FunnelReport>(server, `/api/funnels?${RANGE}&key=onboarding`);
      expect(funnels.funnels.map((f) => f.steps.map((s) => s.actors))).toEqual([[3, 2, 1]]);

      const acquisition = await getJson<{ channels: { channel: string; link_clicks: number; signups: number }[] }>(server, `/api/acquisition?${RANGE}`);
      expect(acquisition.channels.find((row) => row.channel === "tiktok")).toMatchObject({ link_clicks: 2, signups: 1 });

      const web = await getJson<WebReport>(server, `/api/web?${RANGE}`);
      expect(web.totals).toMatchObject({ visits: 2, visitors: 2, pageviews: 3 });
      expect(web.breakdowns.referrers.map((row) => row.key).sort()).toEqual(["Direct", "news.ycombinator.com"]);

      const revenue = await getJson<RevenueReport>(server, `/api/revenue?${RANGE}`);
      expect(revenue.mrr.current_cents).toBe(999);
      expect(revenue.event_counts).toMatchObject({ purchased: 1, trial_started: 1, cancel_scheduled: 1 });
      expect(revenue.cancellations_by_reason).toEqual([{ key: "too_expensive", count: 1 }]);
    });

    it("pages and filters raw events", async () => {
      const seen: string[] = [];
      let before: string | null = null;
      let pages = 0;
      do {
        const page: EventPage = await getJson<EventPage>(server, `/api/events?${RANGE}&limit=5${before ? `&before=${encodeURIComponent(before)}` : ""}`);
        seen.push(...page.events.map((event) => event.id));
        before = page.next_before;
        pages++;
      } while (before && pages < 10);
      // The excluded user's event is filtered out.
      expect(new Set(seen).size).toBe(12);
      expect(pages).toBe(3);

      const named = await getJson<EventPage>(server, `/api/events?${RANGE}&name=profile_completed`);
      expect(named.events.map((event) => event.user_id).sort()).toEqual(["u1", "u3"]);
      const user = await getJson<EventPage>(server, `/api/events?${RANGE}&user=u2`);
      expect(user.events).toHaveLength(2);
    });

    it("exports each report and its tables as CSV", async () => {
      const expectations: [string, string, string][] = [
        ["overview", "", "metric,current,previous,status,numerator,denominator,pending"],
        ["product", "", "date,all_dau,all_wau,all_mau,signed_in_dau,signed_in_wau,signed_in_mau,new_users"],
        ["retention", "", "cohort,label,start,end,size,week,retained,eligible,rate,status"],
        ["retention", "daily", "cohort,size,day,mode,retained,eligible,rate,status"],
        ["retention", "headline", "day,mode,retained,eligible,rate,status,pending"],
        ["funnels", "", "funnel_key,funnel_name,window_days,step_number,step,actors,from_first_rate,from_first_status,from_previous_rate,from_previous_status,median_seconds_from_previous,open"],
        ["acquisition", "", "channel,link_clicks,signups,activated,trial_started,paid"],
        ["acquisition", "platforms", "platform,signups"],
        ["acquisition", "link_clicks", "channel,clicks"],
        ["web", "", "date,visitors,visits,pageviews"],
        ["web", "totals", "period,from,to,visitors,visits,pageviews,views_per_visit,bounce_rate,bounce_status,avg_visit_seconds"],
        ["web", "breakdowns", "dimension,key,visitors,pageviews"],
        ["web", "referrers", "key,visitors,pageviews"],
        ["revenue", "", "metric,value,status,numerator,denominator"],
        ["revenue", "mrr", "date,mrr_cents"],
        ["revenue", "event_counts", "event_type,count"],
        ["revenue", "cancellations", "reason,count"],
      ];
      for (const [report, table, header] of expectations) {
        const response = await get(server, `/api/${report}?${RANGE}&format=csv${table ? `&table=${table}` : ""}`);
        expect({ report, table, status: response?.status }).toEqual({ report, table, status: 200 });
        expect(response?.headers.get("content-type")).toBe("text/csv; charset=utf-8");
        expect(response?.headers.get("cache-control")).toBe("no-store");
        const suffix = table ? `-${table.replace(/_/g, "-")}` : "";
        expect(response?.headers.get("content-disposition")).toBe(`attachment; filename="analytics-${report}${suffix}-2026-11-01_2026-11-27.csv"`);
        const records = await csvRecords(response);
        expect(records[0]).toBe(header);
      }

      const product = await csvRecords(await get(server, `/api/product?${RANGE}&format=csv`));
      expect(product).toHaveLength(28);
      const weekly = await csvRecords(await get(server, `/api/retention?${RANGE}&format=csv`));
      expect(weekly).toHaveLength(1 + 12 * 13);
      // A week still running is labelled, not left blank where it could pass for zero.
      expect(weekly.some((record) => record.endsWith(",not_yet"))).toBe(true);
      const funnel = await csvRecords(await get(server, `/api/funnels?${RANGE}&format=csv`));
      expect(funnel.slice(1).map((record) => record.split(",").slice(4, 6).join(","))).toEqual([
        "signup_started,3",
        "profile_completed,2",
        "project_created,1",
      ]);
      const revenue = await csvRecords(await get(server, `/api/revenue?${RANGE}&format=csv`));
      expect(revenue).toContain("mrr_cents,999,,,");
    });

    it("exports raw events as CSV with formula cells defused", async () => {
      const response = await get(server, `/api/events?${RANGE}&format=csv`);
      expect(response?.status).toBe(200);
      expect(response?.headers.get("content-disposition")).toBe('attachment; filename="analytics-events-2026-11-01_2026-11-27.csv"');
      const records = await csvRecords(response);
      expect(records[0]).toBe("id,occurred_at,received_at,name,user_id,anonymous_id,session_id,platform,app_version,path,properties");
      expect(records).toHaveLength(13);
      expect(records[1]).toContain(",$pageview,,v2,,web,,\"'=HYPERLINK(\"\"https://evil.example\"\")\",");
      expect(response?.headers.get("x-next-before")).toBeNull();

      // A CSV is one page; the header says older events remain and how to ask for them.
      const first = await get(server, `/api/events?${RANGE}&format=csv&limit=5`);
      expect(await csvRecords(first)).toHaveLength(6);
      const cursor = first?.headers.get("x-next-before");
      expect(cursor).toMatch(/^2026-11-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/);
      const rest = await get(server, `/api/events?${RANGE}&format=csv&before=${encodeURIComponent(cursor!)}`);
      expect(await csvRecords(rest)).toHaveLength(1 + 12 - 5);
    });

    it("answers 400 for a bad range or option", async () => {
      for (const path of [
        "/api/overview?from=2026-13-01",
        "/api/web?from=2026-11-20&to=2026-11-01",
        "/api/funnels?key=missing",
        "/api/retention?mode=sometimes",
        "/api/events?before=garbage",
        "/api/product?format=csv&table=weekly",
      ]) {
        const response = await get(server, path);
        expect({ path, status: response?.status }).toEqual({ path, status: 400 });
        const body = (await response!.json()) as { error: string };
        expect(typeof body.error).toBe("string");
      }
    });

    it("answers 404 to a non-admin on every admin route, including the page and assets", async () => {
      const admin = ROUTES.filter((route) => route.access === "admin");
      expect(admin.length).toBe(12);
      for (const route of admin) {
        const path = route.pattern === "/" ? "/" : route.pattern;
        const response = await get(server, `${path}?${RANGE}`, false);
        expect({ path, status: response?.status }).toEqual({ path, status: 404 });
        expect(await response!.text()).toBe("Not found");
      }
    });

    it("serves the page and both assets to an admin", async () => {
      for (const [path, type] of [
        ["/", "text/html; charset=utf-8"],
        ["/assets/dashboard.js", "text/javascript; charset=utf-8"],
        ["/assets/dashboard.css", "text/css; charset=utf-8"],
      ]) {
        const response = await get(server, path);
        expect({ path, status: response?.status, type: response?.headers.get("content-type") }).toEqual({ path, status: 200, type });
      }
    });
  });
});
