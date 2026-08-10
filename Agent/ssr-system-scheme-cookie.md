---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Persist the resolved system scheme so `system` users get a dark SSR tree

## Goal
A visitor whose preference is `system` (the default — most users never pick explicitly) still gets a fully light SSR tree on browsers that don't send `Sec-CH-Prefers-Color-Scheme` — that is Safari and Firefox on **every** load, and Chromium on the first navigation. Persist the client-resolved system scheme in a second cookie so the server can treat `system` + last-known-scheme as a real signal and render a dark tree on byte 1.

## Context
Verified 2026-08-10:

- `user-theme-preference` cookie stores only the *preference* (`packages/ui/src/state/themeStore.ts:29-33`, written in `setTheme` and backfilled in `loadTheme`, including the implicit `system` at line 230).
- `server/lib/ssrTheme.ts:206` (`resolveSsrThemeDetection`): a `system` cookie without a client hint yields `hasSignal: true` but `scheme: null` → the server renders the light-default tree and `app/+html.tsx:221` skips the `data-theme` stamp. The doc comments state this is deliberate given only the current two signals.
- The hint is the only path to resolving `system` server-side, and it is Chromium-only; even there `Accept-CH` (emitted as `<meta http-equiv>` at `app/+html.tsx:247`) takes effect from the second request onward.
- The blocking `COLOR_SCHEME_SCRIPT` (`app/+html.tsx:138`) bails out entirely when `data-theme` is already stamped — today a stamp is never stale (it only comes from an explicit cookie or a same-request hint), but a scheme stamped from a *persisted* system resolution can be stale when the OS theme changed between visits, so the bail-out needs a staleness check.
- Client first-render seed (`client/components/SsrThemeProvider.tsx:48-51`) reads `userTheme` from `document.cookie` and `systemTheme` from the `data-ssr-system-scheme` attribute the server stamped — that channel already carries whatever `systemTheme` the server resolves, so it needs no structural change.
- All system-scheme updates on web funnel through `setSystemTheme` (`themeStore.ts:202`), called on every session via `syncThemeFromEnvironment` → `startSystemThemeListener` → `syncSystemTheme` and by the live `matchMedia` listener.
- Prior art: spec `ssr-theme-cookie.md` (done, PR #42) built the cookie/seed pipeline this extends. `docs/ssr-hydration.md` §5 documents the current signal model.

## Work
1. `packages/ui/src/state/themeStore.ts`: add a `system-color-scheme` cookie (`light`/`dark` only; path=/, max-age 1 year, SameSite=Lax — mirror `writeThemeCookie`). Write it inside `setSystemTheme` guarded web-only + `typeof document !== "undefined"` (it also runs from native listeners and could be reached during SSR). Export the cookie name constant. This single write point covers session start, live OS changes, and the `setTheme("system")` path (which re-derives via `getSystemTheme` and funnels through the store).
2. `server/lib/ssrTheme.ts`: parse the new cookie from the same `Cookie` header (anchored pattern, reject anything but `light`/`dark`). In `resolveSsrThemeDetection`, `systemTheme` precedence: client hint (same-request, freshest) > `system-color-scheme` cookie > light default. `hasSignal` includes the new cookie; `scheme` is now known when `userTheme !== "system"` OR a hint OR a resolved-scheme cookie is present. Export the cookie name for the store/tests. Update the module header comment — the "system with no hint stays a guess" contract changes.
3. `app/+html.tsx` `COLOR_SCHEME_SCRIPT`: replace the unconditional `if(root.dataset.theme){return}` bail-out with a staleness check — when `data-theme` is stamped AND `localStorage["user-theme-preference"]` is `system`/absent AND `matchMedia("(prefers-color-scheme:dark)")` disagrees, restamp `data-theme` + `style.colorScheme` (and apply the same `theme-loading` hide when flipping to dark). Do NOT touch `data-ssr-system-scheme` — the client hydration seed must keep matching the server-rendered HTML (the React tree recolors post-mount via `syncThemeFromEnvironment`, as it does today); this script only fixes the pre-paint CSS. Explicit-cookie and hint-derived stamps must behave exactly as before (the localStorage check is what scopes the restamp to system-derived stamps).
4. Update the now-inaccurate comments: `+html.tsx` block above `COLOR_SCHEME_SCRIPT` (the "first-visit-only failsafe" contract widens to "first-visit or stale-scheme"), and `docs/ssr-hydration.md` §5.
5. `packages/ui` version bump (minor — new cookie write is additive) + CHANGELOG, per the release flow.
6. Tests:
   - `themeStore` tests: `setSystemTheme` writes the cookie on web, not on native, valid values only.
   - `server/lib/__tests__` ssrTheme tests: `system` cookie + `system-color-scheme=dark` → `scheme: "dark"`; hint beats a disagreeing cookie; invalid/unanchored values rejected; resolved cookie alone (no preference cookie) still yields a signal.
   - `SsrThemeProvider` test: client seed agrees with a server render that resolved from the new cookie (attribute round-trip).
   - Extend the existing production-SSR render assertion: `Cookie: user-theme-preference=system; system-color-scheme=dark` → dark inline colors in HTML.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Production server (dev SSR ships no app content): `bun run build && bun run start-local`, then:
  - `curl -H 'Cookie: user-theme-preference=system; system-color-scheme=dark' localhost:<port>/` → dark backgrounds (`rgba(9,9,11,…)` class) and `data-theme="dark"` on `<html>`; without the new cookie → unchanged light output with no `data-theme`.
  - Browser with client hints unavailable (Safari, or Chromium with the hint header stripped): OS dark, preference `system`, visit once, reload → view-source shows a dark tree on byte 1, no light flash.
  - Stale-cookie case: send `system-color-scheme=light` with OS dark in the browser → body paints dark pre-hydration (script restamp), tree recolors after mount, no hydration error (React #418) in the console.

## Out of scope
- `Critical-CH` first-visit retry (interacts with the Chromium cookie-drop seen in blank-screen debugging; separate spec if wanted).
- CSS-variable theming refactor (the only true fix for the literal first-ever visit on Safari/Firefox).
- Widening the 500ms `theme-loading` window.
- Native behavior (cookie write is web-only).

## Open questions
- None blocking. Cookie name `system-color-scheme` is a suggestion; keep it distinct from `user-theme-preference` so the preference cookie's semantics don't change for existing visitors.
