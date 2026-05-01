# Night Shift Report — 2026-05-01

## Completed

### fix-lint-dependency
**Commits:** `06382c5 fix(lint): restore bun run lint on ESLint 10`, `febcae8 chore: complete …`
**What changed:** Added `globals`, `@eslint/js`, `@eslint/eslintrc`, and `@typescript-eslint/parser` (pinned at `^8.58.2` to match the existing plugin) to devDeps so the flat config can load. Pinned `settings.react.version` to `"19.2"` so `eslint-plugin-react@7.37.5` doesn't crash on the removed `context.getFilename()` API in ESLint 10.

**How to verify:**
1. `bun install`
2. `bun run lint` — exits 0 (148 pre-existing source warnings, all `@/indent` and `@typescript-eslint/no-explicit-any`).
3. `bun run typecheck` — clean.
4. CLI/tooling only — no UI to test.

---

### ignore-generated-coverage-output
**Commits:** `d390d6a chore(gitignore): ignore Jest coverage output`, `ba4f0a4 chore: complete …`
**What changed:** Added `coverage/` to `.gitignore` so `bun run test:ci` no longer dirties the working tree.

**How to verify:**
1. `rm -rf coverage && bun run test:ci`
2. `git status` — `coverage/` is no longer reported.

---

### align-env-validation-with-optional-template-features
**Commits:** `a7039b1 feat(env): align client validation with optional template features`, `f02a807 chore: complete …`
**What changed:** `validateClientEnv` no longer treats Cognito or `EXPO_PUBLIC_API_URL` as required. Warns only on partial Cognito (one of two pool vars set) or billing-enabled-without-app-url. Whitespace-only values normalized as missing. `.env.example`, README, APP_OVERVIEW, API.md updated to match.

**How to verify:**
1. With a fresh `.env.example`-style env (all five pool/api/billing/app vars blank) start the app: `npx expo start`.
2. Open the dev console — no `Missing required client environment variables` warning.
3. Set only `EXPO_PUBLIC_USER_POOL_ID="us-east-1_x"` → reload — see one warning naming `EXPO_PUBLIC_USER_POOL_CLIENT_ID` as missing.
4. Set `EXPO_PUBLIC_BILLING_ENABLED="true"` with `EXPO_PUBLIC_APP_URL=""` → reload — see the billing-app-url warning.

---

### modernize-generator-scaffolds
**Commits:** `37b0b71 feat(generate): align scaffolds with current template architecture`, `df935ab chore: complete …`
**What changed:** Generator produces files matching the current architecture. Screens write both `client/screens/<Name>Screen.tsx` and `app/(main)/(demos)/screen-<kebab>.tsx`. Forms use `@/client/lib/form` primitives. Hooks no longer ship TODO bodies or unused imports. Components no longer destructure unused `getShadowStyle`. Pure helpers exported for unit tests.

**How to verify:**
1. `bun run generate component DemoButton` → `client/components/ui/DemoButton.tsx` exists, `bun run typecheck` passes.
2. `bun run generate screen DemoView` → both `client/screens/DemoViewScreen.tsx` and `app/(main)/(demos)/screen-demo-view.tsx` exist.
3. `bun run generate hook DemoCounter` → `client/hooks/useDemoCounter.ts` exists with a working `useState` body.
4. `bun run generate form DemoContact` → `client/components/forms/DemoContactForm.tsx` exists, uses `FormProvider form={form}` (not spread). `bun run typecheck` passes.
5. Re-run any of the above → exits with `Error: <path> already exists`. (Clean up scaffolds when done.)

---

### harden-media-empty-and-unconfigured-states
**Commits:** `05036a4 feat(media): harden empty and unconfigured states`, `a381ed9 chore: complete …`
**What changed:** All four media routes (`list`, `getUploadUrl`, `getSignedUrls`, `delete` for both DELETE single and POST batch) now return a typed `503 media-disabled` body when any of the four `R2_*` env vars is missing or whitespace-only. The Media tab renders a setup-state UI (cloud-off icon + missing-vars list) when disabled, and a retryable error state with a Retry button for transient failures.

**How to verify (web):**
1. With `R2_*` env vars blank, `bun run web` → open the Media tab → see "Media storage not configured" + the missing env-var names + the upload button is disabled.
2. Hit `/api/media/list` directly → `503` response, body `{ code: "media-disabled", missing: [...] }`, no `R2_*` values echoed.
3. Set all four `R2_*` env vars → restart → Media tab loads normally; uploads work.
4. Stop the dev server while Media is open → see the retryable error state with a Retry button (testID `media-error`).

---

