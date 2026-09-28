/**
 * Where `/api/*` requests go.
 *
 * Web keeps relative, same-origin paths. Native resolves them against
 * `EXPO_PUBLIC_API_URL`; development without it leaves the path to Expo's fetch
 * polyfill (the dev server), and a release build without it fails closed with a
 * clear error instead of sending a relative request that can only fail.
 */
import { Platform } from "react-native";

import {
  ApiOriginError,
  describeApiBaseUrl,
  isApiOriginError,
  normalizeApiOrigin,
  resolveApiOrigin,
  resolveApiUrl,
} from "../apiOrigin";

type OS = "web" | "ios" | "android";

const originalPlatform = Platform.OS as OS;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const globalWithDev = globalThis as unknown as { __DEV__: boolean };
const originalDev = globalWithDev.__DEV__;

function setPlatform(os: OS) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

function setApiUrl(value: string | undefined) {
  if (value === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = value;
}

/** A release build: Metro's `__DEV__` is false. */
function releaseBuild() {
  globalWithDev.__DEV__ = false;
}

afterEach(() => {
  setPlatform(originalPlatform);
  setApiUrl(originalApiUrl);
  globalWithDev.__DEV__ = originalDev;
});

describe("normalizeApiOrigin", () => {
  it.each([
    ["https://app.example.dev", "https://app.example.dev"],
    ["https://app.example.dev/", "https://app.example.dev"],
    ["https://app.example.dev/api", "https://app.example.dev"],
    ["https://app.example.dev/api/", "https://app.example.dev"],
    ["  http://192.168.4.28:8081  ", "http://192.168.4.28:8081"],
    ["HTTPS://App.Example.dev/API", "HTTPS://App.Example.dev"],
  ])("normalizes %p to a bare origin", (raw, expected) => {
    expect(normalizeApiOrigin(raw)).toBe(expected);
  });

  it.each([
    [undefined],
    [""],
    ["   "],
    ["/api"],
    ["localhost:3000"],
    ["ftp://files.example.dev"],
    ["https://api.example.com"],
    ["https://api.example.com/api"],
  ])("rejects %p", (raw) => {
    expect(normalizeApiOrigin(raw)).toBeNull();
  });
});

describe("resolveApiOrigin", () => {
  it("keeps web same-origin even when an origin is configured", () => {
    setPlatform("web");
    setApiUrl("https://app.example.dev");

    expect(resolveApiOrigin()).toEqual({ kind: "same-origin" });
  });

  it("uses EXPO_PUBLIC_API_URL on native", () => {
    setPlatform("ios");
    setApiUrl("https://app.example.dev/api");

    expect(resolveApiOrigin()).toEqual({ kind: "configured", origin: "https://app.example.dev" });
  });

  it("leaves native development without an origin to the dev server", () => {
    setPlatform("android");
    setApiUrl("");

    expect(resolveApiOrigin()).toEqual({ kind: "dev-server" });
  });

  it("reports a native release build without an origin as unconfigured", () => {
    setPlatform("ios");
    setApiUrl("");
    releaseBuild();

    expect(resolveApiOrigin()).toEqual({ kind: "unconfigured" });
  });

  it("treats the old placeholder origin as unconfigured", () => {
    setPlatform("ios");
    setApiUrl("https://api.example.com");
    releaseBuild();

    expect(resolveApiOrigin()).toEqual({ kind: "unconfigured" });
  });
});

describe("resolveApiUrl", () => {
  it("keeps paths relative on web", () => {
    setPlatform("web");
    setApiUrl("https://app.example.dev");

    expect(resolveApiUrl("/api/billing/summary")).toBe("/api/billing/summary");
  });

  it("prefixes native paths with the configured origin, adding /api exactly once", () => {
    setPlatform("ios");
    setApiUrl("https://app.example.dev/api/");

    expect(resolveApiUrl("/api/billing/summary")).toBe(
      "https://app.example.dev/api/billing/summary",
    );
  });

  it("passes the path through in native development without an origin", () => {
    setPlatform("ios");
    setApiUrl(undefined);

    expect(resolveApiUrl("/api/billing/summary")).toBe("/api/billing/summary");
  });

  it("fails closed in a native release build without an origin", () => {
    setPlatform("android");
    setApiUrl(undefined);
    releaseBuild();

    let thrown: unknown;
    try {
      resolveApiUrl("/api/billing/summary");
    } catch (error) {
      thrown = error;
    }

    expect(isApiOriginError(thrown)).toBe(true);
    expect((thrown as ApiOriginError).path).toBe("/api/billing/summary");
    expect((thrown as ApiOriginError).message).toContain("EXPO_PUBLIC_API_URL");
  });

  it("passes absolute URLs through untouched, configured or not", () => {
    setPlatform("ios");
    setApiUrl(undefined);
    releaseBuild();

    expect(resolveApiUrl("https://media.example.dev/api/media/list")).toBe(
      "https://media.example.dev/api/media/list",
    );
  });
});

describe("describeApiBaseUrl", () => {
  it("shows the relative base on web", () => {
    setPlatform("web");

    expect(describeApiBaseUrl()).toBe("/api");
  });

  it("shows the configured native base", () => {
    setPlatform("ios");
    setApiUrl("https://app.example.dev");

    expect(describeApiBaseUrl()).toBe("https://app.example.dev/api");
  });

  it("shows the dev server in native development", () => {
    setPlatform("ios");
    setApiUrl(undefined);

    expect(describeApiBaseUrl()).toMatch(/^http:\/\/[^/]+\/api$/);
  });

  it("shows nothing for an unconfigured native release build", () => {
    setPlatform("ios");
    setApiUrl(undefined);
    releaseBuild();

    expect(describeApiBaseUrl()).toBe("");
  });
});
