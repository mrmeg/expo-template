/**
 * API client contract: the bearer token comes from whatever getter the auth
 * feature registered at startup, requests resolve against the right origin, and
 * this module never reaches into auth.
 *
 * What must hold:
 *   - no getter registered (auth disabled) → no Authorization header, and the
 *     request still goes out;
 *   - a registered getter's token becomes `Authorization: Bearer <token>`;
 *   - a getter that has no session (`null`) or fails behaves like "no token";
 *   - web requests stay relative; native ones go to `EXPO_PUBLIC_API_URL`, and a
 *     native release build without it rejects before calling `fetch`;
 *   - nothing under client/lib/api imports a feature module (the old import of
 *     `@/client/features/auth/provider` is what made media and billing depend
 *     on auth).
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Platform } from "react-native";

import {
  api,
  authenticatedFetch,
  getAuthData,
  isApiOriginError,
  setAuthTokenGetter,
} from "../authenticatedFetch";

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

describe("authenticatedFetch request URL", () => {
  const originalFetch = global.fetch;
  const originalPlatform = Platform.OS as "web" | "ios" | "android";
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const globalWithDev = globalThis as unknown as { __DEV__: boolean };
  const originalDev = globalWithDev.__DEV__;
  let fetchMock: jest.Mock;

  function setPlatform(os: "web" | "ios" | "android") {
    Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  }

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setPlatform(originalPlatform);
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    globalWithDev.__DEV__ = originalDev;
  });

  it("keeps same-origin relative requests on web", async () => {
    setPlatform("web");
    process.env.EXPO_PUBLIC_API_URL = "https://app.example.dev";

    await api.get("/api/billing/summary");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/billing/summary");
  });

  it("sends native requests to EXPO_PUBLIC_API_URL", async () => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_API_URL = "https://app.example.dev/api";

    await api.post("/api/billing/portal-session", { returnPath: "/billing/return" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://app.example.dev/api/billing/portal-session");
  });

  it("rejects before any request in a native release build without an origin", async () => {
    setPlatform("android");
    delete process.env.EXPO_PUBLIC_API_URL;
    globalWithDev.__DEV__ = false;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const failure = await api.get("/api/billing/summary").catch((error: unknown) => error);

    expect(isApiOriginError(failure)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("API request failed:", failure);
  });

  it("passes absolute URLs through unchanged", async () => {
    setPlatform("ios");
    delete process.env.EXPO_PUBLIC_API_URL;
    globalWithDev.__DEV__ = false;

    await authenticatedFetch("https://app.example.dev/api/media/list?mediaType=avatars");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.example.dev/api/media/list?mediaType=avatars",
    );
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
