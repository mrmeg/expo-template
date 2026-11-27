/**
 * @jest-environment node
 */
import { MetricsInputError } from "../queries";
import { ROUTES, createAnalyticsServer } from "../server";
import type { AnalyticsServerConfig } from "../config";
import { TABLE_KEYS } from "../schema";
import type { SqlClient, SqlParam } from "../sql";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const ADMIN = { "x-admin": "1" };

/**
 * Answers only the two catalog queries `status()` runs; every report query
 * goes to `onReport`, which fails by default, so a test proves which paths
 * reach the report SQL at all.
 */
function stubSql(options: { installed?: () => boolean; onReport?: (text: string, params?: readonly SqlParam[]) => unknown[] } = {}) {
  const calls: string[] = [];
  const sql: SqlClient = {
    async query<T>(text: string, params?: readonly SqlParam[]): Promise<T[]> {
      calls.push(text);
      const installed = options.installed?.() ?? true;
      if (text.includes("to_regclass")) return (installed ? TABLE_KEYS.map((key) => ({ key })) : []) as T[];
      if (text.includes("version::int as version")) return (installed ? [{ version: 1 }] : []) as T[];
      if (options.onReport) return options.onReport(text, params) as T[];
      throw new Error("unexpected report query");
    },
    async transaction() {
      throw new Error("unexpected transaction");
    },
  };
  return { sql, calls };
}

function server(sql: SqlClient, over: Partial<AnalyticsServerConfig> = {}) {
  return createAnalyticsServer({
    sql,
    appId: "test",
    now: () => NOW,
    isAdmin: (request) => request.headers.get("x-admin") === "1",
    onError: () => {},
    ...over,
  });
}

function get(path: string, headers: Record<string, string> = ADMIN) {
  return new Request(`https://api.example.com${path}`, { headers });
}

const REPORTS = ["overview", "product", "retention", "funnels", "acquisition", "web", "revenue"];

describe("admin routes", () => {
  const adminRoutes = ROUTES.filter((route) => route.access === "admin");

  it("covers the page, both assets, meta, every report and events", () => {
    const patterns = adminRoutes.map((route) => `${route.method} ${route.pattern}`).sort();
    expect(patterns).toEqual(
      [
        "GET /",
        "GET /assets/dashboard.css",
        "GET /assets/dashboard.js",
        "GET /api/meta",
        "GET /api/events",
        ...REPORTS.map((name) => `GET /api/${name}`),
      ].sort(),
    );
  });

  it.each(adminRoutes.map((route) => [route.method, route.pattern]))("%s %s answers 404 to a non-admin without a query", async (method, pattern) => {
    const { sql, calls } = stubSql();
    const path = `/analytics${pattern.replace(/:([a-z]+)/g, "x")}`;
    for (const config of [{}, { isAdmin: () => false }, { isAdmin: async () => false }]) {
      const s = server(sql, config);
      const response = await s.handle(new Request(`https://api.example.com${path}`, { method }));
      expect(response?.status).toBe(404);
      expect(response?.headers.get("cache-control")).toBe("no-store");
    }
    expect(calls).toEqual([]);
  });
});

