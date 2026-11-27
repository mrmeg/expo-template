/**
 * @jest-environment node
 */
import { createAnalyticsServer, type AnalyticsServer } from "../../server";
import type { AnalyticsServerConfig } from "../../config";
import { TABLE_KEYS } from "../../schema";
import type { SqlClient } from "../../sql";
import { escapeHtml, renderDashboardPage } from "../page";
import { DASHBOARD_SCRIPT } from "../script";
import { DASHBOARD_STYLES } from "../styles";
import { openDashboard, textOf } from "./runDashboard";

describe("dashboard script source", () => {
  it("parses as a script", () => {
    expect(() => new Function(DASHBOARD_SCRIPT)).not.toThrow();
  });

  it("never hands a string to an HTML parser or an evaluator", () => {
    for (const sink of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "setTimeout(\"", "createContextualFragment", "DOMParser"]) {
      expect({ sink, found: DASHBOARD_SCRIPT.includes(sink) }).toEqual({ sink, found: false });
    }
  });

  it("makes no request but its own API and keeps nothing but the view", () => {
    // The only URL is the SVG namespace, which createElementNS needs and nothing fetches.
    expect(DASHBOARD_SCRIPT.match(/https?:\/\/[^\s"']+/g)).toEqual(["http://www.w3.org/2000/svg"]);
    for (const api of ["document.cookie", "sessionStorage", "indexedDB", "XMLHttpRequest", "sendBeacon", "WebSocket", "import("]) {
      expect({ api, found: DASHBOARD_SCRIPT.includes(api) }).toEqual({ api, found: false });
    }
    expect(DASHBOARD_SCRIPT.match(/localStorage\.\w+/g)?.sort()).toEqual(["localStorage.getItem", "localStorage.setItem"]);
  });

  it("is plain ASCII, so a proxy that drops the charset cannot garble it", () => {
    expect(DASHBOARD_SCRIPT).toMatch(/^[\x09\x0a\x20-\x7e]*$/);
    expect(DASHBOARD_STYLES).toMatch(/^[\x09\x0a\x20-\x7e]*$/);
  });

  it("sets no inline style", () => {
    expect(DASHBOARD_SCRIPT).not.toMatch(/\.style\b|setAttribute\("style"|cssText/);
  });
});

describe("dashboard page shell", () => {
  const html = renderDashboardPage("/analytics");

  it("has no inline script, inline style or inline handler", () => {
    const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toEqual(['<script src="/analytics/assets/dashboard.js" defer></script>']);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("links one tab per section, each a hash link", () => {
    const tabs = [...html.matchAll(/<a class="tab" href="#([a-z]+)"/g)].map((match) => match[1]);
    expect(tabs).toEqual(["overview", "product", "retention", "funnels", "acquisition", "web", "revenue", "events"]);
    for (const tab of tabs) expect(html).toContain(`id="section-${tab}"`);
  });

  it("escapes the base path", () => {
    expect(escapeHtml(`/a"><script>&'`)).toBe("/a&quot;&gt;&lt;script&gt;&amp;&#39;");
    expect(renderDashboardPage(`/x"y`)).toContain('data-base="/x&quot;y"');
  });
});

describe("dashboard stylesheet", () => {
  it("loads nothing from anywhere", () => {
    expect(DASHBOARD_STYLES).not.toMatch(/@import|url\(|expression\(/i);
  });

  it("defines the palette on :root with a dark variant", () => {
    expect(DASHBOARD_STYLES).toMatch(/:root \{[^}]*--surface:/);
    expect(DASHBOARD_STYLES).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root \{[^}]*--surface:/);
  });
});

/** Answers the install check; any report query goes to `onReport`. */
function stubSql(state: { installed: boolean; onReport?: () => unknown[] }): SqlClient {
  return {
    async query<T>(text: string): Promise<T[]> {
      if (text.includes("to_regclass")) return (state.installed ? TABLE_KEYS.map((key) => ({ key, tagged: true })) : []) as T[];
      if (text.includes("version::int as version")) return (state.installed ? [{ version: 1 }] : []) as T[];
      if (state.onReport) return state.onReport() as T[];
      throw new Error("report query failed");
    },
    async transaction() {
      throw new Error("unexpected transaction");
    },
  };
}

function server(sql: SqlClient, over: Partial<AnalyticsServerConfig> = {}): AnalyticsServer {
  return createAnalyticsServer({
    sql,
    appId: "demo",
    now: () => new Date("2026-11-27T12:00:00Z"),
    isAdmin: (request) => request.headers.get("x-admin") === "1",
    onError: () => {},
    ...over,
  });
}

describe("dashboard states in jsdom", () => {
  it("says the tables are not installed instead of asking for reports", async () => {
    const page = await openDashboard(server(stubSql({ installed: false })));
    await page.until(() => !!page.section("overview").querySelector(".state"), "the overview state");
    expect(textOf(page.section("overview"))).toContain("The analytics tables aren’t installed");
    expect(textOf(page.section("overview"))).toContain("npx expo-analytics install");
    expect(page.requests).toEqual(["/analytics/api/meta"]);
    expect(page.document.getElementById("period")?.textContent).toBe("Oct 29 – Nov 27, 2026");
    expect(page.errors).toEqual([]);
  });

  it("shows the funnel config snippet when none is configured, then says so when the session ends", async () => {
    let admin = true;
    const page = await openDashboard(server(stubSql({ installed: true })), {
      url: "https://api.example.com/analytics/#funnels",
      admin: () => admin,
    });
    await page.until(() => !!page.section("funnels").querySelector(".state"), "the funnels state");
    const funnels = textOf(page.section("funnels"));
    expect(funnels).toContain("No funnels configured");
    expect(funnels).toContain("funnels: [");
    expect(page.section("funnels").querySelector<HTMLAnchorElement>("[data-csv]")?.hidden).toBe(true);

    admin = false;
    page.document.querySelector<HTMLButtonElement>('[data-preset="7d"]')!.click();
    await page.until(() => !page.document.getElementById("banner")!.hidden, "the signed-out banner");
    expect(textOf(page.document.getElementById("banner")!)).toContain("Your admin session has ended");
    expect(textOf(page.section("funnels"))).toContain("You’re signed out");
    expect(page.window.location.search).toBe("?range=7d");
    expect(page.errors).toEqual([]);
  });

  it("offers a retry when a report fails", async () => {
    const page = await openDashboard(server(stubSql({ installed: true })));
    await page.until(() => !!page.section("overview").querySelector(".state"), "the overview error");
    expect(textOf(page.section("overview"))).toContain("Overview didn’t load");
    const before = page.requests.length;
    const retry = [...page.section("overview").querySelectorAll("button")].find((node) => node.textContent === "Try again");
    retry!.click();
    await page.until(() => page.requests.length > before, "the retried request");
    expect(page.requests[page.requests.length - 1]).toBe("/analytics/api/overview?from=2026-10-29&to=2026-11-27");
  });

  it("restores the range from the URL and remembers the view", async () => {
    const page = await openDashboard(server(stubSql({ installed: true })), {
      url: "https://api.example.com/analytics/?from=2026-11-01&to=2026-11-10#funnels",
    });
    await page.until(() => !!page.section("funnels").querySelector(".state"), "the funnels state");
    expect(page.document.getElementById("period")?.textContent).toBe("Nov 1 – Nov 10, 2026");
    expect(page.document.querySelector('[data-preset="custom"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(page.document.getElementById("custom-range")?.hidden).toBe(false);
    expect(JSON.parse(page.window.localStorage.getItem("expo-analytics:dashboard")!)).toEqual({
      preset: "custom",
      from: "2026-11-01",
      to: "2026-11-10",
      tab: "funnels",
    });
  });
});
