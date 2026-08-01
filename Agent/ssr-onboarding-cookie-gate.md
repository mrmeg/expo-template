---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Resolve the onboarding gate server-side via cookie

## Goal

Let the SSR server know whether the visitor has completed onboarding, so returning users get HTML without the onboarding gate instead of a server-rendered gate hidden by a blocking inline script before paint. Removes one shield script and the wasted gate render/DOM for every returning web visitor — and, as a side effect, makes `(main)` routes actually server-render for returning visitors.

## Context

- `client/features/onboarding/onboardingStore.ts` persists `has-seen-onboarding` to AsyncStorage on native and `localStorage` on web (as JSON — `"true"`/`"false"`, read back with `JSON.parse`); the write action is **`setHasSeenOnboarding(seen)`**. Native eagerly hydrates at store creation (module-scope `loadOnboarding()`), web resolves post-hydration.
- `app/+html.tsx`: because the server can't read localStorage, SSR always emits the gate. `ONBOARDING_SEEN_SCRIPT` (lines 126-133) adds the `onboarding-seen` class when the localStorage flag parses truthy; the CSS rule hiding `[data-testid="onboarding-gate"]` under `html.onboarding-seen` is at **lines 117-119** (comment from 111); the `<script>` tag itself is at **line 230** (comment from 226). `RootLayout.tsx:107-117` removes the class once state resolves to `true`.
- `app.config.ts:70-71` already enables `unstable_useServerMiddleware` and `unstable_useServerDataLoaders`. Both custom servers **do** forward cookies — verified: `server.bun.ts` passes `request.headers` through `loaderNormalizedRequest` into `createRequestHandler`, and `server/index.ts` uses the express adapter; `expo-server`'s node scope sets `requestHeaders` from the incoming request.
- **In-repo precedent to copy — read these three files first:** `server/lib/ssrViewport.ts` (`detectSsrViewportWidth(request)` reads a cookie off `request.headers.get("cookie")`; `withSsrViewport(loader)` wraps a loader's return type), `client/components/SsrViewportProvider.tsx` (reads `useLoaderData()` and provides context), and `packages/ui/src/hooks/useDimensions.ts:42-51` (writes the cookie with `document.cookie = \`${NAME}=${v}; path=/; max-age=${ONE_YEAR}; SameSite=Lax\`` and uses a lazy `useState` initializer seeded from context plus a post-mount reconcile effect — exactly the shape step 3 needs). This spec should mirror that structure for `has-seen-onboarding`. Note no route currently uses these helpers, so this work also proves the pattern out.
- **Layouts cannot export loaders.** `@expo/router-server`'s `getServerManifest` emits leaf nodes only, and `exportLoadersAsync` iterates `htmlRoutes` — `dist/server/_expo/routes.json` confirms 31 leaf html routes and zero `loader` fields. So a root-layout loader is not an option; see Work step 2 for the two viable mechanisms.
- **Read `docs/ssr-hydration.md` before editing** (AGENTS.md requirement for SSR work) and verify with real server HTML, not only Jest/tsc. Related repo constraint: the `+html.tsx` snapshot filter and `SsrStyleFlush` must not be disturbed.
- The gate itself is rendered by the root layout's OnboardingGate (`client/features/app/RootLayout.tsx`; `app/_layout.tsx` is a re-export). The only existing test is `client/features/onboarding/__tests__/onboardingStore.test.ts`; `__tests__/ssrHydration.guardrail.test.ts` has no onboarding assertions, so nothing blocks the shield removal.

## Work

1. On web, dual-write the flag: when `setHasSeenOnboarding` runs in `onboardingStore.ts`, also set a `has-seen-onboarding=1` cookie (path=/, SameSite=Lax, max-age ~1 year, no domain), matching the `useDimensions.ts:42-51` formatting. localStorage remains the client source of truth; the cookie exists only for SSR. Setting the flag back to false must clear/expire the cookie (`max-age=0`).
2. Read the cookie server-side. Add a `detectOnboardingSeen(request)` helper next to `server/lib/ssrViewport.ts` (same `request.headers.get("cookie")` parse), then pick a mechanism:
   - **Preferred:** `expo-server`'s `requestHeaders()` read inside the store's web initializer, wrapped in a try/catch — the SSR render bundle has the request scope, but the same module is also in the client bundle where `requestHeaders()` throws, so the guard is mandatory and must fall back to `false`.
   - **Alternative:** a `withOnboardingSeen(loader)` wrapper exported per leaf route plus a context provider mirroring `SsrViewportProvider`. Correct but touches every route — only take this if the guarded read proves unreliable.
   Record which mechanism was used and why in the PR.
3. Keep hydration consistent: the client's first render must match server HTML for the cookie-derived state, then reconcile from localStorage after mount (localStorage wins on mismatch so a stale cookie can't trap a user) — the lazy-initializer + effect shape in `useDimensions.ts`. No hydration mismatch warnings in the browser console.
4. Remove the onboarding shield once server HTML is correct for both cookie states. This is four places: `+html.tsx` const (126-133), CSS rule + comment (111-119), `<script>` + comment (226-230), and the class-removal effect in `RootLayout.tsx:107-117`. Then update `docs/ssr-hydration.md` §6 (lines 142-175), which currently documents the 4-part shield as load-bearing ("If you remove either the script or the CSS rule, the flash returns") — replace it with the cookie mechanism. Leave the theme shield script, CSS, and its `RootLayout` effect (102-105) untouched.
5. Update `client/features/onboarding/__tests__/onboardingStore.test.ts` for the cookie dual-write/clear, and add a unit test for the cookie-parse helper. Server-render coverage comes from the manual validation below.
6. `bun run docs:llms` — `docs/ssr-hydration.md` is in `scripts/build-llms-full.mjs`'s source list, so the regenerated bundles must be committed.

## Validation

- `bun run typecheck && bun run lint && bun run test:ci && bun run docs:llms:check`
- Real server HTML (per AGENTS.md): `bun run build && bun run start` (defaults to port 3000), then
  - `curl -s localhost:3000/ | grep onboarding-gate` → present with no cookie;
  - `curl -s -H 'Cookie: has-seen-onboarding=1' localhost:3000/ | grep onboarding-gate` → absent, and the same request should now return real `(main)` markup.
- Browser: fresh profile shows onboarding, completing it sets the cookie, reload serves gate-free HTML with no flash and no hydration warnings; clearing site data shows the gate again.
- Native (iOS simulator): onboarding flow unchanged — store behavior on native must be untouched.

## Out of scope

- Moving the theme preference to a cookie (same pattern, separate decision — note as follow-up).
- Any change to native persistence or the onboarding UI itself.

## Open questions

- None.