### refresh-public-template-docs
**Commits:** `be6cfbb docs(template): refresh README and CONTRIBUTING for current architecture`, `8c5f90b chore: complete …`
**What changed:** README and CONTRIBUTING rewritten — every script switched from `npm` to `bun`, architecture diagram fixed to show real paths (`client/features/i18n`, `client/lib/api`, `client/state`, etc.), theme tokens fixed (`bgPrimary`/`textPrimary` → `background`/`foreground`), icon library fixed (Lucide → Feather), font fixed (no Merriweather, just Lato), removed gitignored CLAUDE.md references.

**How to verify:**
1. Open README — every code snippet uses an exported API that exists in the codebase, every path in the architecture diagram is real, every script in the table runs (`bun run web`, `bun run typecheck`, etc.).
2. Open CONTRIBUTING — PR checklist references `bun run` commands, "Project Structure" points at `Agent/Docs/ARCHITECTURE.md`, no `CLAUDE.md` references remain.

---

### align-billing-docs-with-session-routes
**Commits:** `d05c6f9 docs(billing): align route names and bodies with implementation`, `5f88d5c chore: complete …`
**What changed:** BILLING.md flow diagrams, server-surface table, edge-case row, and rate-limit paragraph now name `/api/billing/checkout-session` + `/api/billing/portal-session` consistently with `{ planId, interval, returnPath }` bodies. API.md rate-limit paragraph updated from "should be registered when the routes land" to the actual current state. No implementation change needed — `client/features/billing/api.ts` and `server/rateLimits.js` already matched.

**How to verify:**
1. Read BILLING.md — `checkout` / `portal` (without `-session`) and raw `priceId` no longer appear as implemented routes/bodies.
2. `grep -n "billing/checkout\b\|billing/portal\b\|priceId" Agent/Docs/*.md` returns no false matches (the only remaining `priceId` is a clarifying note saying clients must NOT send raw price ids).

---

### define-feature-dependency-contracts
**Commits:** `302be97 feat(features): define and enforce cross-feature dependency contract`, `7ceaf62 chore: complete …`
**What changed:** New `scripts/check-feature-isolation.js` walks `client/features/<f>` for `@/client/features/<g>/...` imports and validates against an `ALLOWED_DEPENDENCIES` allowlist (`app → {auth, onboarding}`, `billing → auth`, all others self-contained). Wired into `bun run check:features` and `client/features/__tests__/featureIsolation.test.ts` (3 tests). ARCHITECTURE.md replaces the false "never cross-import" rule with the actual matrix and per-feature copy-with notes.

**How to verify:**
1. `bun run check:features` → "✓ Feature isolation OK across 8 features."
2. Edit any feature to add a new disallowed import (e.g. `client/features/media/x.ts` imports `@/client/features/auth/...`) → `bun jest --testPathPattern=featureIsolation` fails with the offending file.

---

### parameterize-app-identity
**Commits:** `01b59e3 feat(identity): centralize app identity behind app.identity.ts`, `e02c1b1 chore: complete …`
**What changed:** New `app.identity.ts` is the single source of truth for name, slug, scheme, iOS bundle id, Android package. Reads `EXPO_PUBLIC_APP_*` env overrides with field-level validation (RFC scheme, reverse-DNS bundle/package, kebab slug). `app.config.ts` consumes `getAppIdentity()`. Runtime `client/lib/identity.ts` exposes `getAppScheme()` / `buildAppDeepLink()`. `useBillingActions.ts` builds the native return URL via `buildAppDeepLink("/billing/return")` instead of hardcoding `myapp://`. Removed redundant `app.json`.

**How to verify:**
1. `npx tsx -e "console.log(require('./app.config').default({}))"` → see the resolved ExpoConfig with `scheme: "myapp"`.
2. Set `EXPO_PUBLIC_APP_SCHEME="acme"` → re-run → see `scheme: "acme"`.
3. Set `EXPO_PUBLIC_APP_SCHEME="Has Spaces"` → throws with `Invalid app scheme "Has Spaces"`.
4. With native build configured: `npx expo prebuild` and confirm the iOS/Android projects pick up the env-driven bundle id.

---

### restore-template-ci-workflow
**Commits:** `a67b117 ci: restore GitHub Actions workflow`, `f5fa125 chore: complete …`
**What changed:** New `.github/workflows/ci.yml` with two parallel jobs — `validate` (typecheck → lint → check:features → test:ci) and `bundle-size` (build → bundle-size). Concurrency cancels stale runs. No app credentials required. README/CONTRIBUTING/AGENTS/ARCHITECTURE/PERFORMANCE updated to describe the workflow.

**How to verify:**
1. Push any commit → GitHub Actions runs both jobs.
2. Locally reproduce: `bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run check:features && bun run test:ci && bun run build && bun run bundle-size`.

---

