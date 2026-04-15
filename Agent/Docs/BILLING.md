# Billing Architecture

> The template's default subscription integration: Stripe Checkout + Billing
> Portal, hosted-external mode, webhook-authoritative server state.

## Scope and applicability

This document describes the **baseline billing architecture** that the
template ships with. Adopters whose product does not fit this default must
opt into a different billing mode rather than stretching the hosted flow
beyond what is specified here.

**Applies to:**
- Server-backed subscription products (SaaS, productivity tools, developer
  tools, B2B services).
- Products where the buyer is an authenticated account and purchases are
  consumed across web, iOS, and Android interchangeably.

**Does not apply to (out of scope for the baseline):**
- Apple App Store / Google Play **in-app purchase** digital-goods flows.
  Native digital-goods policy compliance is the adopter's responsibility —
  see "Mode selection" below.
- Native `PaymentSheet` / `CustomerSheet` card collection as the default
  purchase surface.
- Usage-based or metered billing, tax computation, invoices, team seats,
  organization billing.

Adopters shipping a **native app that sells digital goods consumed inside
that app** (e.g. unlocks, consumable credits, premium tiers) must confirm
Apple and Google store policies for their category before enabling the
hosted default on native builds.

## Mode selection

The template exposes a single, explicit billing mode:

| Mode | Description | Default? |
|------|-------------|----------|
| `hosted-external` | Stripe Checkout + Billing Portal in a web browser (native uses `expo-web-browser`). Webhook-driven server state. | **Yes** |
| `native-iap` | Apple / Google in-app purchase with store receipts. | No — not implemented in baseline. |
| `native-paymentsheet` | Stripe PaymentSheet for native card collection. | No — optional extension. |

If an adopter needs `native-iap` or `native-paymentsheet`, they must
introduce that as a separate mode — the template does not silently fall
back.

## Default flow (hosted-external)

### Purchase — Web

```
Pricing UI → tap "Subscribe"
  → POST /api/billing/checkout  (authenticatedFetch)
      body: { priceId, returnPath: "/billing/return" }
  → server resolves/creates Stripe customer keyed to Cognito sub
  → server creates Checkout Session (success_url + cancel_url below)
  → returns { url } to client
  → window.location = url
  → user completes payment on Stripe
  → Stripe redirects to https://app.example.com/billing/return?status=…
  → client refetches billing summary
  → Stripe webhook (authoritative) updates server-side subscription row
```

### Purchase — Native (iOS / Android)

```
Pricing UI → tap "Subscribe"
  → POST /api/billing/checkout  (authenticatedFetch)
      body: { priceId, returnPath: "/billing/return" }
  → server builds Checkout Session with native return URL
  → returns { url } to client
  → WebBrowser.openAuthSessionAsync(url, "myapp://billing/return")
  → user completes payment on Stripe in the system browser
  → Stripe redirects to myapp://billing/return?status=…
  → openAuthSessionAsync resolves with the return URL
  → client parses status, refetches billing summary
  → Stripe webhook (authoritative) updates server-side subscription row
```

### Manage (all platforms)

```
Account UI → "Manage subscription"
  → POST /api/billing/portal
      body: { returnPath: "/billing/return" }
  → server creates Billing Portal session
  → returns { url } to client
  → Web: window.location = url
  → Native: WebBrowser.openAuthSessionAsync(url, "myapp://billing/return")
  → on return, client refetches billing summary
```

## Return URL contract

The baseline uses a single return path so every hosted handoff (checkout
success, checkout cancel, portal return) funnels through the same client
screen. That screen's only job is to refetch the billing summary and
route the user back to where they were.

```ts
// conceptual
const returnPath = "/billing/return";
const nativeReturnUrl = "myapp://billing/return";
const webReturnUrl = "https://app.example.com/billing/return";
```

- **Scheme**: `app.json` declares `"scheme": "myapp"`. `expo-web-browser`
  is already in the dependency list, so no native config work is required
  to accept the return URL.
- **Query contract** on the return URL:
  - `status=success` — Checkout success redirect
  - `status=cancel` — Checkout cancel redirect
  - `status=portal` — Billing Portal return
  - (Additional keys, e.g. `session_id`, are optional and not required
    for client logic — the webhook is the source of truth.)
- **Web success_url / cancel_url** are absolute `https://` URLs pointing
  at the deployed web host.
- **Native success_url / cancel_url** are the `myapp://billing/return`
  custom-scheme URL so `openAuthSessionAsync` resolves cleanly.
- The client **does not** treat the return URL as proof of payment. It
  refetches the billing summary and trusts the server's webhook-populated
  state.

## Authoritative state model

### Server is the source of truth

- Stripe webhooks (`/api/billing/webhook`) are the **only** authoritative
  trigger for changing billing state on the server.
- Client-side "I just came back from Checkout" signals are UX hints, not
  state writes.
- The billing row is keyed to the **Cognito `sub`**, not email, so that a
  changed email address never loses its subscription.

### Normalized billing lifecycle

The client consumes a normalized summary, not raw Stripe objects.

