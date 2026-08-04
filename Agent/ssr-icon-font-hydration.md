---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/37
---

# Fix icon-font SSR registration (React #418 + missing @font-face)

## Goal

Cold web loads log React #418 (hydration mismatch) and the served HTML contains zero `@font-face` rules. Root cause: the Feather icon font is registered at **module scope**, and expo-font's server store is per-request `AsyncLocalStorage` — so only the *first* request after a cold start (the one whose render happens to evaluate the module) populates it. Every later request renders icons as bare unloaded `<Text/>` (no glyph, no `r-lrvibr` class) while the client's first render sees the font as loaded. Register the font **during render** on server-web so every request agrees with the client and `@font-face` ships in the HTML.

## Context

Verified root-cause chain (line refs on current dev):

- Icons render via `packages/ui/src/components/Icon.tsx:110-118` → `@expo/vector-icons/Feather`. `createIconSet.js:56` seeds state with `Font.isLoaded(fontName)` and renders a bare `<Text/>` when false (lines 78-79); when true `create-icon-set.js:62` renders `<Text selectable={false}>` → react-native-web emits the `r-lrvibr` (`user-select:none`) atomic class (verified: murmur hash of `userSelect`+`none`; in a **dev** bundle the same class is `r-userSelect-lrvibr`). **`StyledText.tsx` is NOT involved** — earlier attribution of the mismatch to `StyledText.tsx:167/220` was wrong; its `userSelect` logic is isomorphic. Do not modify StyledText.
- **The font family key is lowercase `"feather"`, not `"Feather"`** — `@expo/vector-icons/build/Feather.js:5` is `createIconSet(glyphMap, 'feather', font)`, so `Feather.font === { feather: <assetId> }` and the server check is `Font.isLoaded('feather')`. (The existing jest mock in `useResources.test.tsx` uses the wrong case; it's mock-only and doesn't matter.)
- expo-font's server store is an `AsyncLocalStorage` entered per request by `Font.withServerContext()` (`@expo/router-server/build/server/renderStreamingContent.js:107`). The app's only SSR registration is **module-scope** `void Font.loadAsync(Feather.font)` at `packages/ui/src/hooks/useResources.ts:22`. `FontResources` (`renderStreamingContent.js:95-101`) turns that store into the `<style id="expo-generated-fonts">` node.
- **Corrected mechanism (the draft's "`addServerFont` throws and `void` swallows it" was wrong).** On server-web `Font.loadAsync` is **synchronous** (`expo-font/build/Font.js:56-78` — no `async` keyword; `isServer` → `registerStaticFont` → `loadSingleFontAsync` → `addServerFont`). A sync throw from `addServerFont`/`requireStore()` is **not** caught by `void`, and `FontLoader.web.js:57-58` deliberately lets it propagate — so if module scope truly evaluated outside a request, importing `useResources` would hard-crash SSR, which is not what's observed. What actually happens: Metro `inlineRequires` defers the module's evaluation until it is first required *during a render*, i.e. **inside** request 1's store. So **request 1 registers the font and requests 2+ do not** (warm module cache, no re-entry) — a cold-start-shaped bug exactly like `docs/ssr-hydration.md` §7 describes for the RNW sheet. That is why §2 believed module scope worked, and why a warm server serves zero `@font-face`.
- On the client, the same module-scope call synchronously injects the `@font-face` rule pre-hydration and client `isLoaded` checks rule presence → true. Server "not loaded" + client "loaded" = genuine served-HTML divergence (React #418), not a FOUC.
- **Render-time registration is captured**: `+html.tsx` renders `{children}` before `{bodyNodes}`, and `FontResources` lives in `bodyNodes`, so anything registered while the app subtree renders lands in the emitted descriptors (same ordering `SsrStyleFlush` relies on). Upstream's caveat (`renderStreamingContent.js:96-97`) only excludes fonts registered inside *late-resolving Suspense boundaries*; `useResources` runs in `RootLayout`, well before the shell completes.
- The `+html.tsx` snapshot filter (lines ~155-162) only drops the `react-native-stylesheet` node and `SsrStyleFlush` only re-emits the RNW sheet — neither masks nor can fix this. Don't disturb either (repo constraint).
- `__tests__/ssrHydration.guardrail.test.ts` doesn't cover font registration (jest mocks expo-font).
- **There is no doc drift at `docs/ssr-hydration.md:272`** — the draft's "fix" would have introduced a bug. RNW's `createIdentifier` (`StyleSheet/compiler/index.js:431-433`) emits `css-text-146c3p1` when `NODE_ENV !== "production"` and `css-146c3p1` in a production build (both hashes verified). Line 272 sits under the **dev-server** recipe (`localhost:8081`), so `css-text-146c3p1` is correct there, as is the `app/+html.tsx:149` comment. Clarify both forms instead of replacing one.
- `packages/ui` is published standalone — the fix must not change native behavior (native's real async `Font.loadAsync` effect at `useResources.ts:102` stays) or break consumers that don't SSR.

## Work

1. In `packages/ui/src/hooks/useResources.ts` add an exported, idempotent `ensureIconFontRegistered()` and **call it in the `useResources` render body** (before the `useEffect`), mirroring the `ensureI18nInitialized()` pattern (`client/features/app/RootLayout.tsx:79`, `docs/ssr-hydration.md` §3). Body:

   ```ts
   export function ensureIconFontRegistered(): void {
     if (Platform.OS !== "web" || typeof window !== "undefined") return;
     if (Font.isLoaded("feather")) return;      // per-request store; cheap
     Font.loadAsync(Feather.font);              // sync on server-web; no `void`
   }
   ```

   **Call `Font.loadAsync` — do not import `expo-font/build/server`.** `registerStaticFont` is the deep/private path and is not re-exported from `expo-font`'s public entry (`build/index.js` = `Font` + `FontUtils` + `useFonts`); `Font.loadAsync` already routes to it synchronously when `Platform.OS === "web" && typeof window === "undefined"`. Let the call throw rather than wrapping it in try/catch — a scope misuse must be loud (upstream's own comment at `FontLoader.web.js:57`).
2. Keep the module-scope `void Font.loadAsync(Feather.font)` at `useResources.ts:22` for the client (it injects the `@font-face` rule pre-hydration, which is what makes the client read "loaded"), but make it client-only guarded so it can't be the server's only registration path. Invariant: server store populated **per request**, client rule injected pre-hydration.
3. Update `docs/ssr-hydration.md` §2 — it currently endorses the module-scope call as sufficient for SSR; it is not (cold-start-shaped, per Context). Cross-reference §7, which already describes this exact failure shape for the RNW sheet. While in §2/`:272`, note that RNW's Text reset class is `css-text-146c3p1` in dev and `css-146c3p1` in a production build so the grep works on both. Then `bun run docs:llms` (ssr-hydration.md is an llms source, `scripts/build-llms-full.mjs:43`) and commit the regen — `bun run verify` runs `docs:llms:check`.
4. Add a guardrail to `__tests__/ssrHydration.guardrail.test.ts`: a source check that `packages/ui/src/hooks/useResources.ts` calls the registration in the render body (call index before the first `useEffect(`), reusing the §3 test's existing technique. Cheap, no expo-font mocking.

## Validation

- `bun run verify` passes (includes `docs:llms:check` and the new guardrail).
- Real server HTML: `bun run build && bun run start` (port 3000, `server.bun.ts`). **Check the 2nd and 3rd requests, not just the first** — the pre-fix bug only shows on a warm module cache, so a single cold curl can false-pass:
  - `curl -s localhost:3000/ | grep -c '@font-face'` ≥ 1, run **three times in a row** — all three ≥ 1. Expect exactly one `<style id="expo-generated-fonts">` holding `@font-face{font-family:"feather";src:url(...);font-display:auto}` plus a `<link rel="preload" as="font">` for the same URI (`serverContext.web.js:42-55`). Inter is a separate Google-Fonts `<link>` in `+html.tsx` and contributes no `@font-face` to the HTML.
  - the onboarding-path HTML (`curl` without cookie — `OnboardingFlow.tsx:149` renders a size-80 `<Icon>`) contains `r-lrvibr` on the icon nodes that previously lacked it; with the cookie (`-H 'Cookie: has-seen-onboarding=1'`) the `(main)` tab bar icons likewise.
- Browser, production build: cold load with a fresh profile shows **zero** React #418 in the console. Icons visible immediately, no icon-pop.
- iOS simulator: icons render normally (native path untouched — `serverContext.js` is the no-op stub and `Platform.OS !== "web"` short-circuits step 1).

## Out of scope

- The theme/other shield scripts, `SsrStyleFlush`, and the `+html.tsx` snapshot filter.
- Inter font loading strategy (Google Fonts stylesheet path is working as designed).
- Any StyledText change.

## Open questions

- None.