describe("query API", () => {
  it("answers 409 not_installed on every report route before install, and meta says so", async () => {
    const { sql, calls } = stubSql({ installed: () => false });
    const s = server(sql);
    for (const path of [...REPORTS.map((name) => `/api/${name}`), "/api/events"]) {
      const response = await s.handle(get(`/analytics${path}`));
      expect(response?.status).toBe(409);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      await expect(response?.json()).resolves.toMatchObject({ error: "not_installed", installed: false, pending: [1] });
    }
    expect(calls.some((text) => !text.includes("to_regclass"))).toBe(false);

    const meta = await s.handle(get("/analytics/api/meta"));
    expect(meta?.status).toBe(200);
    await expect(meta?.json()).resolves.toMatchObject({ install: { installed: false, version: 0, pending: [1] } });
  });

  it("re-checks a missing install on each request and caches only a current one", async () => {
    let installed = false;
    const { sql, calls } = stubSql({ installed: () => installed });
    const s = server(sql);
    expect((await s.handle(get("/analytics/api/funnels")))?.status).toBe(409);
    installed = true;
    expect((await s.handle(get("/analytics/api/funnels")))?.status).toBe(200);
    const before = calls.length;
    expect((await s.handle(get("/analytics/api/funnels")))?.status).toBe(200);
    // Funnels with none configured run no SQL, and the install answer is cached.
    expect(calls.length).toBe(before);
  });

  it("answers 400 with the message for a bad range, option, format, table or limit", async () => {
    const { sql } = stubSql();
    const s = server(sql, { metrics: { funnels: [{ key: "signup", name: "Sign-up", steps: ["a", "b"] }] } });
    const cases: [string, RegExp][] = [
      ["/api/overview?from=2026-02-30", /from must be a calendar date/],
      ["/api/web?from=2026-11-10&to=2026-11-01", /to must be on or after from/],
      ["/api/product?from=2025-01-01&to=2026-11-27", /at most 400 days/],
      ["/api/retention?mode=weekly", /mode must be one of/],
      ["/api/funnels?key=nope", /no funnel with key "nope"/],
      ["/api/revenue?format=xml", /format must be json or csv/],
      ["/api/web?format=csv&table=nope", /table must be one of daily, totals, breakdowns, pages/],
      ["/api/events?limit=ten", /limit must be a whole number/],
      ["/api/events?before=nope", /before must be a cursor/],
    ];
    for (const [path, message] of cases) {
      const response = await s.handle(get(`/analytics${path}`));
      expect({ path, status: response?.status }).toEqual({ path, status: 400 });
      expect(response?.headers.get("cache-control")).toBe("no-store");
      const body = (await response?.json()) as { error: string };
      expect(body.error).toMatch(message);
    }
  });

  it("answers 500 with a generic body and reports any other error", async () => {
    const onError = jest.fn();
    const { sql } = stubSql({
      onReport: () => {
        throw Object.assign(new Error("relation secret_table is broken"), { code: "XX000" });
      },
    });
    const s = server(sql, { onError });
    const response = await s.handle(get("/analytics/api/overview"));
    expect(response?.status).toBe(500);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    await expect(response?.json()).resolves.toEqual({ error: "internal error" });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "relation secret_table is broken" }), "GET /api/overview");
  });

  it("turns a SQL error into 409 when the tables went away after being seen", async () => {
    let installed = true;
    const { sql } = stubSql({
      installed: () => installed,
      onReport: () => {
        installed = false;
        throw Object.assign(new Error('relation "analytics_events" does not exist'), { code: "42P01" });
      },
    });
    const s = server(sql, { metrics: { funnels: [] } });
    expect((await s.handle(get("/analytics/api/funnels")))?.status).toBe(200);
    const response = await s.handle(get("/analytics/api/web"));
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ error: "not_installed" });
  });

  it("serves CSV with a dated filename from the resolved range", async () => {
    const { sql } = stubSql();
    const s = server(sql);
    const response = await s.handle(get("/analytics/api/funnels?format=csv"));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("content-disposition")).toBe('attachment; filename="analytics-funnels-2026-10-29_2026-11-27.csv"');
    // `text()` strips a byte order mark, so read the bytes: spreadsheets need it to open the file as UTF-8.
    const bytes = new Uint8Array(await response!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text).toBe("﻿funnel_key,funnel_name,window_days,step_number,step,actors,from_first_rate,from_first_status,from_previous_rate,from_previous_status,median_seconds_from_previous,open\r\n");
  });

  it("describes the configuration in meta", async () => {
    const { sql } = stubSql();
    const s = server(sql, {
      basePath: "/stats/",
      links: { web: "https://example.com" },
      metrics: {
        timezone: "Pacific/Auckland",
        activation: { event: "project_created" },
        retentionDays: [7, 1],
        funnels: [{ key: "signup", name: "Sign-up", steps: ["a", "b"], windowDays: 3 }],
      },
    });
    const response = await s.handle(get("/stats/api/meta"));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    await expect(response?.json()).resolves.toEqual({
      appId: "test",
      basePath: "/stats",
      timezone: "Pacific/Auckland",
      // 12:00 UTC on Nov 27 is already Nov 28 in Auckland.
      today: "2026-11-28",
      install: { installed: true, version: 1, latest: 1, pending: [] },
      activation: { event: "project_created", withinDays: 7 },
      links: true,
      funnels: [{ key: "signup", name: "Sign-up", steps: ["a", "b"], windowDays: 3 }],
      retentionDays: [1, 7],
    });
  });
});

