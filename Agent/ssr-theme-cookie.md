---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Seed SSR with the persisted theme via cookie (kill the light→dark flash)

## Goal
A dark-mode user's first web paint is currently a fully light-themed React tree that re-renders dark after mount. Persist the theme preference in a cookie the server can read and seed the SSR render with it, so server HTML and first client render agree on the user's actual theme.

## Context
Verified 2026-08-06:

- The theme preference is persisted **only** client-side: `localStorage` key `user-theme-preference` on web (`packages/ui/src/state/themeStore.ts:172-178`, `THEME_KEY` at line 8), AsyncStorage on native. The server has no way to read it.
- The store deliberately boots light for SSR: `userTheme: "system"`, `systemTheme: "light"` (`themeStore.ts:116-119`), and web skips auto-init (`themeStore.ts:241-245`); real values arrive post-mount via `syncThemeFromEnvironment()` called from `client/features/app/RootLayout.tsx:100-102`.
- Byte-level proof: production SSR HTML for `/showcase` carries light-theme inline colors (94× `rgba(255,255,255,1.00)` backgrounds, 304× light foreground, 388× light border).
- The blocking `COLOR_SCHEME_SCRIPT` in `app/+html.tsx:114-115` only sets `<body>` background/`color-scheme` and a `theme-loading` class that hides `#root` for up to 500ms — it cannot recolor the React tree. Visible sequence for dark users: dark-blank → light tree → dark tree. User confirmed seeing light onboarding content while in dark mode on the dev server.
- The repo already has the exact pattern to mirror: `server/lib/ssrOnboarding.ts` parses a `has-seen-onboarding` cookie (spec `ssr-onboarding-cookie-gate`, done, PR #31).
- `docs/ssr-hydration.md` §5 already records the first-visit `prefers-color-scheme` gap as an open follow-up.

## Work
1. `packages/ui/src/state/themeStore.ts`: on web, write the preference to a cookie (e.g. `user-theme-preference`, path=/, long max-age, SameSite=Lax) wherever `localStorage` is written (`setTheme`), and backfill the cookie from `localStorage` during `syncThemeFromEnvironment`/`loadTheme` so existing users are migrated on their next visit. Add a way to seed the store's initial `userTheme`/`systemTheme` for SSR.
2. **Per-request safety constraint:** the zustand store is a module singleton shared across concurrent SSR requests. The seeding mechanism must not leak one request's theme into another — prefer a React-context path read by `useTheme()` during SSR (the `ThemeColorScope` pattern shows how context can layer over the store), or prove the render path is serial before mutating the singleton per request.
3. New `server/lib/ssrTheme.ts` mirroring `ssrOnboarding.ts`: parse the cookie (anchored, reject invalid values, return `"system" | "light" | "dark" | null`). Resolve `system`/absent to a scheme — a `Sec-CH-Prefers-Color-Scheme` client hint if present, else light (send `Accept-CH: Sec-CH-Prefers-Color-Scheme` so subsequent first-visit requests can resolve; optional, note in PR if skipped).
4. Wire the seeded theme into the render so `useTheme()`/`useStyles()` consumers and the `ThemeProvider` value in `RootLayout.tsx` render the correct scheme server-side. Keep `syncThemeFromEnvironment()` as the client source of truth after mount.
5. Keep the `+html.tsx` `theme-loading` shield as the first-visit-only failsafe; do not extend its 500ms window.
6. `packages/ui` version bump (minor — store API addition) per the release flow; CHANGELOG entry.
7. Tests: cookie write in `themeStore` tests; `ssrTheme` parser unit tests (mirror `server/lib/__tests__` onboarding tests incl. the anchoring case); extend the existing SSR render test to assert dark-theme colors appear in HTML when the cookie says dark, light when absent.

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Manual, against a **production-mode** server (dev SSR ships no app content, so it can't demonstrate this): request `/` and `/showcase` with `Cookie: user-theme-preference=dark` and confirm the HTML carries dark background colors (`rgba(9,9,11,…)` class of values) instead of light; without the cookie, unchanged light output.
- Browser: set dark in the app, reload — no light flash frame; React error #418 must not regress (it is addressed separately by `ssr-viewport-wiring`).

## Out of scope
- The viewport/width-0 layout jump (`ssr-viewport-wiring.md`).
- The flush cascade-order defect (`ssr-flush-cascade-order.md`).
- Native behavior (unchanged).

## Open questions
- None blocking; the per-request seeding mechanism is the implementer's choice within the constraint in Work #2.
