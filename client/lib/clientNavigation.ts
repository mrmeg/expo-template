/**
 * "Did the visitor arrive on this route, or navigate to it?" — the discriminator
 * a screen may safely use to render LESS than the server did.
 *
 * Web SSR renders the full tree, so the client's first render of that HTML must
 * produce the same tree or React throws #418 and re-renders the subtree from
 * scratch. But a screen reached by a client-side navigation has no server HTML
 * to match, so it is free to defer expensive work (the showcase galleries stream
 * their live previews in — see `client/showcase/useProgressivePreviewCount.ts`).
 * Telling those two cases apart is this module's only job.
 *
 * The discriminator is ROUTE IDENTITY: the pathname the app was entered on
 * versus the pathname a screen is rendering for.
 *
 * ## Why not "has React committed once?" — the bug this replaced
 *
 * The first version of this module flipped a flag in a `RootLayout` mount effect
 * and assumed "effects run after the hydration commit", so a leaf screen's render
 * would still see `false` while hydrating. **That does not hold for leaf screens.**
 * React hydrates selectively: the root layout can commit — running its effects —
 * before a leaf route's own hydration pass renders. Measured on the production
 * build, direct loads of `/components` and `/blocks` flashed skeletons ~364–462ms
 * after load and threw React #418 in 3 of 3 trials, because the gallery's
 * `useState` initializer ran AFTER the root's effect had already fired. Commit
 * ordering between a layout and its leaves is not a contract. Route identity is,
 * and it needs no effect to have run.
 *
 * ## Why module scope, and why the server must never trust it
 *
 * A browser gets a fresh module scope per full page load, which is exactly the
 * lifetime "this app load" means. A server process does NOT: it is long-lived and
 * serves many requests, so `initialPathname` there would be polluted by whichever
 * request arrived first. Hence `isClientNavigatedScreen()` returns `false` outright
 * when there is no `window` — the server render is always full, unconditionally.
 *
 * See docs/ssr-hydration.md §9 for the full contract.
 */

/** The pathname this app load started on. First write wins. */
let initialPathname: string | null = null;

/** Latched once the app has navigated away from `initialPathname`. */
let hasNavigated = false;

/**
 * Records the pathname the app is currently on.
 *
 * Called from `client/features/app/RootLayout.tsx` in two places, deliberately:
 *
 *  - During RENDER, to seed `initialPathname`. The write is idempotent and
 *    first-wins, so running it on every render is safe — and running it in a
 *    render body is what guarantees the entry pathname is recorded before ANY
 *    leaf renders, including a late selective-hydration pass. That is precisely
 *    the case the old effect-based flag got wrong.
 *  - From an effect keyed on the pathname, to latch `hasNavigated` once the app
 *    moves. An effect is fine for that half: by the time it matters, the screen
 *    that was navigated to has already rendered with a differing pathname.
 */
export function recordPathname(pathname: string | undefined | null): void {
  if (typeof pathname !== "string" || pathname === "") return;

  if (initialPathname === null) {
    initialPathname = pathname;
    return;
  }
  if (pathname !== initialPathname) {
    hasNavigated = true;
  }
}

/**
 * `true` when `pathname` belongs to a screen the visitor navigated to rather than
 * arrived on — i.e. a screen with no server HTML to match.
 *
 * Read it in a `useState` initializer, never in a bare render expression: the
 * answer must be fixed for the life of the mount, or a screen would change its own
 * output mid-life (during hydration, that is the mismatch this exists to avoid).
 *
 * The `hasNavigated` half is what keeps a RETURN to the entry route deferred: the
 * pathname matches `initialPathname` again by then, but that HTML is long gone.
 */
export function isClientNavigatedScreen(pathname: string | undefined | null): boolean {
  // Server render: module scope is shared across requests, so nothing here can be
  // trusted. Always render everything — the SSR HTML must be complete.
  if (typeof window === "undefined") return false;

  if (hasNavigated) return true;
  if (initialPathname === null) return false;
  if (typeof pathname !== "string" || pathname === "") return false;
  return pathname !== initialPathname;
}

/**
 * Test-only reset. Module scope survives jest's `clearMocks`/`restoreMocks`, so
 * without this one test's navigation would silently move every later test in the
 * file onto the deferred path. `test/setup.ts` calls it in a global `beforeEach`.
 */
export function resetClientNavigationForTests(): void {
  initialPathname = null;
  hasNavigated = false;
}

/** Test-only view of the module state, for asserting the seeding contract. */
export function __getClientNavigationStateForTests(): {
  initialPathname: string | null;
  hasNavigated: boolean;
} {
  return { initialPathname, hasNavigated };
}
