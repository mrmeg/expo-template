/**
 * Tests for the shared CORS helper.
 *
 * Covers origin allowlisting and advertised methods for both normal and
 * preflight responses, including the DELETE method required by
 * `app/api/media/delete+api.ts`.
 */

import { getCorsHeaders, getPreflightHeaders } from "../cors";

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

  it("returns empty headers when no Origin is present (native / same-origin)", () => {
    expect(getCorsHeaders(makeRequest(null))).toEqual({});
  });

  it("echoes back an allowed origin with DELETE among the advertised methods", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081,https://app.example.com";
    const headers = getCorsHeaders(makeRequest("http://localhost:8081"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:8081");
    expect(headers["Access-Control-Allow-Methods"]).toContain("DELETE");
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
    expect(headers.Vary).toBe("Origin");
  });

  it("does not grant Access-Control-Allow-Origin for a disallowed origin", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getCorsHeaders(makeRequest("http://evil.example.com"));

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers.Vary).toBe("Origin");
  });

  it("falls back to the default localhost allowlist when env is unset", () => {
    delete process.env.ALLOWED_ORIGINS;
    const headers = getCorsHeaders(makeRequest("http://localhost:3000"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
  });

  it("preflight advertises DELETE and sets a Max-Age cache window", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getPreflightHeaders(makeRequest("http://localhost:8081"));

    expect(headers["Access-Control-Allow-Methods"]).toContain("DELETE");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("preflight for a disallowed origin still omits Access-Control-Allow-Origin", () => {
    process.env.ALLOWED_ORIGINS = "http://localhost:8081";
    const headers = getPreflightHeaders(makeRequest("http://evil.example.com"));

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });
});
