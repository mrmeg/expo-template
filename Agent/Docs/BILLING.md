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
  → POST /api/billing/checkout-session  (authenticatedFetch)
      body: { planId, interval, returnPath: "/billing/return" }
  → server maps { planId, interval } onto the server-owned Stripe price id
      (catalog lives in app/api/billing/_shared/env.ts; clients never send raw priceIds)
  → server resolves/creates Stripe customer keyed to Cognito sub
  → server creates Checkout Session (success_url + cancel_url below)
  → returns { url, expiresAt } to client
  → window.location = url
  → user completes payment on Stripe
  → Stripe redirects to https://app.example.com/billing/return?status=…
  → client refetches billing summary
  → Stripe webhook (authoritative) updates server-side subscription row
```

### Purchase — Native (iOS / Android)

```
Pricing UI → tap "Subscribe"
  → POST /api/billing/checkout-session  (authenticatedFetch)
      body: { planId, interval, returnPath: "/billing/return" }
  → server builds Checkout Session with native return URL
  → returns { url, expiresAt } to client
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
  → POST /api/billing/portal-session
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
// conceptual — the literal "myapp" is the template default. Real apps
// set EXPO_PUBLIC_APP_SCHEME and the value flows through both Expo
// config and the runtime accessor in client/lib/identity.ts.
const returnPath = "/billing/return";
const nativeReturnUrl = `${getAppScheme()}://billing/return`; // e.g. "myapp://billing/return"
const webReturnUrl = "https://app.example.com/billing/return";
```

- **Scheme**: derived from `app.identity.ts` (default `"myapp"`, override
  via `EXPO_PUBLIC_APP_SCHEME`). The Expo `scheme` field in
  `app.config.ts` and the runtime `buildAppDeepLink()` in
  `client/lib/identity.ts` both read from the same module so there is
  one place to change. `expo-web-browser` is already in the dependency
  list, so no native config work is required to accept the return URL.
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

`server/api/billing/account.ts` defines the
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
| `/api/billing/checkout-session` | POST | Cognito | Body `{ planId, interval, returnPath }`. Resolves the server-owned price id, creates a Checkout Session, returns `{ url, expiresAt }`. Returns `400 unknown-plan` for ids not in the catalog and `422 configuration-missing` when the requested interval has no price id set. |
| `/api/billing/portal-session` | POST | Cognito | Body `{ returnPath }`. Creates a Billing Portal session, returns `{ url }`. |
| `/api/billing/webhook` | POST | Stripe signature | Receive Stripe events, update server state |

Rate-limit posture: `/api/billing/checkout-session` and
`/api/billing/portal-session` are registered in `STRICT_LIMIT_PATHS`
(10/min) in `server/rateLimits.js`. The webhook is intentionally not
rate-limited — Stripe retries can burst faster, and signature
verification already gates abuse.

## Client surface (shape, not implementation)

The billing feature must be a self-contained module under
`client/features/billing/` and follow feature-isolation rules (no
cross-feature imports except the documented shared-layer exceptions).

| Piece | Purpose |
|-------|---------|
| `features/billing/hooks/useBillingSummary` | React Query hook over `GET /api/billing/summary` |
| `features/billing/hooks/useBillingActions` | `startCheckout` / `startPortal` — calls the session endpoints and performs the browser handoff via an injectable `BrowserHandoff` (web → `window.location`, native → `expo-web-browser`) |
| `features/billing/lib/pricing.ts` | `derivePricingPlan()` + `derivePlanActionState()` — folds a `BillingSummary` + catalog into the shared `PricingScreen` view model (no raw Stripe fields) |
| `features/billing/api.ts` / `lib/problem.ts` | Thin fetch wrappers + the `BillingProblem` discriminated union |
| `app/billing/return.tsx` | Shared return screen — invalidates the billing summary query, routes the user back |

The pricing demo (`app/(main)/(demos)/screen-pricing.tsx`) and the
profile/account UI consume `useBillingSummary` + `useBillingActions` and
derive their view model through `derivePricingPlan`. They must not read
Stripe fields directly; pricing copy decisions live in
`derivePlanActionState` so future rules (e.g. promo-only plans) change
in one place.

## Edge cases

| Case | Handling |
|------|----------|
| Unauthenticated user taps "Subscribe" | Pricing CTAs live behind `AuthGate` (or route the user through sign-in before calling `/api/billing/checkout-session`). The server **must** reject `/api/billing/checkout-session` without a Cognito session. |
| Native process recreated during Checkout | `openAuthSessionAsync` may not resolve. On next app focus, the billing screen refetches the summary; webhook-driven state still converges. |
| Second device already has an active subscription | `useBillingSummary` reflects `active` on both devices — pricing UI must show "current plan" state, not a duplicate purchase CTA. |
| Browser closes before success/cancel redirect | No client state change. Next summary fetch (pull-to-refresh, app focus) picks up the webhook-driven state. |
| Adopter later adds native digital-goods billing | They add a new mode (`native-iap`), they do **not** repurpose the hosted flow on the offending platform. |
| Return fires before webhook processed | Client shows a neutral "processing" state until `useBillingSummary` reports the new state (short poll window acceptable; do not block UI indefinitely). |

## Local setup (fresh Stripe account)

The template ships with the routes, adapter, and bootstrap already
wired. Turning billing on is an env-var + dashboard-setup exercise, not
a code change.

### 1. Install the Stripe CLI

The CLI forwards live webhook events to your local server and prints a
signing secret the server uses to verify signatures.

```bash
brew install stripe/stripe-cli/stripe   # macOS
stripe login
```

### 2. Create test products and prices

In the Stripe Dashboard (Test mode), create a product for each paid
plan in the catalog (the default catalog in `shared/billing.ts` ships
with just `free`; add one entry — e.g. `pro` — and replace
`DEFAULT_PLAN_CATALOG` with your catalog). For each paid plan, create
two recurring prices: one monthly, one yearly. Copy the price IDs.

### 3. Populate `.env`

Copy `.env.example` to `.env` and fill in the billing section:

```bash
# Client — safe to ship
EXPO_PUBLIC_BILLING_ENABLED=true
EXPO_PUBLIC_APP_URL=http://localhost:8081

