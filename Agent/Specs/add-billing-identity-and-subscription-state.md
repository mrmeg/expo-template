# Spec: Add Billing Identity And Subscription State

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Introduce a billing domain model that maps authenticated Cognito users to Stripe customers and exposes a normalized subscription summary to the app. The template should define one billing identity contract and one app-facing billing summary shape before any checkout or portal UI is wired up.

## Why
The current template has authentication, but it has no durable billing model. Without a stable identity and status layer, the implementation will leak raw Stripe objects into the client, duplicate customer records, or hard-code plan strings in multiple screens.

## Current State
- `client/features/auth/stores/authStore.ts` exposes `userId`, `username`, and `email`, but no billing information.
- `app/(main)/(tabs)/profile.tsx` renders `Plan` as hard-coded `Free`, `Member Since` as `Jan 2024`, and `Status` as `Active`.
- There are no billing types under `shared/` or `client/features/`.
- The repository does not contain an application database layer, so there is no existing place to persist subscription snapshots or `stripe_customer_id`.

## Changes
### 1. Define shared billing types
Files:
- `shared/billing.ts` (new)
- `Agent/Docs/DOMAIN.md`
- `Agent/Docs/API.md`

Create a shared billing model that normalizes Stripe state for app use. The initial shape should include:

```ts
export type BillingStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface BillingSummary {
  customerId: string | null;
  planId: string;
  planLabel: string;
  status: BillingStatus;
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  sourceUpdatedAt: string;
}
```

### 2. Add a billing identity contract on the server
Files:
- `app/api/billing/_shared/account.ts` (new)
- `app/api/billing/_shared/types.ts` (new)
- `Agent/Docs/ARCHITECTURE.md`

Introduce a server-side contract that resolves or creates the Stripe customer for the authenticated app user. The contract must use Cognito `userId` as the canonical application identity and treat email as a convenience field, not the primary key.

The server-side abstraction should look roughly like:

```ts
interface BillingAccountResolver {
  resolveOrCreateCustomer(user: AuthenticatedUser): Promise<{ customerId: string }>;
  getBillingSummary(user: AuthenticatedUser): Promise<BillingSummary>;
}
```

Customer-linking rules must be explicit:
- first look up Stripe customers by `metadata.appUserId`,
- if no metadata match exists and exactly one customer matches the authenticated email, backfill `metadata.appUserId`,
- if multiple candidate customers exist, do not auto-link; return a deterministic conflict error and log it,
- do not create a new customer when an existing customer can be linked safely.

### 3. Choose the default persistence strategy for the template
Files:
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/ARCHITECTURE.md`

Because the template has no database abstraction today, the default implementation should use Stripe as the initial source of truth:
- Stripe customer metadata stores `appUserId`.
- Stripe price / product metadata or a server config map defines plan identifiers and features.
- The app receives normalized `BillingSummary` objects from the server.

This keeps the baseline template deployable without adding Prisma, Drizzle, Supabase, or another storage requirement. The interface must still be written so a real app can later swap in database-backed persistence without changing client contracts.

The spec must also define a canonical plan catalog boundary:
- shared plan identifiers live in code, not in UI strings,
- Stripe price IDs map into that plan catalog,
- UI code consumes normalized plan labels and feature lists from the server or shared types rather than rebuilding them ad hoc.

### 4. Add a client-side billing state boundary
Files:
- `client/features/billing/index.ts` (new)
- `client/features/billing/hooks/useBillingSummary.ts` (new)
- `client/features/billing/types.ts` (new)

Billing state should enter the client through one feature boundary, not through ad hoc additions to `authStore`. `authStore` remains responsible for authentication identity; the billing feature owns subscription state and server synchronization.

## Acceptance Criteria
1. Shared billing types exist and are documented for use by both server and client.
2. The server contract for resolving a user's Stripe customer is defined and keyed to Cognito `userId`.
3. The default template path does not require a separate application database in order to normalize billing state.
4. The client has a dedicated billing feature boundary for summary data instead of extending `authStore` with Stripe-specific fields.
5. Hard-coded billing labels such as `Free` are no longer treated as the canonical account state in the design.
6. Customer resolution rules are deterministic and avoid silent duplicate-customer creation.

## Constraints
- Do not make email the canonical billing identity.
- Do not expose raw Stripe SDK types directly to UI code.
- Keep the first implementation compatible with the repo's feature-isolation rules.
- Preserve a path for future database-backed implementations without changing the client-facing `BillingSummary` contract.
- Keep customer-linking behavior deterministic; no fuzzy matching beyond the documented fallback.

## Out of Scope
- Organization billing
- Seat counts and per-member entitlements
- Invoice history screens
- Tax IDs and business profile management
- Promotional credits and coupon accounting

## Files Likely Affected
### Server
- `app/api/billing/_shared/account.ts` (new)
- `app/api/billing/_shared/types.ts` (new)
- `app/api/billing/**`

### Client
- `client/features/billing/**` (new)
- `app/(main)/(tabs)/profile.tsx`
- `app/(main)/(demos)/screen-pricing.tsx`

### Docs
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/API.md`
- `Agent/Docs/DOMAIN.md`

## Edge Cases
- The user changes their Cognito email after a Stripe customer already exists.
- Stripe customer search returns multiple matches and metadata is missing on older records.
- A customer has canceled but remains active until period end.
- Webhook updates arrive before the client polls for its first billing summary.
- A user has never opened billing and should still receive a valid `free` summary.
- A subscription is `past_due` or `incomplete`, but the customer record already exists and must still resolve cleanly.

## Risks
- Customer duplication is the main operational risk; the resolver must define exact lookup and creation rules.
- If plan metadata is underspecified, the client will display unstable labels or features.
