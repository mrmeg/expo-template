# Spec: Fix Web Theme First-Paint Race

**Status:** Blocked
**Priority:** High
**Type:** Bug
**Area:** app, packages/ui
**Blocked By:** Phase 0 spike must validate the per-request SSR-theme bridge end-to-end (`expo-router` server data loader + per-request React context, not middleware-AsyncLocalStorage). Until the spike confirms a working approach, the rest of the spec is unsafe to implement.

---

## What

Eliminate the dark-mode color flash on first paint for web visitors. Make SSR ship correct dark HTML for visitors known to prefer dark, and remove the race conditions in `app/_layout.tsx` and `packages/ui/src/hooks/useTheme.ts` that currently let a stale light scheme reach the DOM after hydration.

## Why

Investigation `Agent/Investigations/20260526-dark-mode-color-issues.md` (finding P0) traced the symptom "dark mode visitors briefly see light content (or 'dark text on dark background') on first paint" to three reinforcing causes:

1. The Zustand theme store at `packages/ui/src/state/themeStore.ts:33-37` always initializes to `userTheme: "system"`, `systemTheme: "light"`, so SSR and the first client render both use the light theme regardless of visitor preference.
2. `packages/ui/src/hooks/useTheme.ts:86-92` runs an effect that writes `document.documentElement.dataset.theme = effectiveScheme` on every mount. On first commit this writes `light` and overrides the `dark` value the inline script in `app/+html.tsx` set before hydration.
3. `app/_layout.tsx:99-101` removes the `theme-loading` shield unconditionally on first commit, and the 500 ms `setTimeout` in `app/+html.tsx:148-152` removes it even sooner if hydration is slow. Either path can expose the still-light SSR tree on a dark body.

The correct fix is to make the server know the visitor's preferred scheme, render the matching React tree, and only let the `theme-loading` shield drop after the store has confirmed the live scheme.

## Current State

- `app/+middleware.ts` is wired with a route `matcher` and `setResponseHeaders` hooks via `expo-server`, but the middleware signature `(request: ImmutableRequest) => Promise<Response | void> | Response | void` has **no `next()` callback**. Middleware cannot wrap the rest of the request pipeline. The `AsyncLocalStorage`-from-middleware approach proposed in earlier drafts of this spec is not viable on `expo-server@56.0.4` (verified at `node_modules/.bun/expo-server@56.0.4/.../types.d.ts:32`).
- `app.config.ts:67-77` already opts into expo-router server data loaders (`unstable_useServerDataLoaders: true`). Per `expo-server` types, `LoaderFunction = (request: ImmutableRequest | undefined, params) => Promise<T> | T`. Loaders receive the request per call, can read cookies, and the result is exposed to the route via `useLoaderData()`. This is the correct seam.
- `app/+html.tsx` calls `useServerDocumentContext()` and emits a blocking inline script that resolves the scheme from `localStorage["user-theme-preference"]` plus `prefers-color-scheme`. That script is the only path that ever ships a "dark" indicator before React paints today.
- `packages/ui/src/state/themeStore.ts` persists the `userTheme` to `localStorage` on web and `AsyncStorage` on native, but does not write a cookie, so the server has no way to read the preference today. The store is a **module-scoped Zustand singleton** — on Node, mutating it during one request would taint subsequent requests in the same process, so SSR must NOT call `setTheme` on the singleton.
- `packages/ui/src/hooks/useTheme.ts:87-92` writes `dataset.theme` and `style.colorScheme` from the store value on every render, including the first client render with the (stale) `light` default.
- `app/_layout.tsx:91-101` runs `syncThemeFromEnvironment()` and the shield-removal `classList.remove("theme-loading")` in two separate `useEffect` hooks. Removal does not depend on the sync completing.
- Expo Router 56.2.2 (`node_modules/.bun/expo-router@56.2.2+.../build/global-state/serverLocationContext.d.ts`) only exposes `pathname`/`search`/`hash` to the SSR tree by default. Loader data is exposed via `useLoaderData()`.
- Repo runs on Expo SDK 56 (`package.json` declares `"expo": "~56.0.5"`). The router-side AGENTS.md still claims SDK 55 — out of date and being corrected separately.

## Implementation Phases

This spec implements in two phases. Phase 0 is a spike that gates everything else; if Phase 0 fails, this spec is rewritten or shelved.

### Phase 0 — Spike (BLOCKER)

Goal: prove that an `expo-server` `LoaderFunction` at the root layout can read a request cookie, surface the resolved scheme to the React tree, and influence what `+html.tsx` emits on the same request — **without** mutating the Zustand singleton.

Steps:

