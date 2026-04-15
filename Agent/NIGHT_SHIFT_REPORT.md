# Night Shift Report — 2026-04-15

## Summary

Ran the spec queue end-to-end: 3 bug fixes, 6 billing features, 1 FFmpeg-worker
regression fix, and 1 coverage-expansion spec. All specs that were in
`Agent/Specs/` at the start of the shift are now committed and removed. The
queue is empty.

Full test suite: **310 tests, 38 suites, all green** (up from 174 tests at
shift start). Working tree clean. 22 commits on `dev`, none pushed — awaiting
human review.

## Tasks completed

### Bug fixes (priority-ordered)
1. **fix-media-delete-cors-for-web** — `Access-Control-Allow-Methods` now
   advertises `DELETE` so browser preflights to `DELETE /api/media/delete` no
   longer fail. Regression coverage in `app/api/_shared/__tests__/cors.test.ts`.
   Commit: `95c6aaa`.
2. **align-media-upload-rate-limiting** — strict 10-req/min limiter moved
   from the stale `/api/media/upload-url` path to the real
   `/api/media/getUploadUrl` route. Config extracted to
   `server/rateLimits.js` so the paths can't drift back. Commit: `9fb2654`.
3. **restore-web-ffmpeg-worker-serving** — single-source `server/ffmpegWorker.js`
   CommonJS helper now drives both `metro.config.js` (dev) and
   `server/index.ts` (prod). Typed `FFmpegWorkerUnavailableError` propagates
   from `convert.ts` through `useMediaLibrary` with a distinct toast message,
   keeping the graceful fallback to upload-as-is. Commit: `f9ebe2d`.

### Features (spec-driven)
4. **wire-app-shell-to-auth-and-onboarding-flows** — new `client/features/app/`
   owns startup sequencing. Splash stays until fonts + i18n + onboarding +
   (optional) Amplify bootstrap resolve. `AuthGate` wraps Profile/Settings
   tabs; `OnboardingGate` runs inline on first launch. Template stays
   explorable without Cognito env vars. Commit: `072c912`.
5. **define-default-stripe-subscriptions-architecture** — `Agent/Docs/BILLING.md`
   names Stripe Checkout + Billing Portal in `hosted-external` mode as the
   baseline, with explicit out-of-scope guardrails (native PaymentSheet,
   store IAP, metered, tax, seats). Cross-linked from ARCHITECTURE, API,
   APP_OVERVIEW, DOMAIN, USER_FLOWS. Commit: `3a7a6bf`.
6. **add-billing-identity-and-subscription-state** — `shared/billing.ts`
   defines `BillingSummary`, `freeBillingSummary`, `isEntitled`,
   `normalizeStripeSubscription`. New `BillingAccountResolver` implements
   the metadata → email-backfill → `CustomerConflictError` → create
   ladder without auto-creating customers. `useBillingSummary` is the
   single client entry point. Commit: `dcd8abe`.
7. **add-authenticated-billing-api-foundation** — four routes
   (`summary`, `checkout-session`, `portal-session`, `webhook`) driven by
   a process-wide `BillingRegistry` so unconfigured deployments return a
   typed `503 billing-disabled`. Webhook reads `request.text()` before any
   parse so the signature bytes match. Client-side `BillingProblem` union
   folds typed server errors into a discriminated UI contract. Commit:
   `32728aa`.
8. **add-stripe-subscriptions-bootstrap-and-config** — lazy
   `ensureAuthBootstrapped` and `ensureBillingBootstrapped` read
   `STRIPE_*` env on first request, honor preinstalled registries (so tests
   can still inject fakes), fall through to `null` when env is missing, and
   are idempotent. Adapter handles both legacy + modern
   `current_period_end` placement. Stripe SDK never imported when billing
   is disabled. Commit: `9d6fbed`.
9. **wire-pricing-and-account-ui-to-billing** — `PricingScreen` accepts
   billing-aware fields (`planId`, `actionLabel`, `actionState`, etc.) so
   one component renders both demos and live state. New `useBillingActions`
   posts to `/api/billing/{checkout,portal}-session`, hands off via
   `window.location.href` on web / `openAuthSessionAsync` on native, and
   invalidates the summary query on return. Profile tab gained a single
   context-aware CTA plus `cancelAtPeriodEnd` / `past_due` warning rows.
   Commit: `c17a77d`.

