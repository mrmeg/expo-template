/**
 * Exceeding a canvas ceiling does not throw — it silently draws a blank bitmap,
 * which uploads cleanly and passes every size check. That makes this table the
 * only thing standing between an iOS Safari user and a transparent 6000px
 * "photo", so the per-engine values are pinned.
 */

import {
  CANVAS_LIMIT_CHROMIUM,
  CANVAS_LIMIT_DEFAULT,
  CANVAS_LIMIT_FIREFOX,
  CANVAS_LIMIT_IOS,
  canvasLongEdgeLimitFor,
  clampLongEdgeToCanvasLimit,
} from "../canvasLimits";

const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DESKTOP_FIREFOX =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("canvas limit constants", () => {
  it("pins the per-engine ceilings", () => {
    expect(CANVAS_LIMIT_IOS).toBe(4096);
    expect(CANVAS_LIMIT_FIREFOX).toBe(11180);
    expect(CANVAS_LIMIT_CHROMIUM).toBe(16384);
  });

  it("defaults to the most conservative ceiling", () => {
    expect(CANVAS_LIMIT_DEFAULT).toBe(CANVAS_LIMIT_IOS);
  });
});

describe("canvasLongEdgeLimitFor", () => {
  it("uses the iOS ceiling for every iOS browser, whatever engine it claims", () => {
    expect(canvasLongEdgeLimitFor(IOS_SAFARI)).toBe(CANVAS_LIMIT_IOS);
    expect(canvasLongEdgeLimitFor(IOS_CHROME)).toBe(CANVAS_LIMIT_IOS);
  });

  it("uses the Firefox ceiling for desktop Firefox", () => {
    expect(canvasLongEdgeLimitFor(DESKTOP_FIREFOX)).toBe(CANVAS_LIMIT_FIREFOX);
  });

  it("uses the Chromium ceiling for Chrome, Android Chrome, and desktop Safari", () => {
    expect(canvasLongEdgeLimitFor(DESKTOP_CHROME)).toBe(CANVAS_LIMIT_CHROMIUM);
    expect(canvasLongEdgeLimitFor(ANDROID_CHROME)).toBe(CANVAS_LIMIT_CHROMIUM);
    expect(canvasLongEdgeLimitFor(DESKTOP_SAFARI)).toBe(CANVAS_LIMIT_CHROMIUM);
  });

  it("falls back to the conservative ceiling for an unknown or missing UA", () => {
    expect(canvasLongEdgeLimitFor(undefined)).toBe(CANVAS_LIMIT_DEFAULT);
    expect(canvasLongEdgeLimitFor(null)).toBe(CANVAS_LIMIT_DEFAULT);
    expect(canvasLongEdgeLimitFor("")).toBe(CANVAS_LIMIT_DEFAULT);
    expect(canvasLongEdgeLimitFor("SomeEmbeddedWebView/1.0")).toBe(CANVAS_LIMIT_DEFAULT);
  });

  it("is case-insensitive", () => {
    expect(canvasLongEdgeLimitFor(IOS_SAFARI.toUpperCase())).toBe(CANVAS_LIMIT_IOS);
  });
});

describe("clampLongEdgeToCanvasLimit", () => {
  it("leaves a request that already fits untouched", () => {
    expect(clampLongEdgeToCanvasLimit(2048, CANVAS_LIMIT_IOS)).toBe(2048);
    expect(clampLongEdgeToCanvasLimit(4096, CANVAS_LIMIT_IOS)).toBe(4096);
  });

  it("clamps a request above the ceiling", () => {
    expect(clampLongEdgeToCanvasLimit(6000, CANVAS_LIMIT_IOS)).toBe(CANVAS_LIMIT_IOS);
  });

  it("passes non-positive or non-finite values through unchanged", () => {
    // The caller treats `0`/`null` long edges as "no cap"; clamping must not
    // invent one.
    expect(clampLongEdgeToCanvasLimit(0, CANVAS_LIMIT_IOS)).toBe(0);
    expect(clampLongEdgeToCanvasLimit(-1, CANVAS_LIMIT_IOS)).toBe(-1);
    expect(clampLongEdgeToCanvasLimit(Number.POSITIVE_INFINITY, CANVAS_LIMIT_IOS)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("ignores an unusable limit", () => {
    expect(clampLongEdgeToCanvasLimit(9000, 0)).toBe(9000);
    expect(clampLongEdgeToCanvasLimit(9000, Number.NaN)).toBe(9000);
  });
});
