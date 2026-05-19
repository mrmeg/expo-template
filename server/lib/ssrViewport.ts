// SSR viewport-width detection for route loaders. Pair with
// `<SsrViewportProvider>` (from @/client/components/SsrViewportProvider) to
// seed `useDimensions` with a width the initial responsive render will agree
// with on the client — eliminating the post-hydration layout reflow.
//
// Order of precedence:
//   1. `mrmeg-vw` cookie — precise width written by `useDimensions` after the
//      first client mount on a given device. Best signal, available on every
//      visit after the first.
//   2. User-Agent — coarse mobile / tablet / desktop heuristic. Used on the
//      very first visit from a device, before the cookie is set. ~85%
//      accurate; misses are corrected one frame later by `useDimensions`'s
//      post-mount snap.
//   3. Desktop default — when neither cookie nor UA gives a signal (e.g.
//      crawlers, requests with no User-Agent header).
//
// Recommended usage in a route (one wrapper + one Provider):
//
//   import { withSsrViewport } from "@/server/lib/ssrViewport";
//   import { SsrViewportProvider } from "@/client/components/SsrViewportProvider";
//
//   // Without an existing loader:
//   export const loader = withSsrViewport(() => ({}));
//
//   // OR composed with an existing loader:
//   export const loader = withSsrViewport(async (request, params) => {
//     return { foo: "bar" };
//   });
//
//   export default function Page() {
//     return <SsrViewportProvider>{/* tree */}</SsrViewportProvider>;
//   }
//
// `useDimensions` inside the Provider uses the loader-detected width as its
// initial state, so SSR and the first client render produce identical layouts.

export const SSR_VIEWPORT = {
  MOBILE: 390,
  TABLET: 820,
  DESKTOP: 1280,
} as const;

const COOKIE_NAME = "mrmeg-vw";
const COOKIE_PATTERN = new RegExp(`${COOKIE_NAME}=(\\d+)`);

// UA patterns ordered from most-specific to most-general.
const TABLET_UA_PATTERN = /\b(iPad|Android(?!.*Mobile)|Tablet|Tab)\b/i;
const MOBILE_UA_PATTERN = /\b(Mobi|iPhone|iPod|Android.*Mobile)\b/i;

type HeaderSource = { headers: { get(name: string): string | null } } | undefined;

/**
 * Detect the viewport width for SSR from the incoming request. Cookie wins,
 * User-Agent is the fallback, desktop is the final fallback. Suitable for
 * use directly inside a loader function.
 */
export function detectSsrViewportWidth(request: HeaderSource): number {
  if (!request) return SSR_VIEWPORT.DESKTOP;

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(COOKIE_PATTERN);
  if (cookieMatch) {
    const width = Number.parseInt(cookieMatch[1], 10);
    if (Number.isFinite(width) && width > 0 && width <= 10000) {
      return width;
    }
  }

  const ua = request.headers.get("user-agent") || "";
  if (TABLET_UA_PATTERN.test(ua)) return SSR_VIEWPORT.TABLET;
  if (MOBILE_UA_PATTERN.test(ua)) return SSR_VIEWPORT.MOBILE;

  return SSR_VIEWPORT.DESKTOP;
}

export const SSR_VIEWPORT_COOKIE_NAME = COOKIE_NAME;

// ---------------------------------------------------------------------------
// Loader wrapper — the recommended per-route adoption surface.
// Pair with <SsrViewportProvider> from @/client/components/SsrViewportProvider.
// ---------------------------------------------------------------------------

type LoaderRequest = { url: string; headers: { get(name: string): string | null } } | undefined;
type LoaderParams = Record<string, string | string[]>;
type AnyLoader<T> = (request: LoaderRequest, params: LoaderParams) => Promise<T> | T;

export type WithSsrViewport<T> = T & { ssrViewportWidth: number };

/**
 * Wrap a loader (or pass `() => ({})` when you don't have other loader data)
 * so its return value includes a server-detected `ssrViewportWidth`. Read it
 * with `<SsrViewportProvider>` which calls `useLoaderData` for you.
 *
 * Type inference is preserved: callers see the original loader's return type
 * intersected with `{ ssrViewportWidth: number }`.
 */
export function withSsrViewport<T>(inner: AnyLoader<T>): AnyLoader<WithSsrViewport<T>> {
  return async (request, params) => {
    const data = await inner(request, params);
    return { ...data, ssrViewportWidth: detectSsrViewportWidth(request) };
  };
}