### Coverage / infrastructure
10. **expand-coverage-for-auth-onboarding-and-media-server** —
    `jest.config.js` now collects coverage from `app/api/**`, `server/**`,
    and `shared/**` in addition to `client/**`. Added suites for
    `ensureAmplifyConfigured` env validation, the synchronous `authStore`
    surface, the onboarding store (native + web storage paths), and the
    media delete route (OPTIONS preflight, 400/500 paths, S3 mock). 28 new
    tests, 310 total across 38 suites. Commit: `64505c2` + TS fix
    `4de1e9d`.

## Docs updated during the shift
- `Agent/Docs/BILLING.md` — new, then extended with setup walkthrough and
  "Disabling billing cleanly" section
- `Agent/Docs/ARCHITECTURE.md` — billing section + media pipeline now
  references the optional web conversion step
- `Agent/Docs/API.md` — billing routes, env variables, typed error codes
- `Agent/Docs/APP_OVERVIEW.md`, `DOMAIN.md`, `USER_FLOWS.md` — billing
  baseline cross-links, CTA state machine, warning-row rules
- `Agent/Docs/DESIGN.md` — CTA state machine, warning-row treatment
- `Agent/Docs/PERFORMANCE.md` — FFmpeg worker path contract + graceful
  failure model
- `Agent/CHANGELOG.md` — one entry per feature/fix
- `README.md` — short Billing section added

## Blockers / NEEDS INPUT FROM USER

- **`bun lint` fails on an unrelated ESLint module error** — `ESLint:
  10.2.0 ... SyntaxError: The requested module 'minimatch' does not
  provide an export named 'default'`. This predates the shift (visible on
  `dev` before any night-shift commit). Not blocking test/typecheck;
  leaving for human triage since it's a dependency/toolchain issue rather
  than a code issue.

## Verification

- `npx jest` — **310 tests, 38 suites, 0 failures**
- `npx tsc --noEmit` — **clean**
- `git status` — **working tree clean**
- `Agent/Specs/` — **empty** (all specs consumed)
- `Agent/AGENTS.md` — task-list marker: _"No Ready specs — queue empty."_

## Commits shipped

```
4de1e9d fix(test): drop NODE_ENV capture from delete.test.ts
b11d168 chore: complete expand-coverage-for-auth-onboarding-and-media-server
64505c2 test(coverage): expand auth, onboarding, and media server coverage
b9d0efa chore: complete restore-web-ffmpeg-worker-serving
f9ebe2d fix(media): restore web FFmpeg worker serving
979bec7 chore: complete wire-pricing-and-account-ui-to-billing
c17a77d feat(billing): wire pricing and account UI to live billing state
636e1af chore: complete add-stripe-subscriptions-bootstrap-and-config
9d6fbed feat(billing): add Stripe subscriptions bootstrap and config
8cf3964 chore: complete add-authenticated-billing-api-foundation
32728aa feat(billing): add authenticated billing API foundation
e30132a chore: complete add-billing-identity-and-subscription-state
dcd8abe feat(billing): add billing identity and normalized subscription state
328350c chore: complete define-default-stripe-subscriptions-architecture
3a7a6bf docs(billing): define default Stripe subscriptions architecture
9550a30 chore: complete wire-app-shell
072c912 feat(app): wire shell to auth and onboarding flows
9fb2654 fix(server): apply strict limiter to real upload-url route
95c6aaa fix(cors): allow DELETE method cross-origin for media delete
2b2ab23 fix: resolve pre-existing test failures
```

## Recommended next steps for day shift

1. Review the billing stack end-to-end against a real Stripe test
   account — the setup walkthrough in `BILLING.md` is the happy path, but
   human verification that the webhook + portal round-trip works in a
   real account is the only thing the night shift couldn't do.
2. Triage the `bun lint` failure — likely a dependency bump fix.
3. Consider enabling the commented-out coverage thresholds in
   `jest.config.js` now that the real risk areas are measured.
