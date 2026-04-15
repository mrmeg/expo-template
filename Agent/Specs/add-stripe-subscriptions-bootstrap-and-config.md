# Spec: Add Stripe Subscriptions Bootstrap And Config

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Add the dependency, environment, validation, and setup surface needed to enable the default Stripe subscriptions integration in local development and deployed environments. The template should make it obvious how to turn billing on, how to leave it off, and which secrets or URLs belong on the server versus the client.

## Why
The repo currently has no Stripe packages, no billing environment variables, and no setup documentation. A default integration is not "out of the box" unless a fresh adopter can follow a documented setup path from an empty project to a working test subscription flow.

## Current State
- `package.json` does not include Stripe SDKs or Cognito JWT verification helpers for server-side auth.
- `.env.example` contains Cognito and R2 variables only.
- `client/lib/validateEnv.ts` validates auth and API variables, but it knows nothing about billing-specific configuration.
- `app.json` includes a scheme and `expo-web-browser`, but there is no billing-oriented return-path contract or config documentation.

## Changes
### 1. Add the baseline billing dependencies
Files:
- `package.json`
- `bun.lock` / lockfile

Add only the packages required for the hosted billing baseline:
- Stripe server SDK for Checkout, Portal, and webhook handling
- a server-side JWT verification dependency for Cognito bearer token validation if the implementation does not already use an AWS-native verifier available elsewhere

The baseline should not require `@stripe/stripe-react-native` unless a later spec promotes native PaymentSheet support.

### 2. Add explicit billing environment variables
Files:
- `.env.example`
- `client/lib/validateEnv.ts`
- `client/config/config.base.ts`
- `client/config/config.dev.ts`
- `client/config/config.prod.ts`
- `Agent/Docs/API.md`

Add billing-related configuration such as:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_*` values for the default plans
- `EXPO_PUBLIC_APP_URL` or equivalent deployed web base URL
- `EXPO_PUBLIC_BILLING_ENABLED`
- any return URL or portal return configuration that cannot be derived from app config

The spec must separate:
- server secrets and Stripe identifiers stored in env,
- user-facing plan metadata stored in shared code or documented config,
- feature flags that can safely be read by the client.

Validation rules:
- Billing env vars should validate at point of use so the template can still run without Stripe configured.
- Secrets must remain server-only.
- Client-exposed variables should be limited to safe runtime config.

### 3. Document setup from a fresh Stripe account
Files:
- `README.md`
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/API.md`

Document:
- required Stripe products and prices,
- which env vars map to which Stripe objects,
- how to run Stripe CLI webhook forwarding in local development,
- how to configure success / cancel / return URLs for web and native,
- how to keep billing disabled cleanly in projects that do not need it yet.

### 4. Standardize enablement and graceful disable behavior
Files:
- `client/config/index.ts`
- `app/_layout.tsx`
- `client/features/billing/**` (new)

Billing should be feature-flagged by config so:
- projects without Stripe credentials do not crash on startup,
- billing screens can hide or disable purchase CTAs cleanly,
- server routes fail with clear configuration errors rather than generic 500s.
- `EXPO_PUBLIC_BILLING_ENABLED` should default to `false` in the template docs and examples.
- Disabled billing routes should return a deterministic typed error instead of silently failing.

### 5. Align app config with hosted billing return flow
Files:
- `app.json`
- `Agent/Docs/BILLING.md` (new)

Document whether the existing app scheme is sufficient, and if not, standardize the app-level path conventions required for return-to-app billing flows.

## Acceptance Criteria
1. The repo declares the minimum dependencies required for hosted Stripe subscriptions and authenticated billing routes.
2. `.env.example` includes the server and client billing configuration needed for local setup.
3. Billing configuration validates gracefully and does not break unrelated auth/media flows when omitted.
4. The docs describe a complete local setup path, including Stripe CLI webhook forwarding.
5. The app-level return-flow conventions for hosted billing are explicit in config and docs.
6. The docs make it clear which values live in env versus shared code and what happens when billing is disabled.

## Constraints
- Keep the template runnable without Stripe credentials.
- Do not expose secret keys or webhook secrets to client code.
- Prefer the smallest package surface that supports the hosted-billing baseline.
- Avoid introducing platform-specific native Stripe config unless a later spec requires it.
- Do not make price IDs the only source of human-readable plan metadata.

## Out of Scope
- Automatic provisioning of Stripe dashboard objects
- One-command Stripe account bootstrap scripts
- Native PaymentSheet setup
- Region-specific tax or compliance documentation
- Production incident runbooks

## Files Likely Affected
### Server
- `package.json`
- lockfile
- `app/api/billing/**`

### Client
- `.env.example`
- `client/lib/validateEnv.ts`
- `client/config/**`
- `app.json`
- `app/_layout.tsx`

### Docs
- `README.md`
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/API.md`

## Edge Cases
- Only some price IDs are configured.
- Webhook secret is present locally but points to an outdated Stripe CLI session.
- Billing is disabled in one environment and enabled in another.
- Native apps use a local server URL while web uses a deployed public origin.
- A developer configures Stripe secrets but forgets the return URL contract.
- A price ID is missing for one interval but billing is otherwise enabled.

## Risks
- Environment drift between local, preview, and production will cause subtle failures unless the docs are explicit.
- If config validation happens too early, the repo will become harder to use for non-billing adopters.
