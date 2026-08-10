/**
 * SSR viewport metrics plumbing.
 *
 * `RootLayout` has to hand `SafeAreaProvider` a real frame on web, or the whole
 * tree lays out at width 0 during SSR: expo-router's `Header` computes
 * `maxWidth: layout.width - 68` and ships `max-width:-68px`, centered
 * containers collapse, and the first paint disagrees with the hydrated tree
 * (React #418).
 *
 * These tests cover the seam RootLayout consumes — `resolveSsrInitialMetrics()`
 * — rather than mounting the whole root shell (which drags Clerk, the query
 * client, splash screen, and the entire navigation tree in). The shape they
 * pin is the one `SafeAreaProvider` reads: `initialMetrics.frame.width`.
 */

import { Platform } from "react-native";

import { SSR_VIEWPORT } from "@/server/lib/ssrViewport";

const importSubject = () => require("../ssrViewportMetrics");

describe("resolveSsrInitialMetrics on web", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.resetModules();
    Platform.OS = "web";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("returns metrics whose frame width is the detected viewport width", () => {
    // No request scope in Jest, so detection resolves to the desktop default —
    // which is exactly what a crawler or a first-time desktop visitor gets.
    const { resolveSsrInitialMetrics } = importSubject();
    const metrics = resolveSsrInitialMetrics();

    expect(metrics).not.toBeUndefined();
    expect(metrics!.frame.width).toBe(SSR_VIEWPORT.DESKTOP);
    expect(metrics!.frame.height).toBeGreaterThan(0);
  });

  it("anchors the frame at the origin", () => {
    const { resolveSsrInitialMetrics } = importSubject();
    const metrics = resolveSsrInitialMetrics();

    expect(metrics!.frame.x).toBe(0);
    expect(metrics!.frame.y).toBe(0);
  });

  it("reports zero insets so the server and the browser agree on first render", () => {
    // The browser cannot know real insets until the safe-area probe element
    // mounts, so any non-zero value here would be a guaranteed mismatch.
    const { resolveSsrInitialMetrics } = importSubject();

    expect(resolveSsrInitialMetrics()!.insets).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("returns a fresh object per call so no request can mutate another's frame", () => {
    // The frame must never be a shared module singleton: two concurrent SSR
    // requests at different widths would otherwise scribble over each other.
    const { resolveSsrInitialMetrics } = importSubject();
    const first = resolveSsrInitialMetrics();
    const second = resolveSsrInitialMetrics();

    expect(first).not.toBe(second);
    expect(first!.frame).not.toBe(second!.frame);

    first!.frame.width = 1;
    expect(second!.frame.width).toBe(SSR_VIEWPORT.DESKTOP);
  });
});

describe("resolveSsrInitialMetrics on native", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.resetModules();
    Platform.OS = "ios";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("returns undefined so SafeAreaProvider keeps its native measurement path", () => {
    // Native has no SSR and real insets it must measure itself; forcing zero
    // insets there would break notch/home-indicator padding.
    const { resolveSsrInitialMetrics } = importSubject();
    expect(resolveSsrInitialMetrics()).toBeUndefined();
  });
});

describe("RootLayout wiring", () => {
  const { readFileSync } = require("fs");
  const { join } = require("path");
  const src = readFileSync(join(__dirname, "..", "RootLayout.tsx"), "utf8");

  it("passes the resolved metrics to SafeAreaProvider", () => {
    // A bare <SafeAreaProvider> falls back to Dimensions.get('window'), which
    // is {width: 0, height: 0} under react-native-web's server build.
    expect(src).toContain("resolveSsrInitialMetrics");
    expect(src).toMatch(/<SafeAreaProvider\s+initialMetrics=\{ssrInitialMetrics\}/);
  });

  it("provides the same width to SsrViewportContext for useDimensions", () => {
    // useDimensions seeds its first render from this context; leaving it on the
    // package default would re-diverge the responsive branch from the frame.
    expect(src).toContain("SsrViewportContext.Provider");
  });
});