1. Add `loader` to `app/_layout.tsx` (or a fresh `app/+root-loader.ts` if expo-router requires that placement) that reads `request?.headers.get("cookie")` and returns `{ resolvedTheme: "light" | "dark" | null, userPreference: "light" | "dark" | "system" | null }`.
2. Inside the route component, read `useLoaderData()` and pass the result through a new React context `ResolvedThemeContext` (defined in `packages/ui/src/state/resolvedThemeContext.tsx`).
3. Inside `+html.tsx`, render `<html data-theme={resolvedTheme}>` if `resolvedTheme` is non-null. The implementer must verify whether `+html.tsx` can read `useLoaderData()` itself (it might run in the same render tree); if not, expose the value via a server-side global-per-request mechanism that `+html.tsx` can read at document-render time. If neither path works, **stop and report the blocker**.
4. Verify with `bun run web:dev`:
   - Two parallel browser sessions with different `user-theme-preference` cookies receive correctly themed SSR HTML on first paint.
   - The Zustand `themeStore` still reports `userTheme: "system"`, `systemTheme: "light"` on the server (proves no singleton mutation).
5. Verify with `bunx expo export --platform web`:
   - The static export output (where loaders run at build time, not request time) does not crash. Document the static-export behavior — likely it falls back to the inline-script path because the request is unavailable at build time.

Phase 0 deliverable: a small PR with steps 1-3 wired up plus a `__tests__/web/themeBridge.test.ts` (Playwright or jest with mocked request) that asserts the cross-request isolation.

If Phase 0 fails (no viable bridge from loader to `+html.tsx`, or no way to avoid singleton mutation), STOP. Re-spec with one of the fallback designs in `Out of Scope`.

### Phase 1 — Cookie persistence

Edit `packages/ui/src/state/themeStore.ts`:

- Add a constant `THEME_COOKIE = "user-theme-preference"` (same name as `THEME_KEY`; cookie + localStorage stay in sync by name).
- In `setTheme`, when `Platform.OS === "web"` and `typeof document !== "undefined"`:
  - Continue writing `localStorage.setItem(THEME_KEY, theme)`.
  - Also write `document.cookie = "user-theme-preference={value}; Path=/; Max-Age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "")`.
- In `loadTheme`, fall through `cookie -> localStorage -> default` so a cookie set by another tab still seeds the store.
- Update `syncThemeFromEnvironment` so the cookie is written once on mount when the cookie is missing but localStorage has a value (forward-fill for visitors who upgraded without changing their preference).

Add a `storage` event listener so a theme change in one tab updates the cookie + store in another open tab.

### Phase 2 — Wire SSR-resolved theme into the React tree

Using the bridge that Phase 0 proved out:

- The root loader reads the cookie and the `Sec-CH-Prefers-Color-Scheme` header, returns `{ userPreference, resolvedTheme }`.
- `_layout.tsx` reads `useLoaderData()`, wraps children in `<ResolvedThemeProvider value={{ userPreference, resolvedTheme }}>`.
- `useTheme()` becomes context-aware: when `ResolvedThemeContext` provides a value AND the store has not yet hydrated on the client, the hook returns the context value instead of the store default. After hydration the store is the source of truth.
- The Zustand store remains a singleton and is **not** mutated during SSR. The context provider supplies the per-request override.

### Phase 3 — Stop `useTheme.ts` from clobbering the SSR-set `data-theme`

Edit `packages/ui/src/hooks/useTheme.ts:86-92`:

- Add a `hasHydrated: boolean` flag in `themeStore` (default `false`, set `true` after `syncThemeFromEnvironment()` finishes its first run).
- The DOM-mirroring `useEffect` runs only when `hasHydrated === true`. Until then, the inline script's value (or the SSR-set `data-theme`) is the source of truth.
- Add a unit test in `packages/ui/src/hooks/__tests__/useTheme.test.tsx` that mounts a component with `useThemeStore.setState({ ...., hasHydrated: false })` and asserts `document.documentElement.dataset.theme` is unchanged after mount.

### Phase 4 — Gate the shield removal on store hydration

Edit `app/_layout.tsx:91-101`:

- Combine the two `useEffect` blocks into one. After `syncThemeFromEnvironment()` completes and `hasHydrated` is `true`, remove the `theme-loading` class once.
- Keep the `theme-loading` class addition contingent on `Platform.OS === "web"`.
- Remove the unconditional `classList.remove("theme-loading")` that runs regardless of sync state.

### Phase 5 — Inline-script failsafe stays

Edit `app/+html.tsx:148-152`:

- Keep the `setTimeout(() => classList.remove("theme-loading"), 500)` as a last-resort failsafe for visitors whose JS chunk fails to hydrate at all.
- Update the comment to explain that under normal hydration the React-side hook in `_layout.tsx` removes the shield as soon as the store has hydrated; the timer matters only when hydration never completes.