describe("server.metrics", () => {
  it("exposes every report and validates input like the routes", async () => {
    const { sql, calls } = stubSql();
    const s = server(sql);
    expect(Object.keys(s.metrics).sort()).toEqual([...REPORTS, "events"].sort());
    await expect(s.metrics.funnels()).resolves.toMatchObject({ funnels: [], range: { from: "2026-10-29", to: "2026-11-27", days: 30 } });
    await expect(s.metrics.overview({ from: "nope" })).rejects.toBeInstanceOf(MetricsInputError);
    await expect(s.metrics.retention(undefined, { mode: "weekly" as never })).rejects.toBeInstanceOf(MetricsInputError);
    await expect(s.metrics.events({ before: "nope" })).rejects.toBeInstanceOf(MetricsInputError);
    expect(calls).toEqual([]);
  });

  it("rejects a metrics config no report could use when the server is created", () => {
    const { sql } = stubSql();
    expect(() => server(sql, { metrics: { timezone: "Mars/Olympus" } })).toThrow(/unknown time zone/);
    expect(() => server(sql, { metrics: { retentionDays: [1.5] } })).toThrow(/retentionDays/);
    expect(() =>
      server(sql, {
        metrics: {
          funnels: [
            { key: "a", name: "A", steps: ["x"] },
            { key: "a", name: "B", steps: ["y"] },
          ],
        },
      }),
    ).toThrow(/share the key "a"/);
  });
});

describe("dashboard routes", () => {
  it("serves the page with privacy headers and asset URLs under the base path", async () => {
    const { sql } = stubSql();
    for (const [basePath, prefix] of [
      [undefined, "/analytics"],
      ["/", ""],
      ["stats", "/stats"],
    ] as const) {
      const s = server(sql, { basePath });
      for (const path of prefix === "" ? ["/"] : [prefix, `${prefix}/`]) {
        const response = await s.handle(get(path));
        expect(response?.status).toBe(200);
        expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(response?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
        expect(response?.headers.get("referrer-policy")).toBe("same-origin");
        expect(response?.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response?.headers.get("cache-control")).toBe("no-store");
        expect(response?.headers.get("content-security-policy")).toContain("script-src 'self'");
        const html = await response!.text();
        expect(html).toContain(`<script src="${prefix}/assets/dashboard.js" defer></script>`);
        expect(html).toContain(`<link rel="stylesheet" href="${prefix}/assets/dashboard.css">`);
        expect(html).toContain(`data-base="${prefix}"`);
      }
    }
  });

  it("serves the script and stylesheet with their types", async () => {
    const s = server(stubSql().sql);
    const js = await s.handle(get("/analytics/assets/dashboard.js"));
    expect(js?.status).toBe(200);
    expect(js?.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(js?.headers.get("x-content-type-options")).toBe("nosniff");
    expect(js?.headers.get("cache-control")).toBe("no-store");
    expect(await js!.text()).toMatch(/^\(function \(\) \{/);
    const css = await s.handle(get("/analytics/assets/dashboard.css"));
    expect(css?.status).toBe(200);
    expect(css?.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(await css!.text()).toContain(":root");
  });
});
