/**
 * @jest-environment node
 *
 * The dashboard script against real reports: every section renders from a
 * seeded database in jsdom, with attacker-shaped strings in the data.
 */
import { describeDb } from "../../../__tests__/dbHarness";
import { APP, insertEvents, insertLinkClicks, insertRevenue, insertSessions, insertUsers } from "../../queries/__tests__/seed";
import { resolveNames } from "../../schema";
import { createAnalyticsServer, type AnalyticsServer } from "../../server";
import { openDashboard, textOf, type Dashboard } from "./runDashboard";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const HOSTILE_PATH = "/\"><svg onload=alert(1)>";
const HOSTILE_CAMPAIGN = "<img src=x onerror=alert(1)>";
const HOSTILE_REFERRER = "evil.example\"><script>alert(1)</script>";

/** Text no figure should ever render as. */
const BROKEN = /NaN|undefined|\[object Object\]|Infinity|null/;

describeDb("dashboard against seeded reports", (ctx) => {
  let server: AnalyticsServer;
  let page: Dashboard;

  beforeAll(async () => {
    server = createAnalyticsServer({
      sql: ctx.sql,
      appId: APP,
      now: () => NOW,
      isAdmin: (request) => request.headers.get("x-admin") === "1",
      links: { web: "https://example.com/start" },
      metrics: {
        activation: { event: "project_created", withinDays: 7 },
        funnels: [{ key: "onboarding", name: "Onboarding", steps: ["signup_started", "profile_completed", "project_created"] }],
      },
      onError: (error) => {
        throw error;
      },
    });
    await server.install();
    const names = resolveNames();
    await insertUsers(ctx.sql, names, [
      { user: "u1", firstSeen: "2026-11-02T10:00:00Z", channel: "tiktok", platform: "ios" },
      { user: "u2", firstSeen: "2026-11-10T10:00:00Z", channel: "web_direct", platform: "web" },
      { user: "u3", firstSeen: "2026-11-20T10:00:00Z", channel: "reddit", platform: "android" },
    ]);
    await insertEvents(ctx.sql, names, [
      { name: "signup_started", at: "2026-11-02T10:00:00Z", user: "u1" },
      { name: "profile_completed", at: "2026-11-02T10:05:00Z", user: "u1" },
      { name: "project_created", at: "2026-11-03T09:00:00Z", user: "u1", properties: { plan: "pro", note: HOSTILE_CAMPAIGN } },
      { name: "app_open", at: "2026-11-09T09:00:00Z", user: "u1" },
      { name: "app_open", at: "2026-11-20T09:00:00Z", user: "u1" },
      { name: "signup_started", at: "2026-11-10T10:00:00Z", user: "u2", platform: "web" },
      { name: "app_open", at: "2026-11-11T10:00:00Z", user: "u2", platform: "web" },
      { name: "signup_started", at: "2026-11-20T10:00:00Z", user: "u3", platform: "android" },
      { name: "profile_completed", at: "2026-11-21T10:00:00Z", user: "u3", platform: "android" },
      { name: "$pageview", at: "2026-11-15T10:00:00Z", anon: "v1", platform: "web", path: "/" },
      { name: "$pageview", at: "2026-11-15T10:01:00Z", anon: "v1", platform: "web", path: HOSTILE_PATH },
      { name: "$pageview", at: "2026-11-25T10:00:00Z", anon: "v2", platform: "web", path: "/" },
    ]);
    await insertSessions(ctx.sql, names, [
      {
        id: "w1",
        anon: "v1",
        started: "2026-11-15T10:00:00Z",
        lastSeen: "2026-11-15T10:01:00Z",
        entry: "/",
        exit: HOSTILE_PATH,
        pageviews: 2,
        referrer: HOSTILE_REFERRER,
        utmSource: "hn",
        utmCampaign: HOSTILE_CAMPAIGN,
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
    await insertLinkClicks(ctx.sql, names, [{ channel: "tiktok", at: "2026-11-01T09:00:00Z" }]);

    page = await openDashboard(server);
    await page.goTo("overview");
  });

  afterAll(() => {
    page?.window.close();
  });

  function expectClean(id: string) {
    const text = textOf(page.section(id));
    expect({ id, broken: text.match(BROKEN)?.[0] ?? null }).toEqual({ id, broken: null });
    expect(page.errors).toEqual([]);
    return text;
  }

  it("shows the period and the overview figures", () => {
    expect(page.document.getElementById("period")?.textContent).toBe("Oct 29 – Nov 27, 2026");
    expect(page.document.getElementById("app-id")?.textContent).toBe(APP);
    const text = expectClean("overview");
    for (const figure of ["Daily active", "Monthly active", "New users", "MRR", "$9.99", "Day 1 retention", "Day 90 retention"]) {
      expect(text).toContain(figure);
    }
    // Day 90 cannot have closed for a November cohort: it says so instead of 0%.
    const day90 = [...page.section("overview").querySelectorAll(".tile")].find((tile) => tile.textContent?.startsWith("Day 90"));
    expect(day90?.querySelector(".tile-value")?.textContent).toBe("Not yet");
    expect(page.section("overview").querySelector<HTMLAnchorElement>("[data-csv]")?.getAttribute("href")).toBe(
      "/analytics/api/overview?from=2026-10-29&to=2026-11-27&format=csv",
    );
    expect(page.section("overview").querySelectorAll("[data-notes] li").length).toBeGreaterThan(0);
  });

  it("renders product charts and switches the audience", async () => {
    await page.goTo("product");
    const text = expectClean("product");
    expect(text).toContain("Stickiness");
    expect(text).toContain("Activation");
    const charts = page.section("product").querySelectorAll("svg[role=img]");
    expect(charts.length).toBe(2);
    expect(charts[0].getAttribute("aria-label")).toMatch(/^Active users per day\. On Nov 27, 2026: Daily \d+, Weekly \d+, Monthly \d+\./);
    expect(charts[0].querySelectorAll("path.line")).toHaveLength(3);
    const signedIn = [...page.section("product").querySelectorAll("button")].find((node) => node.textContent === "Signed in");
    signedIn!.click();
    expect(textOf(page.section("product"))).toContain("Users on events that carried a user id.");
    expect(page.section("product").querySelector('[aria-pressed="true"]')?.textContent).toBe("Signed in");
  });

  it("renders the cohort grid with open weeks marked, and switches the mode", async () => {
    await page.goTo("retention");
    expectClean("retention");
    const rows = page.section("retention").querySelectorAll("table.heat tbody tr");
    expect(rows).toHaveLength(12);
    expect(page.section("retention").querySelectorAll("td.heat-pending").length).toBeGreaterThan(0);
    for (const cell of page.section("retention").querySelectorAll("td.heat-pending")) {
      expect(cell.textContent).toBe("…Not yet");
    }
    const mode = [...page.section("retention").querySelectorAll("button")].find((node) => node.textContent === "On day N");
    mode!.click();
    await page.until(() => page.requests.some((path) => path.includes("mode=on")), "the mode request");
    await page.until(() => page.section("retention").querySelector('[aria-pressed="true"]')?.textContent === "On day N", "the mode render");
    expect(page.window.location.search).toContain("mode=on");
    expect(textOf(page.section("retention"))).toContain("active on day 7.");
  });

  it("renders the funnel steps with conversion", async () => {
    await page.goTo("funnels");
    const text = expectClean("funnels");
    expect(text).toContain("Onboarding");
    const steps = [...page.section("funnels").querySelectorAll(".bar-row")].map((row) => row.querySelector(".bar-label")?.textContent + " " + row.querySelector(".bar-figure")?.textContent);
    expect(steps).toEqual(["1. signup_started 3", "2. profile_completed 2", "3. project_created 1"]);
    expect(text).toContain("33% of entrants");
  });

  it("renders acquisition by channel and platform", async () => {
    await page.goTo("acquisition");
    const text = expectClean("acquisition");
    expect(text).toContain("tiktok");
    expect(text).toContain("Sign-ups by platform");
  });

  it("renders web breakdowns with hostile strings as text only", async () => {
    await page.goTo("web");
    const text = expectClean("web");
    expect(text).toContain(HOSTILE_CAMPAIGN);
    expect(text).toContain(HOSTILE_REFERRER);
    expect(text).toContain(HOSTILE_PATH);
    expect(page.document.querySelectorAll("img, svg svg[onload], script:not([src])")).toHaveLength(0);
    for (const node of page.document.querySelectorAll("*")) {
      for (const attribute of node.getAttributeNames()) expect(attribute.startsWith("on")).toBe(false);
    }
    expect(page.section("web").querySelectorAll(".cards .card")).toHaveLength(10);
  });

  it("renders revenue figures and movements", async () => {
    await page.goTo("revenue");
    const text = expectClean("revenue");
    for (const figure of ["MRR movements", "$9.99", "too_expensive", "Trial conversion", "Customer churn"]) expect(text).toContain(figure);
  });

  it("lists raw events and filters them", async () => {
    await page.goTo("events");
    expectClean("events");
    expect(page.section("events").querySelectorAll("tbody tr")).toHaveLength(12);
    expect(textOf(page.section("events"))).toContain(HOSTILE_PATH);
    const form = page.section("events").querySelector("form")!;
    (form.elements.namedItem("name") as HTMLInputElement).value = "profile_completed";
    form.querySelector<HTMLButtonElement>("button:not([type=button])")!.click();
    await page.until(() => page.section("events").querySelectorAll("tbody tr").length === 2, "the filtered events");
    expect(page.section("events").querySelector<HTMLAnchorElement>("[data-csv]")?.getAttribute("href")).toBe(
      "/analytics/api/events?from=2026-10-29&to=2026-11-27&name=profile_completed&format=csv",
    );
  });

  it("draws MRR at month ends once the range holds two of them", async () => {
    const wide = await openDashboard(server, { url: "https://api.example.com/analytics/?range=90d#revenue" });
    await wide.goTo("revenue");
    expect(wide.document.getElementById("period")?.textContent).toBe("Aug 30 – Nov 27, 2026");
    const chart = wide.section("revenue").querySelector("svg[role=img]");
    expect(chart?.getAttribute("aria-label")).toMatch(/^MRR at each month end\. On Oct 31, 2026: MRR \$0\.00\./);
    expect(chart?.querySelectorAll("circle.dot.s1")).toHaveLength(3 + 1);
    expect(textOf(wide.section("revenue"))).not.toMatch(BROKEN);
    expect(wide.errors).toEqual([]);
    wide.window.close();
  });

  it("changes the range from a preset and keeps it in the URL", async () => {
    page.document.querySelector<HTMLButtonElement>('[data-preset="month"]')!.click();
    await page.until(() => page.requests.some((path) => path.startsWith("/analytics/api/events?from=2026-11-01")), "the month request");
    expect(page.document.getElementById("period")?.textContent).toBe("Nov 1 – Nov 27, 2026");
    expect(page.window.location.search).toContain("range=month");
    expect(page.window.location.hash).toBe("#events");
  });
});

describeDb("dashboard on a new install", (ctx) => {
  let server: AnalyticsServer;

  beforeAll(async () => {
    server = createAnalyticsServer({
      sql: ctx.sql,
      appId: APP,
      now: () => NOW,
      isAdmin: (request) => request.headers.get("x-admin") === "1",
      metrics: { funnels: [{ key: "onboarding", name: "Onboarding", steps: ["signup_started", "project_created"] }] },
      onError: (error) => {
        throw error;
      },
    });
    await server.install();
  });

  it("says what to do next in every section instead of showing blanks", async () => {
    const page = await openDashboard(server);
    await page.goTo("overview");
    const overview = textOf(page.section("overview"));
    expect(overview).toContain("Nothing recorded in this period");
    expect(overview).toContain("https://api.example.com/analytics/e");
    expect([...page.section("overview").querySelectorAll("button")].map((node) => node.textContent)).toContain("Show the last 90 days");
    const expected: [string, string][] = [
      ["product", "Stickiness"],
      ["retention", "No sign-ups to follow yet"],
      ["funnels", "Nobody entered this funnel in the period."],
      ["acquisition", "No sign-ups or link clicks in this period."],
      ["web", "No web traffic in this period"],
      ["revenue", "No revenue recorded"],
      ["events", "No events in this period."],
    ];
    for (const [tab, text] of expected) {
      await page.goTo(tab);
      const body = textOf(page.section(tab));
      expect({ tab, found: body.includes(text) }).toEqual({ tab, found: true });
      expect({ tab, broken: body.match(BROKEN)?.[0] ?? null }).toEqual({ tab, broken: null });
    }
    // An empty rate is "No data", never 0%.
    await page.goTo("product");
    const stickiness = [...page.section("product").querySelectorAll(".tile")].find((tile) => tile.textContent?.startsWith("Stickiness"));
    expect(stickiness?.querySelector(".tile-value")?.textContent).toBe("No data");
    expect(page.errors).toEqual([]);
    page.window.close();
  });

  it("loads older events a page at a time", async () => {
    const names = resolveNames();
    await insertEvents(
      ctx.sql,
      names,
      Array.from({ length: 105 }, (_, i) => ({ name: "app_open", at: new Date(Date.parse("2026-11-20T00:00:00Z") + i * 60_000).toISOString(), user: "u1" })),
    );
    const page = await openDashboard(server, { url: "https://api.example.com/analytics/#events" });
    await page.goTo("events");
    const rows = () => page.section("events").querySelectorAll("tbody tr").length;
    expect(rows()).toBe(100);
    const more = [...page.section("events").querySelectorAll("button")].find((node) => node.textContent === "Load more")!;
    expect(more.hidden).toBe(false);
    more.click();
    await page.until(() => rows() === 105, "the second page");
    expect(more.hidden).toBe(true);
    expect(textOf(page.section("events"))).toContain("Loaded 5 more.");
    expect(page.requests.filter((path) => path.includes("before="))).toHaveLength(1);
    expect(page.errors).toEqual([]);
    page.window.close();
  });
});
