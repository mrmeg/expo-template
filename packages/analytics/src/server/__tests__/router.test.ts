/**
 * @jest-environment node
 */
import { LIMITS } from "../../shared/wire";
import { dispatch, type AnalyticsContext, type Route } from "../http";
import { resolveNames } from "../schema";
import { createAnalyticsServer } from "../server";
import type { AnalyticsServerConfig } from "../config";
import type { SqlClient } from "../sql";

/** Fails any query, so these tests prove which paths never reach the database. */
const noDb: SqlClient = {
  async query() {
    throw new Error("unexpected query");
  },
  async transaction() {
    throw new Error("unexpected transaction");
  },
};

const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const ORIGIN = "https://app.example.com";

function server(over: Partial<AnalyticsServerConfig> = {}) {
  return createAnalyticsServer({ sql: noDb, appId: "test", onError: () => {}, ...over });
}

function post(path: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`https://api.example.com${path}`, { method: "POST", body, headers: { "user-agent": BOT, ...headers } });
}

describe("createAnalyticsServer.handle", () => {
  it("returns null outside the base path", async () => {
    const s = server();
    await expect(s.handle(new Request("https://api.example.com/other"))).resolves.toBeNull();
    await expect(s.handle(new Request("https://api.example.com/analyticsx/e"))).resolves.toBeNull();
    const custom = server({ basePath: "/stats/" });
    expect(custom.basePath).toBe("/stats");
    await expect(custom.handle(new Request("https://api.example.com/analytics/e"))).resolves.toBeNull();
  });

  it("answers 404 for unknown paths under the base path", async () => {
    const response = await server().handle(new Request("https://api.example.com/analytics/nope"));
    expect(response?.status).toBe(404);
  });

  it("accepts a text/plain beacon and stores nothing for a bot", async () => {
    const body = JSON.stringify({ events: [{ id: "5e0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d", name: "x", ts: "" }] });
    const response = await server().handle(post("/analytics/e", body, { "content-type": "text/plain" }));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({ received: 1, inserted: 0, rejected: 0, duplicates: 0 });
  });

  it("answers 400 for a body that is not a batch", async () => {
    expect((await server().handle(post("/analytics/e", "{not json")))?.status).toBe(400);
    expect((await server().handle(post("/analytics/e", JSON.stringify({ events: "x" }))))?.status).toBe(400);
    const tooMany = { events: Array.from({ length: LIMITS.batchMaxEvents + 1 }, () => ({})) };
    expect((await server().handle(post("/analytics/e", JSON.stringify(tooMany))))?.status).toBe(400);
  });

  it("answers 413 on the declared and on the read size", async () => {
    const declared = post("/analytics/e", "{}", { "content-length": String(LIMITS.bodyMaxBytes + 1) });
    expect((await server().handle(declared))?.status).toBe(413);

    const big = "x".repeat(LIMITS.bodyMaxBytes + 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const undeclared = new Request("https://api.example.com/analytics/e", {
      method: "POST",
      body: stream,
      // @ts-expect-error `duplex` is required by Node for stream bodies but missing from the DOM types.
      duplex: "half",
    });
    expect(undeclared.headers.get("content-length")).toBeNull();
    expect((await server().handle(undeclared))?.status).toBe(413);
  });

  it("refuses cross-origin posts unless the origin is allowed", async () => {
    const body = JSON.stringify({ events: [] });
    const refused = await server().handle(post("/analytics/e", body, { origin: ORIGIN }));
    expect(refused?.status).toBe(403);

    const sameOrigin = await server().handle(post("/analytics/e", body, { origin: "https://api.example.com" }));
    expect(sameOrigin?.status).toBe(200);

    const listed = await server({ allowedOrigins: [ORIGIN] }).handle(post("/analytics/e", body, { origin: ORIGIN }));
    expect(listed?.status).toBe(200);
    expect(listed?.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(listed?.headers.get("access-control-allow-credentials")).toBe("true");

    const any = await server({ allowedOrigins: "*" }).handle(post("/analytics/e", body, { origin: ORIGIN }));
    expect(any?.headers.get("access-control-allow-origin")).toBe("*");
    expect(any?.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("answers CORS preflight per allowedOrigins", async () => {
    const preflight = (s: ReturnType<typeof server>) =>
      s.handle(
        new Request("https://api.example.com/analytics/e", {
          method: "OPTIONS",
          headers: { origin: ORIGIN, "access-control-request-method": "POST" },
        }),
      );
    const allowed = await preflight(server({ allowedOrigins: [ORIGIN] }));
    expect(allowed?.status).toBe(204);
    expect(allowed?.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(allowed?.headers.get("access-control-allow-methods")).toContain("POST");

    const closed = await preflight(server());
    expect(closed?.status).toBe(204);
    expect(closed?.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers 500 and reports instead of throwing", async () => {
    const onError = jest.fn();
    const s = createAnalyticsServer({
      sql: noDb,
      appId: "test",
      onError,
      resolveUserId: () => null,
    });
    const body = JSON.stringify({
      events: [{ id: "5e0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d", name: "x", ts: new Date().toISOString() }],
    });
    const response = await s.handle(post("/analytics/e", body, { "user-agent": "Mozilla/5.0 (Macintosh)" }));
    expect(response?.status).toBe(500);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "POST /analytics/e");
  });

  it("serves tracked links only when configured", async () => {
    const request = () => new Request("https://api.example.com/analytics/go/tiktok", { method: "HEAD" });
    expect((await server().handle(request()))?.status).toBe(404);
    const withLinks = server({ links: { web: "https://example.com/" } });
    const response = await withLinks.handle(request());
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toMatch(/^https:\/\/example\.com\/\?utm_source=tiktok/);
    expect((await withLinks.handle(new Request("https://api.example.com/analytics/go/Bad!", { method: "HEAD" })))?.status).toBe(404);
  });

  it("rejects an invalid appId", () => {
    expect(() => createAnalyticsServer({ sql: noDb, appId: "" })).toThrow(/invalid appId/);
  });
});

describe("dispatch", () => {
  const adminRoute: Route = {
    method: "GET",
    pattern: "/admin/:thing",
    access: "admin",
    handler: async (_ctx, { params }) => new Response(params.thing),
  };

  function context(isAdmin?: AnalyticsServerConfig["isAdmin"]): AnalyticsContext {
    return {
      config: { sql: noDb, appId: "test", isAdmin },
      names: resolveNames(),
      sql: noDb,
      appId: "test",
      now: () => new Date(),
      reportError: () => {},
    };
  }

  const request = new Request("https://api.example.com/analytics/admin/widgets");

  it("answers 404 to non-admins, by default and when isAdmin says no", async () => {
    expect((await dispatch(context(), [adminRoute], "/analytics", request))?.status).toBe(404);
    expect((await dispatch(context(() => false), [adminRoute], "/analytics", request))?.status).toBe(404);
  });

  it("runs admin routes for admins with decoded params", async () => {
    const response = await dispatch(context(async () => true), [adminRoute], "/analytics", request);
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("widgets");
  });
});
