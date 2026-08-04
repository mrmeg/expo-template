/**
 * `resolveMediaBasePath` contract.
 *
 * Web keeps the relative path (same-origin SSR server). Native needs an absolute
 * origin, normalized so `/api/media` is appended exactly once, and must report
 * "unconfigured" for blank/whitespace/placeholder values so the media screen can
 * fail closed without a request.
 */
import { Platform } from "react-native";

import { resolveMediaBasePath } from "../mediaOrigin";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

function setApiUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
    return;
  }
  process.env.EXPO_PUBLIC_API_URL = value;
}

function setPlatform(os: "web" | "ios" | "android") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

describe("resolveMediaBasePath", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    setPlatform(originalPlatform as "web" | "ios" | "android");
    setApiUrl(originalApiUrl);
  });

  it("uses the relative path on web even with a blank env", () => {
    setPlatform("web");
    setApiUrl("");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "/api/media",
    });
  });

  it("uses the relative path on web even when an origin is configured", () => {
    setPlatform("web");
    setApiUrl("https://x.dev");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "/api/media",
    });
  });

  it("appends /api/media to a bare native origin", () => {
    setPlatform("ios");
    setApiUrl("https://x.dev");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "https://x.dev/api/media",
    });
  });

  it("does not double the /api segment when the origin already ends in /api", () => {
    setPlatform("ios");
    setApiUrl("https://x.dev/api");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "https://x.dev/api/media",
    });
  });

  it("strips trailing slashes", () => {
    setPlatform("android");
    setApiUrl("https://x.dev/api//");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "https://x.dev/api/media",
    });
  });

  it("keeps a port in the origin", () => {
    setPlatform("ios");
    setApiUrl("http://localhost:3000/api");

    expect(resolveMediaBasePath()).toEqual({
      configured: true,
      basePath: "http://localhost:3000/api/media",
    });
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "   "],
    ["unset", undefined],
    ["the prod placeholder", "https://api.example.com"],
    ["the prod placeholder with /api", "https://api.example.com/api"],
    ["a relative value", "/api"],
  ])("reports unconfigured on native for %s", (_label, value) => {
    setPlatform("ios");
    setApiUrl(value);

    expect(resolveMediaBasePath()).toEqual({ configured: false });
  });
});
