---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/52
---

# Persist the resolved system scheme so `system` users get a dark SSR tree

## Goal
A visitor whose preference is `system` (the default — most users never pick explicitly) still gets a fully light SSR tree on browsers that don't send `Sec-CH-Prefers-Color-Scheme` — that is Safari and Firefox on **every** load, and Chromium on the first navigation. Persist the client-resolved system scheme in a second cookie so the server can treat `system` + last-known-scheme as a real signal and render a dark tree on byte 1. Takes effect from a visitor's second visit after ship (the first visit writes the cookie).

## Context
Verified 2026-08-10 (line refs are working-tree; uncommitted blank-recovery edits shift `app/+html.tsx` by +1 vs `dev` HEAD — land or rebase accordingly):

- `user-theme-preference` cookie stores only the *preference* (`packages/ui/src/state/themeStore.ts:29-33`, written in `setTheme` and backfilled in `loadTheme`, including the implicit `system` at line 230).
- `server/lib/ssrTheme.ts:206` (`resolveSsrThemeDetection`): a `system` cookie without a client hint yields `hasSignal: true` but `scheme: null` → the server renders the light-default tree and `app/+html.tsx:221` skips the `data-theme` stamp.
- The hint is the only current path to resolving `system` server-side, and it is Chromium-only; even there `Accept-CH` (`app/+html.tsx:247`) takes effect from the second request onward.
- The blocking `COLOR_SCHEME_SCRIPT` (`app/+html.tsx:138`) bails out entirely when `data-theme` is already stamped. Today a stamp is never stale; a scheme stamped from a *persisted* resolution can be, so the bail-out needs a staleness check.
- Client first-render seed (`client/components/SsrThemeProvider.tsx:48-51`) reads `userTheme` from `document.cookie` and `systemTheme` from the `data-ssr-system-scheme` attribute — that channel already carries whatever `systemTheme` the server resolves. Reviewed for hydration safety: all four signal combinations (pref cookie only, scheme cookie only, both, neither; hint disagreeing with cookie) stay byte-identical **because the client seed reads the attribute, never the new cookie**.
- Web system-scheme updates funnel through `setSystemTheme` (`themeStore.ts:202`) via `syncThemeFromEnvironment` → `startSystemThemeListener` → `syncSystemTheme` and the live `matchMedia` listener. Exception: `setTheme("system")` re-derives `systemTheme` with a direct `set()` (`themeStore.ts:181-186`) and does NOT call `setSystemTheme`.
- Prior art: spec `ssr-theme-cookie.md` (done, PR #42). `docs/ssr-hydration.md` §5 (line 210) documents the current signal model, including (~309-313) the `html:not([data-theme])` failsafe invariant this spec deliberately changes.

## Work
1. `packages/ui/src/state/themeStore.ts`: add a `system-color-scheme` cookie (`light`/`dark` only; path=/, max-age 1 year, SameSite=Lax — mirror `writeThemeCookie`). Write it inside `setSystemTheme`, guarded web-only + `typeof document !== "undefined"` (it is reached from native listeners and could run during SSR). Also write it from `setTheme`'s `theme === "system"` branch, which bypasses `setSystemTheme` (see Context). Export the cookie name constant.
2. `server/lib/ssrTheme.ts`: parse the new cookie from the same `Cookie` header (anchored pattern, reject anything but `light`/`dark`). In `resolveSsrThemeDetection`, `systemTheme` precedence: client hint (same-request, freshest) > `system-color-scheme` cookie > light default. `hasSignal` includes the new cookie; `scheme` is known when `userTheme !== "system"` OR a hint OR a resolved-scheme cookie is present. Export the cookie name for `+html.tsx` and tests — `packages/ui` cannot import `server/`, so mirror the `user-theme-preference` pattern: independent literals in `themeStore.ts:8` and `ssrTheme.ts:50` with equality pinned by a test (`server/lib/__tests__/ssrTheme.test.ts:51-56` is the model).
3. `app/+html.tsx` `COLOR_SCHEME_SCRIPT`: replace the unconditional `if(root.dataset.theme){return}` bail-out with a staleness check driven by **cookies** (the bytes the server used — not localStorage, which can be evicted while an explicit preference cookie survives): when `data-theme` is stamped AND the `user-theme-preference` cookie is `system`-or-absent AND a `system-color-scheme` cookie is present AND disagrees with `matchMedia`:
   - Restamp **light→dark only** (stamp says light, OS says dark): set `data-theme`/`colorScheme` to dark and apply the `theme-loading` hide, same as the no-stamp dark path. A stale-dark stamp stays dark — a consistent dark page that recolors post-mount beats a light body under a dark tree.
   - Do NOT touch `data-ssr-system-scheme` — the client hydration seed must keep matching the server-rendered HTML; the React tree recolors post-mount via `syncThemeFromEnvironment`. `SsrThemeProvider` must NOT read the new cookie (a fresher same-request hint may have won on the server; reading the cookie client-side reintroduces the mismatch).
   - Interpolate the cookie name from the constant instead of hardcoding a third literal.
   - Explicit-cookie and hint-derived stamps behave exactly as before (an explicit pref cookie fails the `system`-or-absent check; hint-derived stamps for hint-carrying browsers are same-request fresh — accept the theoretical stale window).
   - Accepted trade, state it in docs: once a persisted value stamps `data-theme`, the `html:not([data-theme])` CSS media-query failsafe is dead for that request; the script restamp replaces it.
   - Update the guardrail assertions that pin the old bail-out — `__tests__/ssrHydration.guardrail.test.ts:121` and `__tests__/ssrThemeStamp.test.tsx:164` both `expect(script).toContain("if(root.dataset.theme){return;}")`. Update to the new form; do not delete the guardrails.
4. Side effect to cover: with the new cookie a `system` visitor takes the `ssrScheme` branch in `+html.tsx`, so the single unqualified `<meta name="theme-color">` renders instead of the media-gated pair. `__tests__/ssrThemeStamp.test.tsx:213-218` encodes the old reasoning — add a cookie-present counterpart.
5. Update now-inaccurate comments/docs: `+html.tsx` blocks at 121-144 and 334-339 (the "first-visit-only failsafe" widens to "first-visit or stale-scheme"); `ssrTheme.ts` header 26-39, `SsrThemeDetection.scheme` doc 149-158, `resolveSsrThemeDetection` docstring 169-185; `SsrThemeProvider.tsx:21-26` (`systemTheme` no longer comes only from the hint); `docs/ssr-hydration.md` §5 including the failsafe invariant.
6. `packages/ui` version bump (minor — additive cookie write) + CHANGELOG, per the release flow.
7. Tests:
   - `themeStore` tests: `setSystemTheme` and `setTheme("system")` write the cookie on web, not native, valid values only.
   - `server/lib/__tests__/ssrTheme.test.ts`: `system` pref + `system-color-scheme=dark` → `scheme: "dark"`; hint beats a disagreeing cookie; invalid/unanchored values rejected; scheme cookie alone (no pref cookie) still yields a signal; cookie-name equality pin.
   - `SsrThemeProvider` test: client seed agrees with a server render that resolved from the new cookie (attribute round-trip).
   - `__tests__/ssrThemeStamp.test.tsx`: new case `Cookie: user-theme-preference=system; system-color-scheme=dark` → `data-theme="dark"` + `data-ssr-system-scheme="dark"` (no test currently asserts served inline colors — that stays a manual curl check below).

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- `bun run docs:llms` after the `docs/ssr-hydration.md` edit — it feeds `llms-full.txt` and `docs:llms:check` gates commits.
- Production server (dev SSR ships no app content): `bun run build && bun run start-local`, then:
  - `curl -H 'Cookie: user-theme-preference=system; system-color-scheme=dark' localhost:<port>/` → dark backgrounds (`rgba(9,9,11,…)` class) and `data-theme="dark"`; without the new cookie → unchanged light output, no `data-theme`.
  - Browser without client hints (Safari, or Chromium with the header stripped): OS dark, preference `system`, visit once, reload → dark tree on byte 1 in view-source, no light flash.
  - Stale-cookie case: `system-color-scheme=light` with OS dark → body paints dark pre-hydration (script restamp), tree recolors after mount, no React #418 in console.

## Out of scope
- `Critical-CH` first-visit retry (interacts with the Chromium cookie-drop seen in blank-screen debugging; separate spec if wanted).
- CSS-variable theming refactor (the only true fix for the literal first-ever visit on Safari/Firefox).
- Widening the 500ms `theme-loading` window.
- Native behavior (cookie writes are web-only).

## Open questions
- None.
