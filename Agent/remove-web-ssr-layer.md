---
status: done
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/56
---

# Remove the web SSR layer; revert to client-rendered `output: "server"`

## Goal

Drop `unstable_useServerRendering` and delete the SSR hydration-correctness layer built around it. Web becomes a client-rendered app served by the same server (API routes, middleware, static serving all stay). Rationale: six months of history show ~20 remediation commits (~6,700 lines) fixing problems SSR itself caused — unstyled flash, icon-font hydration, theme/viewport/onboarding cookie seeding, flush cascade order, Radix blank-200s — while no document in the repo records a business benefit. All 35 SSR'd routes are template demo/showcase screens; the only authed route server-renders a spinner anyway.

## Context

Verified current behavior:

- `app.config.ts:69-76` sets `unstable_useServerRendering: true`, `unstable_useServerMiddleware: true`, `unstable_useServerDataLoaders: true`, `asyncRoutes: { web: "production" }` on the `expo-router` plugin; `web.output` is `"server"` (`app.config.ts:148-152`).
- Every web route (35 htmlRoutes in `dist/server/_expo/routes.json`) is SSR'd at request time by Expo's renderer. 11 apiRoutes and 1 middleware are independent of the rendering flag.
- The SSR support layer is entirely defensive: server-side cookie readers (`server/lib/ssrTheme.ts`, `ssrOnboarding.ts`, `ssrViewport.ts`), seed providers (`client/components/SsrThemeProvider.tsx`, `client/features/app/ssrViewportMetrics.ts`, `packages/ui/src/state/ssrTheme.ts`, `SsrViewportContext.ts`), the RNW style flush (`client/features/app/SsrStyleFlush.tsx` + the empty `<style id="react-native-stylesheet">` adoption anchor in `app/+html.tsx`), the boot warm-up gate (`server.bun.ts` ~lines 110-140, 486-494), and the blank-screen watchdog (`client/features/app/blankRecoveryScript.ts`).
- Guardrail tests pin undocumented react-native-web dist behavior (`__tests__/rnwSheetAdoption.test.ts`) and SSR wiring structure (`__tests__/ssrHydration.guardrail.test.ts`, `__tests__/ssrWarmup.guardrail.test.ts`, `__tests__/ssrStyleCascade.test.tsx`).
- `metro.config.js:86-110` skips the dedupe rewrite for `react`/`react-dom` only because dev SSR node bundles externalize them (see memory: dev-ssr-externals-vs-metro-dedupe).
- `client/components/SsrViewportProvider.tsx` is already dead code (zero consumers).
- The `package.json` `overrides` for `@radix-ui/react-slot` / `react-primitive` also fix a real client-side AlertDialog crash — they must stay.
- `createThemedStyles` has 149 call sites across 75 files; it works fine client-only as a module-scope memo. Do not migrate call sites.
- Deployment is self-hosted Bun (`server.bun.ts` via `bun run start`); no hosting config depends on SSR.

## Work

Config:

- `app.config.ts`: remove `unstable_useServerRendering` and `asyncRoutes` from the `expo-router` plugin options. Keep `unstable_useServerMiddleware`, `unstable_useServerDataLoaders`, and `web.output: "server"`.
- `metro.config.js`: delete the `serverExternalizedPackages` branch (lines ~79-110); make the dedupe rewrite unconditional.

Delete outright (with their tests):

- `server/lib/ssrTheme.ts`, `ssrOnboarding.ts`, `ssrViewport.ts` + `server/lib/__tests__/ssrTheme.test.ts`, `ssrOnboarding.test.ts`, `ssrViewport.test.ts`
- `client/components/SsrThemeProvider.tsx` + `client/components/__tests__/SsrThemeProvider.test.tsx`, `client/components/SsrViewportProvider.tsx`
- `client/features/app/ssrViewportMetrics.ts` + `client/features/app/__tests__/ssrViewportMetrics.test.tsx`
- `client/features/app/SsrStyleFlush.tsx`, `client/features/app/blankRecoveryScript.ts`
- `packages/ui/src/state/ssrTheme.ts`, `packages/ui/src/state/SsrViewportContext.ts`
- `__tests__/ssrStyleCascade.test.tsx`, `__tests__/rnwSheetAdoption.test.ts`, `__tests__/blankRecovery.test.ts`, `__tests__/ssrWarmup.guardrail.test.ts`, `__tests__/ssrHydration.guardrail.test.ts`, `__tests__/ssrThemeStamp.test.tsx`
- `docs/ssr-hydration.md` (then `bun run docs:llms` to regenerate `llms-full.txt`; fix references at `llms.txt:22`, `AGENTS.md:24,52`, `docs/migration-guide.md:119`, `scripts/build-llms-full.mjs:43`)

