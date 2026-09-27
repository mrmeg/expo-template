---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/131
---

# SSR renders the visitor's color scheme (and dark mode hydrates cleanly)

## Goal
On web the server always renders the light theme: `useThemeStore` boots `userTheme: "system", systemTheme: "light"` and only reads the preference in `syncThemeFromEnvironment()` after the first commit. A returning dark-mode visitor gets light server HTML, a light first client render, then a flip to dark — and on every gallery route in dark mode React 19 logs "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties" (Radix `useId`-based `aria-controls`/`id` on the Explore rail's Tabs preview differ: server `radix-_R_b8q…`, client `radix-_R_2q6…`), which the template surfaces as an error toast in dev. Light mode logs nothing (`/tmp/fleet/ui/expo-ui/w4-before/hydration-dark.json`, `sweep-a.json`). Make the first render agree with the visitor's scheme on both sides, the same way `has-seen-onboarding` already does, and confirm the mismatch goes away.

## Context
- `app/+html.tsx` `COLOR_SCHEME_SCRIPT` resolves the scheme from `localStorage["user-theme-preference"]` + `prefers-color-scheme` before the bundle boots and stamps `html[data-theme]` (the `--c-*` CSS variables key on it). It does not tell the server anything.
- `shared/ssrOnboarding.ts` + `client/features/onboarding/onboardingStore.ts` are the pattern: a cookie written by the client (`document.cookie = "has-seen-onboarding=1; path=/; max-age=…; SameSite=Lax"`), parsed by `parseOnboardingSeenCookie`, read on the server from `requestHeaders()` (Expo Server request scope) and on the client from `document.cookie`, consumed by `useHasSeenOnboarding()` for the first render until the store has loaded. Tests: `shared/__tests__/ssrOnboarding.test.ts`.
- `client/features/app/RootLayout.tsx` wraps the app in `<UIProvider keyboardAvoiding={false} haptics="all">` and calls `syncThemeFromEnvironment()` in an effect; it already seeds SSR viewport metrics with lazy `useState` initializers ("a module-scope constant would leak one request's width into another's").
- Kit: `packages/ui/src/hooks/useTheme.ts` computes `effectiveScheme = resolveThemePreference(userTheme, systemTheme)` from the store (line ~123) and `writeDocumentScheme` keeps `html[data-theme]` in sync; `packages/ui/src/state/themeStore.ts` has `hasLoadedTheme` (false until `loadTheme()` ran — never true during SSR); `UIProvider` (`components/UIProvider.tsx`) has props `notification`, `portalHost`, `statusBar`, `keyboardAvoiding`, `haptics`, …; `state/themeColorScope.tsx` shows the context-provider pattern the kit uses for per-tree theme input. Module-level store state is shared across concurrent SSR requests, so the hint must travel through React context, not `setState`.
- The showcase's Tabs preview that mismatches is rendered by `RailCard` in `app/(main)/(tabs)/index.tsx` through `LazyPreview` (`client/showcase/lazyGallery.tsx`, `React.lazy` inside `Suspense`).

## Work
1. **Kit: first-render scheme hint.** Add `UIProvider` prop `initialScheme?: "light" | "dark"` — "the scheme the first render should use before the persisted preference has been read (SSR hint); ignored once `hasLoadedTheme` is true". Implement as a context in `state/` (`InitialSchemeContext`, provided by `UIProvider`); `useTheme()` (and any other reader of the resolved scheme — grep `resolveThemePreference(` in `packages/ui/src`, e.g. `StatusBar`, `writeDocumentScheme` is store-driven and stays) uses the hint while `!hasLoadedTheme && hint !== undefined`, else the store. Native ignores it (store loads at module scope). Additive, default unchanged.
2. **Shared: cookie parsing.** `shared/ssrColorScheme.ts` mirroring `ssrOnboarding.ts`: `COLOR_SCHEME_COOKIE_NAME = "color-scheme"`, values `"light" | "dark"`, `parseColorSchemeCookie(header)`, `detectColorScheme(request)`, `detectColorSchemeFromRequestScope()`. Tests in `shared/__tests__/ssrColorScheme.test.ts` (RED first): absent → `undefined`, `light`/`dark`, garbage → `undefined`, anchored boundary.
3. **Client: write the cookie.** (a) `COLOR_SCHEME_SCRIPT` in `+html.tsx` also writes `document.cookie="color-scheme="+resolved+"; path=/; max-age=31536000; SameSite=Lax"` right after computing `resolved` (a first-time visitor gets a correct hint from the second request on). (b) `client/features/app/colorSchemeCookie.ts`: `startColorSchemeCookieSync()` subscribes to `useThemeStore` and writes the cookie whenever `resolveThemePreference(userTheme, systemTheme)` changes (user toggles, OS flips); RootLayout starts it next to `syncThemeFromEnvironment()`. Web only; unit test with a fake `document.cookie`.
4. **Client: read the hint.** `useSsrColorScheme()` in `client/features/app/` (or next to the onboarding hook): `Platform.OS === "web"` → `document.cookie` on the client, request scope on the server, as a lazy `useState` initializer; RootLayout passes it to `<UIProvider initialScheme={…}>`. No hint (no cookie) → `undefined` → today's behaviour.
5. **Verify the mismatch.** Metro on 8133, `node /tmp/fleet/ui/expo-ui/hydration-sweep.mjs dark` — expect `hydration 0` on every route and no error toast; `sweep.mjs --schemes=light` unchanged. If the mismatch survives with the server rendering dark, spend at most 45 minutes on the rail (`RailCard`/`LazyPreview`: compare the fiber path at hydration time via `fiber-probe.mjs`), then record findings in the PR and stop.
6. **Docs.** `docs/server-guide.md` (SSR signals section: viewport, onboarding, now color scheme), kit README/LLM_USAGE `UIProvider` props, CHANGELOG `### Added` (`initialScheme`), `bun run docs:llms`.

## Validation
- RED tests first: `shared/__tests__/ssrColorScheme.test.ts`, `packages/ui` test that `useTheme()` honours `initialScheme` until `hasLoadedTheme`, `colorSchemeCookie` test, RootLayout/`useSsrColorScheme` test if `client/features/app/__tests__` has a RootLayout test to extend.
- `bun run verify` gates via heavy slot.
- Web: dark first-fetch of `/`, `/settings`, `/components/Button` with cookie `color-scheme=dark` returns HTML whose `<html data-theme>`/inline colors are dark (grep a dark background literal or the theme's `--c-background` value); dark screenshots before/after under `/tmp/fleet/ui/expo-ui/scheme/{before,after}/` (first paint: use `page.goto` with `waitUntil: "commit"` + 50 ms screenshot to show no light flash); hydration sweep clean.

## Out of scope
- Persisting the preference in a cookie on native or changing `THEME_KEY`.
- Client-hint headers (`Sec-CH-Prefers-Color-Scheme`).

## Open questions
None.