# Server — NEVER ship to the client
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # filled in by step 4 below
STRIPE_PRICE_ID_PRO_MONTH=price_...
STRIPE_PRICE_ID_PRO_YEAR=price_...
```

Only some price IDs configured? The server returns `422
configuration-missing` when a client requests an unconfigured
plan/interval — the rest of the catalog still works.

### 4. Forward webhooks to localhost

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

The CLI prints `Ready! Your webhook signing secret is whsec_...`. Copy
that into `STRIPE_WEBHOOK_SECRET` in `.env` and restart the server.

### 5. Start the app with env

```bash
npm run start-local   # dev server with dotenv
```

The first billing request triggers `ensureBillingBootstrapped()`, which
constructs the Stripe adapter and installs the real registry. Without
Stripe env vars the registry stays unset and every `/api/billing/*`
route returns a typed `503 billing-disabled` — safe for projects that
haven't enabled billing yet.

### 6. Exercise the flow

- `GET /api/billing/summary` with a Cognito bearer — returns the
  normalized `BillingSummary`.
- `POST /api/billing/checkout-session` — returns a Stripe Checkout URL
  opened via `window.location` (web) or
  `WebBrowser.openAuthSessionAsync` (native).
- Complete payment with a [Stripe test
  card](https://docs.stripe.com/testing#cards).
- `POST /api/billing/portal-session` — returns a Billing Portal URL for
  plan changes / cancellation / invoice history.

### Disabling billing cleanly

Projects that do not need billing should leave the env vars empty and
set `EXPO_PUBLIC_BILLING_ENABLED=false`. The UI hides purchase CTAs,
the server returns `503 billing-disabled` on every billing route, and
no Stripe traffic is ever generated. The template is meant to be
usable out of the box without a Stripe account.

## Environment variables

| Variable | Surface | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_BILLING_ENABLED` | Client | Boolean feature flag. `false` (default) hides billing UI and skips bootstrap wiring. |
| `EXPO_PUBLIC_APP_URL` | Client | Absolute web origin used to build return URLs when the request doesn't carry one. Empty falls back to the request origin. |
| `STRIPE_SECRET_KEY` | Server only | Stripe server SDK key. Required to bootstrap the real registry. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Stripe signature verification secret. Required — webhook rejects requests when absent. |
| `STRIPE_PRICE_ID_<PLAN>_MONTH` | Server only | Monthly price for the plan whose id matches `<plan>` in the catalog. |
| `STRIPE_PRICE_ID_<PLAN>_YEAR` | Server only | Yearly price for the plan whose id matches `<plan>` in the catalog. |

Plan metadata (label, features) lives in code (`DEFAULT_PLAN_CATALOG`
in `shared/billing.ts`), not env vars — human-readable names are
reviewed in PRs, not by eyeballing `.env`.

## Risks and non-goals

- This architecture is the template **baseline**. It is not legal advice
  for any specific app-store category. Adopters are responsible for
  confirming that hosted external billing is permitted for their
  product on the platforms they ship to.
- Native PaymentSheet, IAP, usage-based billing, tax, seats, and
  invoices are **out of scope** for the baseline. Any of them can be
  added as a later extension without breaking this contract, provided
  they introduce a new mode rather than mutating `hosted-external`.