### create-template-registry-for-showcase-and-explore
**Commits:** `613e69f feat(showcase): introduce template registry, drive Explore from it`, `d7bee32 chore: complete …`
**What changed:** New `client/showcase/registry.ts` exports typed `SCREEN_TEMPLATES`, `DEMOS`, and `COMPONENTS` arrays with stable ids and a `getComponentCount()` helper. The Explore tab (`app/(main)/(tabs)/index.tsx`) reads from the registry instead of carrying its own arrays + a hardcoded "35 components" badge. The component count is now derived. Per the spec the showcase decomposition is a first pass — the 2,169-line showcase file is left intact for a future shift.

**How to verify:**
1. Open the Explore tab → screen-template grid, demo list, and the component badge all render the same content as before.
2. Edit `client/showcase/registry.ts` to add a new entry to `SCREEN_TEMPLATES` → reload → it appears in the Explore grid.
3. `bun jest --testPathPattern=showcase/__tests__/registry` runs 10 tests; route uniqueness, file-existence, and import-path conventions all pin the contract.

---

### expand-reusable-surface-coverage
**Commits:** `b2e9314 test(coverage): expand reusable surface coverage, fix act warnings`, `af37fee chore: complete …`
**What changed:** 28 new behaviour-only tests across 7 suites: Card, Badge, EmptyState, Skeleton, RadioGroup, the form primitive trio (FormProvider + FormTextInput + FormCheckbox), and three screen templates (WelcomeScreen, ErrorScreen, ListScreen). New `test/mockTheme.ts` shared helper. Wrapped `useAuthStore.setState` in `act(...)` in the billing tests to silence React Test Renderer's "updates not wrapped in act" warnings.

**How to verify:**
1. `bun run test:ci` — 424/424 tests across 53 suites; no `act(...)` warnings in the output.
2. `bun jest --testPathPattern=useBillingActions` — clean.

---

## Blocked

None.

## Issues Discovered

- `server/rateLimits.js` lists `/api/reports` and `/api/corrections` as strict-limit paths but no such routes exist anywhere in the repo. The docs accurately reflect the config (PERFORMANCE.md / DOMAIN.md / API.md mention them); the config itself is the stale piece. Worth a future cleanup spec.
- `eslint-plugin-react@7.37.5` is not yet ESLint 10-compatible. The `settings.react.version` workaround is in place; the inline comment names the reason. Once a new release ships, the pin can revert to `"detect"`.
- The 148 pre-existing lint warnings (mostly `@/indent` and `@typescript-eslint/no-explicit-any`) are out of scope for tonight but worth a future style sweep.
- `app/(main)/(demos)/showcase/index.tsx` is 2,169 lines and not yet decomposed (the registry spec was scoped to extract metadata only). A future spec could split it per-component category.
- The wrap-up docs audit caught and fixed: stale "17 screen templates" references (actual: 13) in APP_OVERVIEW / ARCHITECTURE / DESIGN / USER_FLOWS, "Inter" font claim in DESIGN.md (actual: Lato), an `api/_shared/` path that should be `server/api/shared/`, a `(main)/showcase/**` path that should be `(main)/(demos)/showcase/**`, an "EAS Build configured in app.json" reference that's now `app.config.ts` + `app.identity.ts`, and a vestigial `notifications` feature folder citation (no such folder — toast lives in `client/state/globalUIStore` from the shared layer). Also dropped `notifications` from the feature-isolation allowlist.

## Docs Updated

- `Agent/AGENTS.md` — task list emptied; CI row reinstated in Tech Stack; `--frozen-lockfile` note added.
- `Agent/Docs/APP_OVERVIEW.md` — "How to Use" rewrites for env optionality; screen count corrected; billing scheme reframed.
- `Agent/Docs/ARCHITECTURE.md` — feature isolation matrix; SSR + CI bullets; `app.config.ts` build note; correct hook count; correct shared-helpers path; removed phantom `notifications` feature.
- `Agent/Docs/API.md` — env table optionality note; media-disabled response; billing rate-limit paragraph corrected.
- `Agent/Docs/BILLING.md` — flow diagrams use `-session` routes + `{ planId, interval, returnPath }`; scheme derivation note; `bun` instead of `npm`.
- `Agent/Docs/DESIGN.md` — Lato (not Inter) font; correct screen-template count.
- `Agent/Docs/DOMAIN.md` — feature isolation matrix replaces the "never cross-import" absolute.
- `Agent/Docs/PERFORMANCE.md` — CI bullet for the bundle-size gate.
- `Agent/Docs/USER_FLOWS.md` — media disabled / error / retryable branches; correct showcase path; correct screen count.
- `README.md`, `CONTRIBUTING.md`, `.env.example` — wholesale refresh.