### Phase 6 — `+html.tsx` ships SSR-known theme

Edit `app/+html.tsx`:

- When the SSR-resolved scheme from Phase 2 is `"dark"` or `"light"`, render `<html data-theme={scheme} {...htmlAttributes}>`. When unknown, leave `data-theme` off and let the existing inline script + media query path handle it.
- Do NOT include `theme-loading` in the rendered class list when the scheme is known — there is nothing to shield because SSR already painted the right theme.
- Keep the `@media (prefers-color-scheme: dark)` fallback rules for the cookie-less first-time visitor case.

### Phase 7 — Cache headers

Edit `app/+middleware.ts`:

- Set `Vary: Cookie, Sec-CH-Prefers-Color-Scheme` (alongside the existing `Vary: Origin`) so caches do not collapse light/dark responses.
- Set `Accept-CH: Sec-CH-Prefers-Color-Scheme` on responses so subsequent navigations include the client hint.
- Extend `unstable_settings.matcher.patterns` to include the SSR routes (`/`, `/(main)`, `/(main)/(demos)/...`, etc.) — or omit `matcher` entirely so the middleware runs on every request. The matcher syntax accepts `[...path]` catch-alls per `expo-server@56.0.4/.../types.d.ts:34-46`.

### Phase 8 — Tests

- Playwright (preferred) or jest test driving a real `bun run start`:
  - Sets `user-theme-preference=dark` cookie, requests `/`, asserts SSR HTML has `<html data-theme="dark">` and `theme-loading` class is absent.
  - Sets `user-theme-preference=light` cookie, asserts `<html data-theme="light">`.
  - With no cookie and `Sec-CH-Prefers-Color-Scheme: dark`, asserts `<html data-theme="dark">`.
  - With no cookie and no client hint, asserts the inline script + media query path is preserved.
  - Two parallel requests with different cookies receive different HTML (proves no singleton leak).
- Unit test for the new `themeStore` `loadTheme` cookie-then-localStorage-then-default flow.
- Unit test in `useTheme.test.tsx` proving the DOM-mirror effect is no-op when `hasHydrated === false`.

## Acceptance Criteria

1. **Phase 0 spike** is documented in the PR body or a follow-up `Agent/Investigations/{date}-ssr-theme-bridge-spike.md`, including which bridge mechanism worked.
2. A web visitor with a `user-theme-preference=dark` cookie receives SSR HTML with `<html data-theme="dark">` and the body CSS resolves to `#09090B` on the very first byte; no `theme-loading` class is rendered for that case.
3. A web visitor with no cookie but `Sec-CH-Prefers-Color-Scheme: dark` receives SSR HTML with `<html data-theme="dark">`.
4. The `useTheme` DOM-mirror effect does not write `dataset.theme` until `hasHydrated === true`, verified by the new unit test.
5. The `theme-loading` shield is removed only after `syncThemeFromEnvironment()` has resolved, except for the 500 ms inline-script failsafe.
6. A regression test (Playwright or jest) covers the cookie-driven SSR cases above and runs in CI. Two-parallel-request isolation is asserted.
7. The `Vary` response header includes both `Cookie` and `Sec-CH-Prefers-Color-Scheme`.
8. The Zustand `themeStore` remains a singleton and is **not** mutated on the server. SSR reads from `ResolvedThemeContext`, not from the store.
9. Native rendering is unaffected. `Platform.OS !== "web"` paths in `themeStore.ts` retain `loadTheme()` + `startSystemThemeListener()` running at module evaluation time.
10. Manual web verification (recorded in `Agent/Testing/{task-slug}.md`, `status: pending`):
    - With OS dark mode, a fresh `localStorage`/cookie-cleared session loads `/(main)/(tabs)` and shows no white flash, no light cards on dark body, no `data-theme` flicker (Performance panel screenshot or video).
    - Toggling theme writes the cookie; reloading the page produces the matching SSR HTML on first byte.

## Constraints

- Do not regress native (iOS/Android). All new persistence and SSR logic must be web-only and must not run inside React Native bundles.
- Do not store the preference as a third-party cookie. `Path=/`, `SameSite=Lax`, `Max-Age=31536000`. Mark `Secure` when served over HTTPS.
- Do not break the existing `localStorage` contract — `localStorage["user-theme-preference"]` must still be the source the inline script reads.
- **Do not mutate the Zustand `themeStore` during SSR.** SSR must surface the per-request scheme through React Context, not through `set()` calls. Any code path that calls `setTheme` from the server is a regression.
- The `Vary` header must list `Cookie` even before client hints land, so a CDN cannot serve a cached light response to a dark cookie holder.
- The 500 ms failsafe stays. Do not delete it.
- If Phase 0 spike fails, do not push partial work. Stop and re-spec with one of the fallback designs.

