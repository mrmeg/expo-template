import { use, useMemo, useSyncExternalStore } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { SsrViewportContext } from "../state/SsrViewportContext";

/**
 * Viewport the first web render is computed from, before the real window can
 * be read. Desktop is chosen because:
 *   1. A desktop visitor sees no reflow — their real viewport lands in the
 *      same breakpoint.
 *   2. A mobile visitor gets one frame of desktop-styled content before the
 *      post-hydration update snaps to real dimensions — better than the inverse
 *      (every desktop visitor seeing mobile-tiny, then snapping).
 *   3. It matches the frame the app hands `SafeAreaProvider`, and it is the
 *      value the HTML shell `expo export` renders in Node is built from, so
 *      the browser's first render agrees with the markup it hydrates.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1280;
export const DEFAULT_VIEWPORT_HEIGHT = 800;

export const SCREEN_SIZES = {
  SMALL: 768,
  MEDIUM: 1000,
  LARGE: 1200,
} as const;

type WindowDimensions = {
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
}

/**
* Helper function to calculate dimension-based flags
*/
const calculateDimensionFlags = (width: number, height: number): WindowDimensions => {
  const orientation = width > height ? "landscape" : "portrait";
  return {
    width,
    height,
    orientation,
    isSmallScreen: width <= SCREEN_SIZES.SMALL,
    isMediumScreen: width > SCREEN_SIZES.SMALL && width <= SCREEN_SIZES.MEDIUM,
    isLargeScreen: width > SCREEN_SIZES.MEDIUM,
  };
};

// Persist the real viewport width as a cookie so subsequent SSR requests can
// render at the user's actual layout (no reflow on repeat visits). The server
// reads this cookie via resolveSsrViewportWidth in server/lib/ssrViewport.ts.
const SSR_VIEWPORT_COOKIE = "mrmeg-vw";
const SSR_VIEWPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
// Resize fires continuously while a window is dragged; the cookie only has to
// hold the width the drag settled on.
const SSR_VIEWPORT_COOKIE_DEBOUNCE_MS = 250;

// Round to nearest 10 so resize-driven writes don't bust HTTP caching on
// every pixel of horizontal movement.
const roundViewportWidth = (width: number): number => Math.round(width / 10) * 10;

// ---------------------------------------------------------------------------
// Web: one window store shared by every useDimensions() consumer (same shape
// as useReduceMotion's). A single `resize` listener, attached while at least
// one consumer is mounted, updates one snapshot and notifies consumers only
// when the width or height actually changed.
// ---------------------------------------------------------------------------

let windowSnapshot: WindowDimensions | null = null;
const windowListeners = new Set<() => void>();
let writtenCookieWidth: number | null = null;
let pendingCookieWidth: number | null = null;
let cookieTimer: ReturnType<typeof setTimeout> | null = null;

function writeViewportCookie(width: number): void {
  if (typeof document === "undefined") return;
  const rounded = roundViewportWidth(width);
  writtenCookieWidth = rounded;
  document.cookie = `${SSR_VIEWPORT_COOKIE}=${rounded}; path=/; max-age=${SSR_VIEWPORT_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Reads the window, reusing the current snapshot when nothing changed. */
function readWindow(): WindowDimensions {
  const width = typeof window === "undefined" ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth;
  const height = typeof window === "undefined" ? DEFAULT_VIEWPORT_HEIGHT : window.innerHeight;
  if (!windowSnapshot || windowSnapshot.width !== width || windowSnapshot.height !== height) {
    windowSnapshot = calculateDimensionFlags(width, height);
  }
  return windowSnapshot;
}

function flushViewportCookie(): void {
  if (cookieTimer !== null) {
    clearTimeout(cookieTimer);
    cookieTimer = null;
  }
  if (pendingCookieWidth !== null) {
    const width = pendingCookieWidth;
    pendingCookieWidth = null;
    writeViewportCookie(width);
  }
}

function scheduleViewportCookie(width: number): void {
  if (roundViewportWidth(width) === writtenCookieWidth) {
    pendingCookieWidth = null;
    if (cookieTimer !== null) {
      clearTimeout(cookieTimer);
      cookieTimer = null;
    }
    return;
  }
  pendingCookieWidth = width;
  if (cookieTimer !== null) clearTimeout(cookieTimer);
  cookieTimer = setTimeout(flushViewportCookie, SSR_VIEWPORT_COOKIE_DEBOUNCE_MS);
}

function handleWindowResize(): void {
  const previous = windowSnapshot;
  const next = readWindow();
  if (next !== previous) {
    for (const listener of windowListeners) listener();
  }
  scheduleViewportCookie(next.width);
}

// useSyncExternalStore contract: the first consumer attaches the one window
// listener (and records the real width in the cookie, once per page view
// rather than once per consumer); the last one to unmount detaches it.
function subscribeToWindow(listener: () => void): () => void {
  windowListeners.add(listener);
  if (windowListeners.size === 1 && canListenToWindow()) {
    window.addEventListener("resize", handleWindowResize);
    writeViewportCookie(readWindow().width);
  }
  return () => {
    windowListeners.delete(listener);
    if (windowListeners.size === 0 && canListenToWindow()) {
      window.removeEventListener("resize", handleWindowResize);
      flushViewportCookie();
    }
  };
}

function canListenToWindow(): boolean {
  return typeof window !== "undefined" && typeof window.addEventListener === "function";
}

function getWindowSnapshot(): WindowDimensions {
  // While subscribed, the resize listener keeps the snapshot current, so a
  // render never reads (and forces layout on) the window.
  return windowListeners.size > 0 && windowSnapshot ? windowSnapshot : readWindow();
}

// The server has no window, and the browser's hydration pass must render what
// the server did: `null` selects the seeded frame below for both.
function getServerWindowSnapshot(): WindowDimensions | null {
  return null;
}

function useWebDimensions(): WindowDimensions {
  const ssrWidth = use(SsrViewportContext);
  const live = useSyncExternalStore<WindowDimensions | null>(
    subscribeToWindow,
    getWindowSnapshot,
    getServerWindowSnapshot
  );
  const seeded = useMemo(
    () => calculateDimensionFlags(ssrWidth ?? DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT),
    [ssrWidth]
  );
  return live ?? seeded;
}

// Native reads come from useWindowDimensions, which subscribes to rotation /
// split-screen / resize and tears the listener down for us — no manual
// Dimensions.addEventListener to leak.
function useNativeDimensions(): WindowDimensions {
  const { width, height } = useWindowDimensions();
  return useMemo(() => calculateDimensionFlags(width, height), [width, height]);
}

/**
* Provides a consistent way to access window dimensions and screen size
* information across mobile and web.
*
* On web the server render and the browser's hydration pass can't read the
* window: server-side there is no DOM, and reading it while hydrating would
* disagree with the markup. Both use the width from `SsrViewportContext` when
* the host provides a per-request value (server render + first client render
* must provide the same one), falling back to `DEFAULT_VIEWPORT_WIDTH` /
* `_HEIGHT`. Right after hydration the real viewport takes over, and resize
* is followed from there. Every consumer shares one window listener and one
* snapshot, re-renders only when the width or height changes, and a component
* that mounts after hydration reads the current viewport straight away.
*
* The platform branch is chosen once, at module load (`Platform.OS` never
* changes at runtime), so each platform calls exactly one set of hooks.
*/
export const useDimensions: () => WindowDimensions =
  Platform.OS === "web" ? useWebDimensions : useNativeDimensions;
