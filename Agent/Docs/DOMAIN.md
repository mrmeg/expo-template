# Domain

This repo is an app template, so the domain is a set of reusable product
capabilities rather than one concrete business model. The important rules are
the contracts adopters inherit.

## Optional Feature Posture

Auth, billing, media, and Sentry are optional. A blank `.env` should still let
the template run and be explored.

| Feature | Enabled by | Missing-env behavior |
|---------|------------|----------------------|
| Auth | `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID` | `AuthGate` becomes a no-op |
| Billing | Public billing flag plus server Stripe env | UI hides purchase actions; routes return `billing-disabled` |
| Media | R2/S3 env vars | Media UI shows setup state; routes return `media-disabled` |
| Sentry | `EXPO_PUBLIC_SENTRY_DSN` | Runtime tracking stays inert |
| Native Sentry upload | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Config plugins are skipped |

## Identity

App identity lives in `app.identity.js` with TypeScript declarations in
`app.identity.d.ts`. `app.config.ts` and runtime deep-link helpers both read
from this source. Override name, slug, scheme, iOS bundle id, and Android
package with `EXPO_PUBLIC_APP_*` env vars instead of editing many files.

## Auth

Auth is Cognito via Amplify. The client-facing user identity is the Cognito
`sub` plus email. Protected screens use `AuthGate`; public screens stay
browsable whether auth is enabled or not.

Rules:

- Configure both public Cognito env vars or neither.
- Protected routes and billing/media server routes fail closed when auth is
  required and no verifier is available.
- Signing out on a protected tab replaces that tab with auth UI rather than
  forcing navigation away from public surfaces.

## Media

Media files are stored in S3/R2-compatible storage and accessed through signed
URLs. The server controls buckets, prefixes, key generation, allowed media
types, and content-type policy.

Rules:

- Clients request upload/read/delete/list operations through API routes, not
  direct bucket credentials.
- Upload signing validates the configured media type and content type.
- Client-side compression should keep the original file when conversion does
  not reduce size.
- Video thumbnails derive from video keys and should be deleted with their
  source video when selected.
- All-media listing aggregates configured media types; it must not list the
  bucket root.

## Billing

Billing is Stripe hosted-external by default: Checkout for purchase, Billing
Portal for management, and webhooks for authoritative state.

Rules:

- Clients send plan ids and intervals, never raw Stripe price ids.
- The server owns the plan catalog to price-id mapping.
- Subscription state is keyed to Cognito `sub`, not email.
- Webhook processing is authoritative; return URLs are UX hints.
- Entitlement is derived through shared helpers from normalized billing state.
- Native IAP, native PaymentSheet, tax, metered billing, seats, and invoices
  are outside the baseline and need their own explicit mode.

## Onboarding And Startup

`client/features/app/useAppStartup.ts` owns startup readiness. The splash stays
up until resources, i18n, onboarding state, and optional auth bootstrap resolve.

Onboarding is owned by the shell and rendered inline before the main Stack for
first-run users. The demo route only showcases the same primitive.

## Feature Isolation

Feature folders should remain portable. Keep cross-feature imports limited to
the allowed app-shell and billing-identity edges documented in
`Agent/Docs/ARCHITECTURE.md`. Run `bun run check:features` after boundary
changes.
