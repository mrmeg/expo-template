# Spec: Align Billing Docs With Session Routes

**Status:** Ready
**Priority:** Medium
**Scope:** Server + Client

---

## What
Remove stale billing route names and payload descriptions from Agent billing docs so they match the implemented `checkout-session` and `portal-session` routes. Keep the hosted-external billing model intact.

## Why
Billing is a high-risk reusable feature. Incorrect route names or request body examples can lead adopters to wire checkout incorrectly or bypass the server-owned plan catalog.

## Current State
`Agent/Docs/API.md` documents the implemented `/api/billing/checkout-session` and `/api/billing/portal-session` routes in one section, but later still mentions `/api/billing/checkout` and `/api/billing/portal`. `Agent/Docs/BILLING.md` default flow and server surface sections also describe `/api/billing/checkout` and `/api/billing/portal` with a raw `priceId` body, while `client/features/billing/api.ts` posts `{ planId, interval, returnPath }` to `/api/billing/checkout-session`.

## Changes
1. Normalize endpoint names across billing docs.
   - Use `/api/billing/checkout-session`.
   - Use `/api/billing/portal-session`.
   - Keep `/api/billing/summary` and `/api/billing/webhook` unchanged.

2. Normalize request payload docs.
   - Checkout body should use `{ planId, interval, returnPath }`.
   - State that clients do not send raw Stripe price IDs.
   - Portal body should remain `{ returnPath }`.

3. Update flow diagrams and edge cases.
   - Refresh web and native purchase flows.
   - Refresh unauthenticated-user and rate-limit references.
   - Keep webhook-authoritative language unchanged.

4. Check implementation references.
   - Confirm `client/features/billing/api.ts`, route tests, and `server/rateLimits.js` agree with docs.
   - Fix docs only unless implementation drift is discovered.

## Acceptance Criteria
1. No Agent billing doc references `/api/billing/checkout` or `/api/billing/portal` as implemented routes.
2. Billing docs consistently describe `planId` and `interval`, not raw `priceId`, for checkout.
3. Rate-limit docs reference the implemented session routes.
4. Return URL and webhook-authoritative contracts remain documented.
5. Documentation links and setup walkthrough remain accurate.

## Constraints
- Do not rename implemented routes unless a separate compatibility spec approves it.
- Do not weaken the server-owned price-id boundary.
- Do not add new billing modes.

## Out of Scope
- Implementing native IAP or PaymentSheet.
- Changing Stripe webhook handling.
- Changing billing UI behavior.

## Files Likely Affected
Docs:
- `Agent/Docs/BILLING.md`
- `Agent/Docs/API.md`
- `Agent/Docs/USER_FLOWS.md`
- `Agent/Docs/ARCHITECTURE.md` if outdated hook references are found

Reference implementation:
- `client/features/billing/api.ts`
- `app/api/billing/*+api.ts`
- `server/rateLimits.js`

## Edge Cases
- Setup walkthrough should still mention Stripe CLI forwarding to `/api/billing/webhook`.
- Any historical notes in changelog can remain historical if clearly past-tense.
- Route tests should not need updates unless docs uncover real implementation mismatch.

## Risks
Docs-only changes can hide implementation drift. Mitigate by checking route files and tests before editing.
