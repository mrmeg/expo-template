# Spec: Parameterize App Identity

**Status:** Ready
**Priority:** Medium
**Scope:** Server + Client

---

## What
Create a single, documented app identity configuration surface for name, slug, URL scheme, bundle identifier, Android package, and billing return scheme. Adopters should be able to rename the template safely without searching through unrelated files.

## Why
Every new app starts by becoming a different app. Hardcoded template identity values slow that down and increase the chance of broken deep links, native build IDs, or billing return URLs.

## Current State
`app.config.ts` hardcodes `name`, `slug`, `scheme`, `ios.bundleIdentifier`, and `android.package`. `app.json` contains a duplicate static config with the same identity values. `client/features/billing/hooks/useBillingActions.ts` hardcodes `myapp://billing/return`, and Agent billing docs refer to the same scheme.

## Changes
1. Establish one identity source of truth.
   - Prefer `app.config.ts` as the dynamic Expo config.
   - Decide whether `app.json` should be removed, minimized, or explicitly documented as unused.
   - Read identity values from env or a small checked-in template config object with env overrides.

2. Parameterize native and web identity fields.
   - Name and slug.
   - URL scheme.
   - iOS bundle identifier.
   - Android package.
   - Optional public app URL if already handled by existing billing env.

3. Parameterize billing return scheme.
   - Build native billing return URL from the same scheme used by Expo config.
   - Preserve `/billing/return` as the path.
   - Keep web return URL behavior unchanged.

4. Add validation and tests.
   - Validate malformed schemes/package IDs early enough to help adopters.
   - Test fallback defaults and env overrides.
   - Test billing return URL generation.

5. Update docs.
   - Add a rename checklist.
   - Update billing docs to avoid hardcoding `myapp` except as an example default.

## Acceptance Criteria
1. The default template still resolves to the current identity values unless env/config overrides are supplied.
2. Changing the configured scheme updates native billing return URLs.
3. `app.config.ts` and docs no longer require manual edits in multiple places for a basic app rename.
4. Static `app.json` duplication is removed or clearly made non-authoritative.
5. Typecheck and relevant tests pass.

## Constraints
- Do not break Expo config loading.
- Keep default values usable out of the box.
- Do not expose server secrets through public Expo config.
- Maintain compatibility with native deep link return handling.

## Out of Scope
- Replacing all assets/icons for a branded app.
- Automating app-store provisioning.
- Changing Stripe webhook behavior.

## Files Likely Affected
Client / config:
- `app.config.ts`
- `app.json`
- `client/features/billing/hooks/useBillingActions.ts`
- `client/config/*`

Tests:
- Billing action tests
- New app config helper tests if helpers are extracted

Docs:
- `README.md`
- `.env.example`
- `Agent/Docs/BILLING.md`
- `Agent/Docs/APP_OVERVIEW.md`

## Edge Cases
- Empty env values should fall back to template defaults.
- Invalid URL schemes should be rejected or warned before producing bad native links.
- Web billing should still use `EXPO_PUBLIC_APP_URL` or request origin, not the custom scheme.
- Existing tests that assert `myapp://billing/return` should be updated to derive from the default config.

## Risks
Expo config is loaded in Node while client code is bundled by Expo, so sharing config must respect environment boundaries. Keep shared helpers simple and avoid importing client-only modules into `app.config.ts`.
