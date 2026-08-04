---
status: draft
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Diagnose and fix blank SSR on (main) routes (Radix Tabs)

## Goal

Some `(main)` routes server-render an empty body (observed on `/screen-faq` during the Legend List work). Now that returning visitors get real `(main)` SSR (cookie gate, PR #31), a blank server render is user-visible. Capture the actual server-side error, fix its root cause, and add guardrails so a Radix version split can't silently blank SSR again.

## Context

Verified facts (current dev):

- Render chain: `app/(main)/_layout.tsx` → `client/features/navigation/MainLayout.tsx` (Stack, `initialRouteName: "(tabs)"`) → `app/(main)/(tabs)/_layout.tsx` renders `NativeTabs` from `expo-router/unstable-native-tabs`, which on web is `expo-router/build/native-tabs/NativeTabsView.web.js` requiring **`@radix-ui/react-tabs`** (uses `@radix-ui/react-direction`'s `useDirection`, plus roving-focus → collection → nested slot). Because of `initialRouteName`, the Radix Tabs tree renders during SSR of **every** `(main)` route, including all `(demos)/*`.
- **The earlier "duplicate react-direction" theory is wrong on disk**: `@radix-ui/react-direction@1.1.1` and `@radix-ui/react-tabs@1.1.13` each exist exactly once (bun.lock:678, 716). The real version split is **`@radix-ui/react-slot`: hoisted 1.2.4 (expo-router's `^1.2.0`) + 1.2.3 nested under eight Radix packages** (`react-primitive`, `react-collection`, `react-menu`, `react-select`, `react-dialog`, `react-alert-dialog`, `react-popover`, `react-tooltip` — bun.lock:2880-2898).
- Blank-body mechanism: `@expo/router-server/build/server/renderStreamingContent.js:133-138` — the streaming renderer's `onError` only `console.error("SSR streaming render error:", ...)`, so a render-time throw produces a blank/truncated 200, not a 500.
- **The precise throw is unconfirmed** — the observing session had a corrupted half-install, so reproduce before fixing (step 1). Do not assume the slot split is the cause until the stack says so.
- Existing singleton machinery: `metro.config.js:59-72` `dedupePackages` (react, react-dom, react-native, react-query, reanimated, gesture-handler, safe-area-context, pretty-format) with the resolveRequest rewrite at :79-94; `package.json` `overrides` currently only pins `baseline-browser-mapping`. Note: project memory claimed a `@radix-ui/react-slot` override existed here — git history shows it never did; there is prior RADIX guidance about deduping react-slot for the web AlertDialog `React.Children.only` crash, which this spec's fix would also address.
- `packages/ui/src/components/Tabs.tsx` uses `@rn-primitives/tabs@1.5.2`, a second consumer of `@radix-ui/react-tabs` — a fix must keep the showcase Tabs demo working.
- Docs: real-server verification lives in `docs/ssr-hydration.md:199-313` (an llms source — regen after edits). Guardrail test style precedent: `__tests__/ssrHydration.guardrail.test.ts` (cheap source/lock checks, no heavy mocks).

## Work

1. **Reproduce first**: `bun install` (clean), `bun run build && bun run start`, then `curl -s -H 'Cookie: has-seen-onboarding=1' localhost:3000/screen-faq` and several other `(main)` routes (quote parens in shell). Capture the `SSR streaming render error:` stack from the server log. If NO error reproduces on a clean install, document that (the prior sighting may have been the corrupted install), add the guardrails from step 3 anyway, and skip step 2.
2. Fix per the actual stack. If it implicates the slot split or any duplicated Radix module: unify via `package.json` `overrides` (e.g. pin `@radix-ui/react-slot` to one version compatible with both 1.2.3 and 1.2.4 consumers — they're a patch apart; verify with `bun install` + lockfile inspection) and/or add the implicated `@radix-ui/*` packages to `metro.config.js` `dedupePackages` following the existing pattern. If the stack shows something else entirely, fix that and say so plainly in the PR.
3. Guardrails regardless of outcome:
   - A test beside `ssrHydration.guardrail.test.ts` asserting `bun.lock` resolves exactly one version of `@radix-ui/react-slot` (and any other package step 2 unified).
   - Extend `docs/ssr-hydration.md`'s verification section with a `(main)`-route SSR check: cookie-authenticated curl must return a non-empty body containing real route markup; then `bun run docs:llms` and commit the regen.
4. Verify the showcase Tabs demo (`@rn-primitives/tabs` consumer) still works on web and native after any version unification.

## Validation

- `bun run verify` passes (includes the new lockfile guardrail test).
- `bun run build && bun run start`; with the onboarding cookie: `/`, `/screen-faq`, `/settings`, `/profile` all return non-empty bodies with real markup, and the server log shows **zero** `SSR streaming render error:` lines across those requests.
- Browser: `/screen-faq` and the Settings tab render and hydrate without new console errors; showcase Tabs demo (web) switches tabs; AlertDialog demo opens (the known slot-dup crash surface).
- iOS simulator: tabs navigation and showcase Tabs/AlertDialog demos unaffected.

## Out of scope

- Making the streaming renderer return a 500 on SSR errors (upstream expo-router behavior — note as follow-up if it bites).
- The icon-font hydration fix (separate spec: `ssr-icon-font-hydration.md`).

## Open questions

- None (the diagnose-first step resolves the one unknown).