| State | Meaning |
|-------|---------|
| `free` | No active paid subscription. Baseline for new users. |
| `trialing` | Inside a Stripe trial window. Entitled. |
| `active` | Paid subscription in good standing. Entitled. |
| `past_due` | Payment failed; Stripe is retrying. Entitled until grace expires (UI should warn). |
| `canceled` | Subscription ended. Not entitled. |
| `incomplete` | Initial payment pending or 3DS in progress. Not entitled until resolved. |

### Normalized summary shape

The canonical definition lives in `shared/billing.ts`:

```ts
export interface BillingSummary {
  customerId: string | null;
  planId: string;        // e.g. "free", "pro" — from the plan catalog
  planLabel: string;     // human-readable, safe to render
  status: BillingStatus;
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null; // ISO 8601
  cancelAtPeriodEnd: boolean;
  features: string[];
  sourceUpdatedAt: string;
}
```

- Raw Stripe SDK types never cross this boundary.
- `freeBillingSummary()` returns the canonical shape for users with no
  Stripe customer record.
- `normalizeStripeSubscription(sub, catalog)` is the single server-side
  function that folds a Stripe `Subscription` into `BillingSummary`.

### Identity contract (server)

`app/api/billing/_shared/account.ts` defines the
`BillingAccountResolver` interface and the default
`createStripeBillingAccountResolver` factory:

- `resolveOrCreateCustomer(user)` — metadata lookup → email backfill →
  conflict error → create. No fuzzy matching.
- `getBillingSummary(user)` — never auto-creates a customer.

The resolver depends on a small `StripeCustomersPort` interface so it
is unit-testable without a real Stripe client. A later spec wires a
real Stripe SDK implementation of that port.

### Entitlement rule

A user is **entitled** when `state` ∈ `{ trialing, active, past_due }`.
Every feature-gate check should call the shared entitlement helper
rather than inspecting `state` directly, so entitlement policy can
evolve in one place.

## Server surface (shape, not implementation)

All billing routes live under `app/api/billing/` and require a Cognito
session via `authenticatedFetch`, except for the webhook which is
unauthenticated and verified by Stripe signature.

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/billing/summary` | GET | Cognito | Return `BillingSummary` for the signed-in user |
| `/api/billing/checkout` | POST | Cognito | Create a Checkout Session, return `{ url }` |
| `/api/billing/portal` | POST | Cognito | Create a Billing Portal session, return `{ url }` |
| `/api/billing/webhook` | POST | Stripe signature | Receive Stripe events, update server state |

Rate-limit posture: `/api/billing/checkout` and `/api/billing/portal`
should be registered as strict-limited paths alongside the existing
`STRICT_LIMIT_PATHS` in `server/rateLimits.js` when the routes land.

## Client surface (shape, not implementation)

The billing feature must be a self-contained module under
`client/features/billing/` and follow feature-isolation rules (no
cross-feature imports except the documented shared-layer exceptions).

| Piece | Purpose |
|-------|---------|
| `features/billing/hooks/useBillingSummary` | React Query hook over `GET /api/billing/summary` |
| `features/billing/hooks/useCheckout` | Calls `POST /api/billing/checkout`, performs browser handoff |
| `features/billing/hooks/usePortal` | Calls `POST /api/billing/portal`, performs browser handoff |
| `features/billing/lib/entitlement.ts` | `isEntitled(summary)` helper |
| `app/billing/return.tsx` | Shared return screen — refetches summary, routes back |

The pricing demo (`app/(main)/(demos)/screen-pricing.tsx`) and the
profile/account UI should consume `useBillingSummary` and the
entitlement helper — they must not read Stripe fields directly.

## Edge cases

| Case | Handling |
|------|----------|
| Unauthenticated user taps "Subscribe" | Pricing CTAs live behind `AuthGate` (or route the user through sign-in before calling `/api/billing/checkout`). The server **must** reject `/api/billing/checkout` without a Cognito session. |
| Native process recreated during Checkout | `openAuthSessionAsync` may not resolve. On next app focus, the billing screen refetches the summary; webhook-driven state still converges. |
| Second device already has an active subscription | `useBillingSummary` reflects `active` on both devices — pricing UI must show "current plan" state, not a duplicate purchase CTA. |
| Browser closes before success/cancel redirect | No client state change. Next summary fetch (pull-to-refresh, app focus) picks up the webhook-driven state. |
| Adopter later adds native digital-goods billing | They add a new mode (`native-iap`), they do **not** repurpose the hosted flow on the offending platform. |
| Return fires before webhook processed | Client shows a neutral "processing" state until `useBillingSummary` reports the new state (short poll window acceptable; do not block UI indefinitely). |

## Risks and non-goals

- This architecture is the template **baseline**. It is not legal advice
  for any specific app-store category. Adopters are responsible for
  confirming that hosted external billing is permitted for their
  product on the platforms they ship to.
- Native PaymentSheet, IAP, usage-based billing, tax, seats, and
  invoices are **out of scope** for the baseline. Any of them can be
  added as a later extension without breaking this contract, provided
  they introduce a new mode rather than mutating `hosted-external`.
