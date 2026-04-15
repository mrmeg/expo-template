# Spec: Add Authenticated Billing API Foundation

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Add the authenticated API foundation required for hosted Stripe subscriptions: a reusable server auth guard for Expo Router API routes, billing endpoints for summary and session creation, and a webhook endpoint for Stripe events. These routes should return normalized data that fits the repo's existing typed API conventions.

## Why
The template already injects Cognito bearer tokens on the client, but the server does not verify them or resolve a current user. Billing cannot safely create Checkout Sessions, create Portal Sessions, or derive account state until authenticated route infrastructure exists.

## Current State
- `client/lib/api/authenticatedFetch.ts` can attach a Cognito access token to requests.
- The existing API routes under `app/api/media/` do not verify bearer tokens or resolve a current user.
- `server/index.ts` applies generic rate limiting but does not define billing routes or webhook-specific handling.
- There are no Stripe webhook handlers, no idempotency rules, and no server-side auth helpers in the repo.

## Changes
### 1. Add reusable request authentication for Expo Router API routes
Files:
- `app/api/_shared/auth.ts` (new)
- `app/api/_shared/errors.ts` (new)
- `Agent/Docs/API.md`

Create a reusable helper that:
- extracts the `Authorization` header,
- verifies the Cognito access token against the correct issuer and audience,
- returns an `AuthenticatedUser` with `userId`, `email`, and any required claims,
- produces consistent `401` / `403` responses.

This helper becomes the standard entry point for authenticated API routes across the template.

### 2. Add billing route surface
Files:
- `app/api/billing/summary+api.ts` (new)
- `app/api/billing/checkout-session+api.ts` (new)
- `app/api/billing/portal-session+api.ts` (new)
- `app/api/billing/_shared/**` (new)
- `Agent/Docs/API.md`
- `Agent/Docs/USER_FLOWS.md`

Add the initial route contract:
- `GET /api/billing/summary`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `POST /api/billing/webhook`

`checkout-session` must accept a normalized plan or billing interval selection from the app and map that input to server-owned Stripe price IDs. The client must not send raw secret billing configuration.

Expected client contract:

```ts
type BillingCheckoutResponse = {
  url: string;
  expiresAt: string | null;
};
```

Route behavior:
- `summary` returns a normalized `BillingSummary`.
- `checkout-session` creates a Stripe Checkout Session in `subscription` mode for the authenticated user.
- `portal-session` creates a Stripe Billing Portal session for the authenticated user.
- `webhook` verifies Stripe signatures and updates the normalized billing state source of truth.

### 3. Handle webhook-specific requirements explicitly
Files:
- `app/api/billing/webhook+api.ts` (new)
- `server/index.ts`
- `Agent/Docs/API.md`

The webhook route must preserve raw request body access for Stripe signature verification. The spec should require an implementation that avoids parsing the request body before calling Stripe's signature verifier and that treats duplicate event delivery as expected behavior.

If Expo Router `+api.ts` cannot preserve the raw request body safely for Stripe verification, the implementation must mount a dedicated Express raw-body route for `/api/billing/webhook` before `createRequestHandler()`. The chosen strategy must be covered by an integration-style test.

### 4. Add endpoint-specific safety controls
Files:
- `server/index.ts`
- `Agent/Docs/API.md`

Add explicit rate-limiting guidance:
- authenticated billing session routes should use stricter limits than generic API routes,
- the webhook route should not require auth headers but must require valid Stripe signatures,
- repeated delivery of the same webhook event must be idempotent.

### 5. Align the client with existing API patterns
Files:
- `client/lib/api/apiClient.ts`
- `client/features/billing/api.ts` (new)
- `client/features/billing/hooks/useBillingSummary.ts` (new)

The billing client layer should use the repo's typed API conventions. New client hooks should convert network results into loading / success / error states that the pricing and profile screens can consume without knowing route details. Session-creation helpers should also normalize recoverable problems such as `billing-disabled`, `billing-conflict`, and `configuration-missing`.

### 6. Add test coverage for route and auth behavior
Files:
- `app/api/billing/__tests__/**` (new)
- `client/features/billing/__tests__/**` (new)

Tests should cover:
- missing or invalid auth headers,
- checkout and portal route auth requirements,
- billing summary normalization,
- webhook signature rejection,
- raw-body verification using the chosen webhook strategy,
- duplicate webhook handling and idempotent processing.

## Acceptance Criteria
1. A reusable API auth helper exists for verifying Cognito bearer tokens on server routes.
2. `GET /api/billing/summary`, `POST /api/billing/checkout-session`, and `POST /api/billing/portal-session` require authenticated users.
3. `POST /api/billing/webhook` verifies Stripe signatures and handles duplicate delivery safely.
4. Billing routes return normalized responses that fit the repo's typed API usage patterns.
5. Automated tests cover auth failures, happy paths, and webhook-specific failure modes.
6. Billing session endpoints use server-owned plan mapping rather than trusting raw price IDs from the client.

## Constraints
- Preserve the Expo Router `+api.ts` route convention already used by the repo.
- Do not parse Stripe webhook bodies in a way that breaks signature verification.
- Keep billing routes self-contained; avoid coupling them to media route utilities beyond shared request helpers.
- Do not return raw Stripe SDK objects directly to the client.
- Do not assume Expo Router request parsing will be compatible with Stripe webhook verification without proving it in tests.

## Out of Scope
- Admin-only billing endpoints
- Manual refunds and dispute workflows
- Invoice PDF download routes
- Back-office reporting
- Multi-tenant billing administration

## Files Likely Affected
### Server
- `app/api/_shared/auth.ts` (new)
- `app/api/_shared/errors.ts` (new)
- `app/api/billing/**` (new)
- `server/index.ts`

### Client
- `client/features/billing/api.ts` (new)
- `client/features/billing/hooks/useBillingSummary.ts` (new)
- `client/lib/api/apiClient.ts`

### Docs
- `Agent/Docs/API.md`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/USER_FLOWS.md`

## Edge Cases
- The access token is expired or missing.
- Stripe customer creation succeeds but the client disconnects before receiving the session URL.
- A webhook arrives for a customer that cannot be mapped back to an app user.
- Stripe sends the same event more than once.
- A user opens the portal while their subscription is already canceled but still active until period end.
- The client submits an unknown plan identifier or interval.

## Risks
- Server auth verification is a new cross-cutting concern; if implemented poorly, it will be reused incorrectly in future routes.
- Webhook body handling is easy to get wrong, especially when middleware or helpers implicitly parse JSON.