## Out of Scope

- Adding a setting for "always follow OS" vs "manual override" beyond what `userTheme: "system" | "light" | "dark"` already covers.
- Switching to CSS variables for theming. Worth considering separately but a much larger refactor.
- Native splash dark variant — covered by `add-dark-splash-and-themed-app-icon.md`.
- Per-component contrast bugs — covered by `fix-dark-mode-icon-on-primary-bg.md`.
- Doc updates for the theming contract — covered by `document-theming-contracts-in-expo-ui-package-doc.md`.

### Fallback designs (used only if Phase 0 fails)

- **Fallback A — Block render on web until store syncs.** Mirror the native render-gate at `app/_layout.tsx:113-116`: do not render the route tree on web until `hasHydrated === true`. Eliminates the flash but ships a brief blank dark page until JS hydrates. Less elegant than SSR-known-theme but achievable without server bridges.
- **Fallback B — Static-time theme detection only.** For static export, accept that SSR is always light and that the inline script + shield is the only mitigation. Keep Phases 3-7 (gate the shield, fix the DOM clobber) and ship without server-rendered dark HTML.

## Files Likely Affected

Server / build:

- `app/+middleware.ts`
- `app/+html.tsx`
- `app/_layout.tsx` (loader export, ResolvedThemeProvider wrap)
- `packages/ui/src/state/themeStore.ts`
- `packages/ui/src/state/index.ts`
- `packages/ui/src/state/resolvedThemeContext.tsx` (new)

Client:

- `packages/ui/src/hooks/useTheme.ts`

Tests:

- `packages/ui/src/hooks/__tests__/useTheme.test.tsx`
- `packages/ui/src/state/__tests__/themeStore.test.ts`
- a new web SSR test under `__tests__/web/` or `test/web/` (location to be picked by the implementer based on existing harness)

Spike artifact:

- `Agent/Investigations/{date}-ssr-theme-bridge-spike.md` if the spike's findings are durable evidence for future work.

## Edge Cases

- Cookie present but malformed (`user-theme-preference=garbage`): treat as missing; fall through to client hint then media query.
- Cookie says `system`: SSR should leave `data-theme` off the `<html>` element and let the media query rule handle the body bg, matching today's behavior. The inline script still runs and refines on the client.
- Visitor with `prefers-color-scheme: dark` but cookie `light`: cookie wins. SSR ships light HTML.
- A user toggles theme in a tab that is also open elsewhere. Both `localStorage` and the cookie are shared. Add a `storage` event listener so the second tab re-reads. Reloading the second tab produces the new SSR scheme.
- Visitor with JS disabled and a `dark` cookie: SSR HTML already has `data-theme="dark"`, so body is dark and no inline-script run is needed. The React tree uses light theme tokens because no JS runs to apply context — but that is no worse than today, and the cookie path at least makes body bg correct.
- Static export build (`bunx expo export --platform web`): loaders run at build time, the request is `undefined`. SSR falls back to "no resolved theme" and ships HTML without `data-theme`. The inline script handles it on the client. Document this behavior in the spike.
- A reverse proxy strips `Sec-CH-Prefers-Color-Scheme`: the cookie path still works; the client-hint path silently downgrades to media-query fallback.
- Server is restarted mid-request: per-request React context is local to the render; no state to recover.
- A loader throws: route render falls through to the error boundary. Theme bridge defaults to "no resolved theme". Verify the error path during the spike.

## Risks

- **Phase 0 spike failure.** Most likely failure mode: `+html.tsx` renders separately from the route tree and cannot read `useLoaderData()`. Mitigate by reading the loader value in `_layout.tsx` and stashing it on a server-side request-scoped global that `+html.tsx` reads. If even that fails, fall back to design A or B.
- **Hydration mismatches.** If SSR ships dark HTML but the client store seeding misses (e.g., cookie expired between SSR and CSR), React 19 will error on hydration. Mitigate by deriving the client-side initial state from the same cookie source as SSR — read the cookie synchronously in the client-side store initializer too.
- **Singleton leak.** Easy regression: someone calls `setTheme()` from the server. Add a runtime guard in `setTheme` that throws when `Platform.OS === "web"` and `typeof window === "undefined"`.
- **CDN caches.** A misconfigured CDN that ignores `Vary: Cookie` will serve the wrong scheme to the wrong visitors. Spec the change but verify the deploy target's CDN config before rolling out. Add a manual verification step.
- **Cookie consent banners.** This is a strictly necessary user-preference cookie. The docs spec calls this out; a consumer app's consent banner must not block it.
- **Static-export discrepancy.** Static export visitors fall back to today's behavior. The spec must not claim "no flash" for the static-export case.