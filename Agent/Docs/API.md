# API

This template uses Expo Router API routes under `app/api/**/+api.ts`, with
shared server helpers under `server/api/**`.

## Route Families

| Family | Routes | Purpose |
|--------|--------|---------|
| Template | `app/api/template/*+api.ts` | Server Alpha demo endpoints for status, examples, and echo |
| Media | `app/api/media/*+api.ts` | Upload signing, read signing, listing, and deletion |
| Billing | `app/api/billing/*+api.ts` | Stripe summary, checkout, portal, and webhook |

`app/+middleware.ts` is enabled for API and Server Alpha routes. Keep it
lightweight; route-specific auth, parsing, and validation belong in route
helpers unless every route genuinely needs the work.

## Shared Helpers

| Concern | Source | Contract |
|---------|--------|----------|
| CORS | `server/api/shared/cors.ts` | OPTIONS support and allowed-origin headers |
| Auth | `server/api/shared/auth.ts` | `requireAuthenticatedUser()` with pluggable token verifier |
| Errors | `server/api/shared/errors.ts` | Typed JSON problem responses |
| Rate limits | `server/rateLimits.js` | Shared limiter data for Bun and Express servers |

Protected routes fail closed when auth is not configured. Missing or invalid
bearer tokens return structured 401 responses.

## Media API

Media routes wrap `@mrmeg/expo-media/server` through app adapters in
`server/media/`.

Required storage env:

- `R2_JURISDICTION_SPECIFIC_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

When these are missing, every media route returns `503 media-disabled` and the
server does not construct an S3 client. OPTIONS preflight still succeeds.

Key invariants:

- Upload signing validates media type, content type, size, and configured
  policy before returning a presigned URL.
- Clients cannot choose arbitrary buckets, raw prefixes, or unrestricted keys.
- Upload URLs expire quickly; read URLs are short-lived signed URLs.
- Batch delete can partially succeed and must report confirmed deletions plus
  per-key errors.
- Production ignores the public media bypass; `EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA`
  is local/demo-only.

## Billing API

Billing is the hosted-external Stripe baseline.

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/billing/summary` | GET | Cognito bearer | Returns normalized `BillingSummary` |
| `/api/billing/checkout-session` | POST | Cognito bearer | Creates Stripe Checkout session from server-owned price ids |
| `/api/billing/portal-session` | POST | Cognito bearer | Creates Billing Portal session |
| `/api/billing/webhook` | POST | Stripe signature | Uses raw request text before JSON parsing |

When billing is unconfigured, routes return `503 billing-disabled` and no
Stripe traffic is generated.

Billing state is webhook-authoritative. Return URLs are UX signals only; client
code refetches summary after returning from Checkout or Portal.

## Client API Surface

`client/lib/api/apiClient.ts` returns discriminated results for generic fetch
work. It retries transient failures and does not retry 401, 403, or 404.

`client/lib/api/authenticatedFetch.ts` injects Cognito tokens via Amplify and is
the default for protected bundled feature calls.

Feature-specific wrappers live in the feature folder, for example
`client/features/billing/api.ts` and `client/features/media/mediaClient.ts`.
They should normalize errors for UI code instead of leaking raw server shapes.

## Server Runtime

`server.bun.ts` is the default production server. It serves compressed static
assets, applies security headers, handles CORS/rate limiting, and passes SSR
requests to Expo Server.

`server/index.ts` is the Express fallback and should preserve the same route
limits and security posture.

Rate limit data is centralized in `server/rateLimits.js`:

- General `/api/*`: 500 requests per 15 minutes.
- Media signer: `/api/media/getUploadUrl`, 60 requests per minute.
- Strict side-effect routes: billing checkout/portal and legacy reports paths,
  10 requests per minute.
