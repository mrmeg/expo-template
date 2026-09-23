/**
 * API client contract: the bearer token comes from whatever getter the auth
 * feature registered at startup, and this module never reaches into auth.
 *
 * What must hold:
 *   - no getter registered (auth disabled) → no Authorization header, and the
 *     request still goes out;
 *   - a registered getter's token becomes `Authorization: Bearer <token>`;
 *   - a getter that has no session (`null`) or fails behaves like "no token";
 *   - nothing under client/lib/api imports a feature module (the old import of
 *     `@/client/features/auth/provider` is what made media and billing depend
 *     on auth).
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { api, getAuthData, setAuthTokenGetter } from "../authenticatedFetch";

function okResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
}

describe("authenticatedFetch token source", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAuthTokenGetter(null);
  });

  function sentHeaders(): Headers {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return fetchMock.mock.calls[0][1].headers as Headers;
  }

  it("sends no Authorization header when no getter is registered", async () => {
    await api.get("/api/billing/summary");

    expect(sentHeaders().has("Authorization")).toBe(false);
    await expect(getAuthData()).resolves.toEqual({ token: undefined });
  });

  it("attaches the registered getter's token as a bearer token", async () => {
    setAuthTokenGetter(async () => "tok_123");

    await api.post("/api/billing/checkout-session", { planId: "pro" });

    expect(sentHeaders().get("Authorization")).toBe("Bearer tok_123");
  });

  it("treats a getter with no session like no token", async () => {
    setAuthTokenGetter(async () => null);

    await api.get("/api/media/list");

    expect(sentHeaders().has("Authorization")).toBe(false);
  });

  it("still sends the request when the getter fails", async () => {
    setAuthTokenGetter(async () => {
      throw new Error("session lookup failed");
    });

    await api.delete("/api/media/delete", { key: "uploads/a.jpg" });

    expect(sentHeaders().has("Authorization")).toBe(false);
  });

  it("uses the latest registration", async () => {
    setAuthTokenGetter(async () => "first");
    setAuthTokenGetter(async () => "second");

    await expect(getAuthData()).resolves.toEqual({ token: "second" });
  });
});

describe("client/lib/api feature isolation", () => {
  it("imports no feature modules", () => {
    const dir = join(__dirname, "..");
    const sources = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name));

    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const text = readFileSync(join(dir, name), "utf8");
      expect({ name, importsFeature: /from\s+["']@\/client\/features\//.test(text) }).toEqual({
        name,
        importsFeature: false,
      });
    }
  });
});
