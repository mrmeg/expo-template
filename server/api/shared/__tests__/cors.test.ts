/**
 * Tests for the shared CORS policy — the one implementation behind the API
 * routes' own headers, `app/+middleware.ts`, and the Bun server.
 *
 * Covers origin allowlisting, what normal and preflight responses advertise
 * (including the DELETE method `app/api/media/[action]+api.ts` serves), the
 * no-credentials rule, and a drift guard that fails when an `app/api` route
 * exports a method the policy does not allow.
 */

import fs from "fs";
import path from "path";

import {
  applyCorsHeaders,
  CORS_ALLOWED_METHODS,
  getAllowedOrigins,
  getCorsHeaders,
  getPreflightHeaders,
  isCorsPath,
  preflightResponse,
} from "../cors";

function makeRequest(origin: string | null): Request {
  const headers = new Headers();
  if (origin) headers.set("Origin", origin);
  return new Request("https://example.com/api", { headers });
}

describe("cors", () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalEnv;
    }
  });

  it("varies on Origin but grants nothing when no Origin is present (native / same-origin)", () => {
    expect(getCorsHeaders(makeRequest(null))).toEqual({ Vary: "Origin" });
  });

  it("echoes back an allowed origin without credentials", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081,https://app.example.com";
    const headers = getCorsHeaders(makeRequest("http://localhost:8081"));

    expect(headers).toEqual({
      "Access-Control-Allow-Origin": "http://localhost:8081",
      Vary: "Origin",
    });
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("does not grant Access-Control-Allow-Origin for a disallowed origin", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getCorsHeaders(makeRequest("http://evil.example.com"));

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers.Vary).toBe("Origin");
  });

  it("falls back to the default localhost allowlist when env is unset or blank", () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(getCorsHeaders(makeRequest("http://localhost:3000"))["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000",
    );

    process.env.ALLOWED_ORIGINS = "";
    expect(getAllowedOrigins()).toEqual(["http://localhost:8081", "http://localhost:3000"]);
  });

  it("normalizes configured origins and ignores empty entries", () => {
    process.env.ALLOWED_ORIGINS = " https://App.Example.com/ , ,http://localhost:8081";
    expect(getAllowedOrigins()).toEqual(["https://app.example.com", "http://localhost:8081"]);
    expect(getCorsHeaders(makeRequest("https://app.example.com"))["Access-Control-Allow-Origin"]).toBe(
      "https://app.example.com",
    );
  });

  it("reads an explicit env over process.env", () => {
    process.env.ALLOWED_ORIGINS = "https://process.example";
    const request = makeRequest("https://explicit.example");
    expect(getCorsHeaders(request, { ALLOWED_ORIGINS: "https://explicit.example" })["Access-Control-Allow-Origin"]).toBe(
      "https://explicit.example",
    );
    expect(getCorsHeaders(request)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("preflight advertises DELETE, the request headers the client sends, and a Max-Age", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getPreflightHeaders(makeRequest("http://localhost:8081"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:8081");
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, DELETE, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization, sentry-trace, baggage");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers.Vary).toBe("Origin");
  });

  it("preflight for a disallowed origin omits the grant and the advertised methods", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getPreflightHeaders(makeRequest("http://evil.example.com"));

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Methods"]).toBeUndefined();
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("preflightResponse answers 204 with the preflight headers", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const response = preflightResponse(makeRequest("http://localhost:8081"));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, DELETE, OPTIONS");
  });

  it("applyCorsHeaders merges Vary and sets the grant in place", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = new Headers({ Vary: "Accept-Encoding" });
    applyCorsHeaders(makeRequest("http://localhost:8081"), headers);
    applyCorsHeaders(makeRequest("http://localhost:8081"), headers);

    expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(headers.get("Vary")).toBe("Accept-Encoding, Origin");
  });

  it("scopes the policy to /api", () => {
    expect(isCorsPath("/api")).toBe(true);
    expect(isCorsPath("/api/media/list")).toBe(true);
    expect(isCorsPath("/apiary")).toBe(false);
    expect(isCorsPath("/server-alpha")).toBe(false);
    expect(isCorsPath("/_expo/loaders/server-alpha")).toBe(false);
  });

  it("allows every HTTP method an app/api route exports", () => {
    const apiRoot = path.resolve(__dirname, "../../../../app/api");
    const routeFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "__tests__") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\+api\.tsx?$/.test(entry.name)) routeFiles.push(full);
      }
    };
    walk(apiRoot);
    expect(routeFiles.length).toBeGreaterThan(0);

    const exported = new Set<string>();
    for (const file of routeFiles) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)) {
        exported.add(match[1]);
      }
    }

    // HEAD is a CORS-safelisted method and needs no entry.
    exported.delete("HEAD");
    expect([...exported].filter((method) => !(CORS_ALLOWED_METHODS as readonly string[]).includes(method))).toEqual([]);
  });
});
