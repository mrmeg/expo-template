---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Fix icon-font SSR registration (React #418 + missing @font-face)

## Goal

Every cold web load logs React #418 (hydration mismatch) and the served HTML contains zero `@font-face` rules. Both symptoms share one root cause: the Feather icon font is registered at module scope, which on the server runs outside expo-font's per-request context — so SSR renders icons as bare unloaded `<Text/>` (no glyph, no `r-lrvibr` class) while the client's first render sees the font as loaded. Register the font during render on server-web so server and client agree and `@font-face` ships in the HTML.

## Context

Verified root-cause chain (line refs on current dev):

- Icons render via `packages/ui/src/components/Icon.tsx:110-118` → `@expo/vector-icons/Feather`. `createIconSet.js:56` seeds state with `Font.isLoaded(fontName)` and renders a bare `<Text/>` when false (lines 78-79); when true it renders `<Text selectable={false}>` → react-native-web emits the `r-lrvibr` (`user-select:none`) atomic class. **`StyledText.tsx` is NOT involved** — earlier attribution of the mismatch to `StyledText.tsx:167/220` was wrong; its `userSelect` logic is isomorphic. Do not modify StyledText.
- expo-font's server store is an `AsyncLocalStorage` entered per request by `Font.withServerContext()` (`@expo/router-server/build/server/renderStreamingContent.js:107`). The app's only SSR registration is **module-scope** `void Font.loadAsync(Feather.font)` at `packages/ui/src/hooks/useResources.ts:22` — module scope evaluates outside every request's store, `addServerFont` throws, and the `void` swallows it. Every request then sees `Font.isLoaded('Feather') === false`, and `FontResources` (`renderStreamingContent.js:95-101`) emits zero `@font-face` descriptors. Metro `inlineRequires` shifts when module scope runs (the same hazard `docs/ssr-hydration.md` §3 documents for i18n, and why §2 believed the module-scope call worked — a cold module cache inside a request can succeed once).
- On the client, the same module-scope call synchronously injects the `@font-face` rule pre-hydration and client `isLoaded` checks rule presence → true. Server "not loaded" + client "loaded" = genuine served-HTML divergence (React #418), not a FOUC.
- The `+html.tsx` snapshot filter (lines ~154-161) only drops the `react-native-stylesheet` node and `SsrStyleFlush` only re-emits the RNW sheet — neither masks nor can fix this. Don't disturb either (repo constraint).
- `__tests__/ssrHydration.guardrail.test.ts` doesn't cover font registration (jest mocks expo-font).
- Known doc drift to fix while in there: `docs/ssr-hydration.md:272`'s verification grep looks for `css-text-146c3p1`, but RNW 0.21 emits `css-146c3p1`.
- `packages/ui` is published standalone — the fix must not change native behavior (native's real async `Font.loadAsync` effect at `useResources.ts:102` stays) or break consumers that don't SSR.

## Work

1. In `packages/ui` (likely `useResources.ts`, or a small helper it and RootLayout share): add an idempotent render-time registration — when `Platform.OS === "web"` and `typeof window === "undefined"`, call the synchronous server-font registration for Feather inside the hook/render body so it lands in the current request's store. Mirror the `ensureI18nInitialized()` render-body pattern from `docs/ssr-hydration.md` §3. Keep the existing module-scope client call (it's what makes the client side work) or restructure deliberately — the invariant is: server store populated per request, client rule injected pre-hydration.
2. Confirm on the client that the loaded state at hydration matches the server's rendered state (both "loaded" once step 1 works).
3. Update `docs/ssr-hydration.md`: §1/§2's description of the icon-font gap (the direction is inverted from what it says), and the `:272` grep drift (`css-text-146c3p1` → `css-146c3p1`). Then `bun run docs:llms` (ssr-hydration.md is an llms source) and commit regenerated bundles.
4. If a cheap guardrail is possible without mocking expo-font away (e.g. a source-check that `useResources`/RootLayout contains the render-time registration call, in the style of `ssrHydration.guardrail.test.ts`), add it; otherwise rely on the curl validation and say so in the PR.

## Validation

- `bun run verify` passes.
- Real server HTML: `bun run build && bun run start`, then with the onboarding cookie set (`-H 'Cookie: has-seen-onboarding=1'`):
  - `curl -s localhost:3000/ | grep -c '@font-face'` ≥ 1 (Feather registered; Inter comes from Google Fonts and is separate);
  - the onboarding-path HTML (`curl` without cookie) contains `r-lrvibr` on the icon nodes that previously lacked it.
- Browser, production build: cold load with a fresh profile shows **zero** React #418 in the console (this was previously 1 per cold load — the regression signal is unambiguous). Icons visible immediately, no icon-pop.
- iOS simulator: icons render normally (native path untouched).

## Out of scope

- The theme/other shield scripts, `SsrStyleFlush`, and the `+html.tsx` snapshot filter.
- Inter font loading strategy (Google Fonts stylesheet path is working as designed).
- Any StyledText change.

## Open questions

- None.
