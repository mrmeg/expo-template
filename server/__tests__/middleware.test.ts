/**
 * @jest-environment node
 */

/**
 * `app/+middleware.ts`, run through Expo Server's real request pipeline — the
 * matcher, the per-request scope `setResponseHeaders` writes into, and the
 * header merge after the route answers — with the real template API routes
 * mounted, as the dev server, `expo serve`, and the Bun server run it.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createRequestHandler } from "expo-server/vendor/abstract";
import { createNodeRequestScope } from "expo-server/vendor/environment/node";

import * as middlewareModule from "@/app/+middleware";
import * as templateStatusRoute from "@/app/api/template/status+api";

const ALLOWED_ORIGIN = "https://app.example.com";

type TestRoute = {
  file: string;
  page: string;
  namedRegex: RegExp;
  routeKeys: Record<string, string>;
  loader?: string;
};

const statusRoute: TestRoute = {
  file: "api/template/status+api.js",
  page: "/api/template/status",
  namedRegex: /^\/api\/template\/status(?:\/)?$/,
  routeKeys: {},
};

const serverAlphaRoute: TestRoute = {
  file: "./(main)/(demos)/server-alpha/index.tsx",
  page: "/(main)/(demos)/server-alpha/index",
  namedRegex: /^(?:\/\(main\))?(?:\/\(demos\))?\/server-alpha(?:\/)?$/,
  routeKeys: {},
  loader: "_expo/loaders/(main)/(demos)/server-alpha/index.js",
};

const settingsRoute: TestRoute = {
  file: "./(main)/(tabs)/settings.tsx",
  page: "/(main)/(tabs)/settings",
  namedRegex: /^(?:\/\(main\))?(?:\/\(tabs\))?\/settings(?:\/)?$/,
  routeKeys: {},
};

const handler = createRequestHandler({
  getRoutesManifest: async () =>
    ({
      middleware: { file: "_expo/functions/+middleware.js" },
      htmlRoutes: [serverAlphaRoute, settingsRoute],
      apiRoutes: [statusRoute],
      notFoundRoutes: [],
      redirects: [],
      rewrites: [],
    }) as never,
  getMiddleware: async () => middlewareModule as never,
  getApiRoute: async () => templateStatusRoute,
  getHtml: async () => "<!DOCTYPE html><html><body>page</body></html>",
  getLoaderData: async () => Response.json({ loader: true }),
});

const runInScope = createNodeRequestScope(new AsyncLocalStorage(), { build: "" });

function send(pathname: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return runInScope(handler, new Request(`http://localhost${pathname}`, init));
}

describe("app/+middleware.ts", () => {
  const originalOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
  });

  afterEach(() => {
    if (originalOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalOrigins;
  });

  it("tags API responses and applies the shared CORS grant, merging Vary", async () => {
    const response = await send("/api/template/status", { headers: { Origin: ALLOWED_ORIGIN } });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Expo-Router-Middleware")).toBe("1");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    // The route already sent Vary: Origin; the middleware must not repeat it.
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("varies API responses on Origin without a grant for a missing or foreign origin", async () => {
    for (const headers of [{}, { Origin: "https://evil.example" }] as Record<string, string>[]) {
      const response = await send("/api/template/status", { headers });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Vary")).toBe("Origin");
    }
  });

  it("adds CORS to responses the route never wrote, like Expo Server's 405", async () => {
    const response = await send("/api/template/status", { method: "PUT", headers: { Origin: ALLOWED_ORIGIN } });

    expect(response.status).toBe(405);
    expect(response.headers.get("X-Expo-Router-Middleware")).toBe("1");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("keeps the route's preflight headers on OPTIONS", async () => {
    const response = await send("/api/template/status", {
      method: "OPTIONS",
      headers: { Origin: ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("tags matched pages and their loader requests without CORS headers", async () => {
    for (const pathname of ["/server-alpha", "/_expo/loaders/server-alpha"]) {
      const response = await send(pathname, { headers: { Origin: ALLOWED_ORIGIN } });
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Expo-Router-Middleware")).toBe("1");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Vary")).toBeNull();
    }
  });

  it("does not run on paths outside its matcher", async () => {
    const response = await send("/settings", { headers: { Origin: ALLOWED_ORIGIN } });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Expo-Router-Middleware")).toBeNull();
  });
});