Keep `__tests__/radixSingleton.guardrail.test.ts` if it still passes without SSR (it guards the client-side crash too); trim its SSR-specific assertions.

Simplify in place (remove SSR branches only):

- `app/+html.tsx`: reduce to a plain client-rendered document (~80-100 lines): meta viewport, global CSS, `ScrollViewStyleReset`, title/description, font preload, color-scheme script. Remove `useServerDocumentContext`, the headNodes filter, the RNW adoption anchor, `Accept-CH`, `data-theme`/`data-ssr-system-scheme` stamps, the dual theme-color metas, and the inline blank-recovery script.
- `server.bun.ts`: remove the SSR warm-up gate and its await in request handling. Everything else (static serving, rate limits, CORS, security headers, ffmpeg worker) stays. `server/index.ts` has no warm-up code — no changes needed there.
- `client/features/app/RootLayout.tsx`: remove `SsrThemeProvider`, `SsrStyleFlush`, viewport-metrics seeding.
- `packages/ui/src/state/themeStore.ts`: remove `writeThemeCookie` dual-write/backfill and `hasLoadedTheme` SSR gating (keep the persisted preference itself).
- `client/features/onboarding/onboardingStore.ts`: remove `writeOnboardingSeenCookie` and cookie-first reads; localStorage remains the source of truth.
- `packages/ui/src/hooks/useDimensions.ts`: remove the `mrmeg-vw` cookie write and `SsrViewportContext` seeding.
- `packages/ui/src/hooks/useResources.ts`: remove per-request `ensureIconFontRegistered()` render-body call if it was SSR-only; keep normal font loading.
- `packages/ui/src/hooks/useTheme.ts`: remove the `useSeed` web branch.
- `client/features/app/safariThemeColor.ts`: simplify to the unconditional post-hydration meta owner (~15 lines).
- `client/features/navigation/MainLayout.tsx`, `packages/ui/src/constants/fonts.ts`, `client/features/i18n/index.ts`: remove per-request seeding / sync-init constraints where they were SSR-only (i18n may keep sync init if harmless).
- `docs/server-guide.md`: remove the SSR sections (~100 lines); keep API routes/middleware/loaders.

Re-verify after removal:

- `client/features/server-alpha/loaders.ts` demo — loader data on a client-rendered route arrives via fetch; confirm the demo route still works or adjust its copy.
- `client/components/Seo.tsx` — keep, but note in code/docs that crawlers no longer see it.

## Validation

- `bun run typecheck && bun run lint`
- `bun run test:ci` (root) and `bun run ui:test`
- `bun run build` then confirm `dist/server/_expo/routes.json` htmlRoutes no longer use `rendering.mode: "ssr"` and API routes are still listed
- `bun run start-local` against the build: `/`, `/showcase`, `/settings` load and render client-side (no blank, theme toggle works, icons render); an API route (e.g. any `app/api/*+api.ts`) returns correctly; the loader demo route works
- Verify in a real browser on web (ui-verifier surface): first load of `/showcase` in light and dark system scheme — a brief client-render loading state is expected and acceptable; a persistent blank page is not
- `bun run docs:llms:check` passes after doc regeneration

## Out of scope

- Migrating the 149 `createThemedStyles` call sites — the API stays as a client-side memo helper.
- Removing the `@radix-ui` `package.json` overrides (they fix a client-side crash).
- Adopting `output: "static"` / prerendering — separate decision if marketing SEO ever matters.
- Native platforms, API route behavior, middleware, and the Bun/Express server surfaces beyond the warm-up gate.
- Deleting historical `Agent/ssr-*.md` specs (they stay as records).

## Merge plan

PR #52 (`agent/ssr-system-scheme-cookie`, in review) adds more SSR cookie plumbing that this spec deletes. Close #52 without merging and mark `Agent/ssr-system-scheme-cookie.md` declined — superseded by this removal. If #52 merges first anyway, this spec's deletions simply subsume its additions. PRs #51 and #53 are unrelated.

## Open questions

- None.
