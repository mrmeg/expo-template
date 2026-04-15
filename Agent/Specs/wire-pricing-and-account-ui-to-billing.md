# Spec: Wire Pricing And Account UI To Billing

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Turn the existing pricing and account-plan UI from static demos into billing-aware product surfaces. The app should show real plan state, offer an authenticated upgrade path, and expose a manage-subscription action once the billing API foundation exists.

## Why
The template already ships a polished pricing screen and account card, but both are misleading as soon as billing becomes a real feature. Users need clear, stateful billing UX that reflects their actual plan and status instead of static labels or alert dialogs.

## Current State
- `client/screens/PricingScreen.tsx` is a reusable visual component, but its plan model only supports hard-coded labels and a generic `onSelect` callback.
- `app/(main)/(demos)/screen-pricing.tsx` builds monthly and yearly plans from hard-coded strings and shows `Alert` dialogs rather than initiating billing.
- `app/(main)/(tabs)/profile.tsx` hard-codes `Plan: Free` and `Status: Active`, and it has no manage-subscription action.
- No client billing feature exists yet to fetch current subscription state or available plan metadata.

## Changes
### 1. Extend the pricing view model
Files:
- `client/screens/PricingScreen.tsx`
- `client/features/billing/types.ts` (new)

Add stable billing-aware fields to the plan model, for example:
- `planId`
- `priceId`
- `isCurrent`
- `actionLabel`
- `actionState` (`upgrade`, `manage`, `downgrade-disabled`, `current`)
- `disabledReason`

The screen component should remain reusable and visual, but its inputs should be capable of representing real billing state.

### 2. Add billing hooks for pricing and account screens
Files:
- `client/features/billing/hooks/useBillingSummary.ts` (new)
- `client/features/billing/hooks/useBillingActions.ts` (new)
- `client/features/billing/index.ts` (new)

Create hooks that:
- fetch current billing summary,
- map server-provided plans and summary into `PricingScreen` props,
- create checkout and portal sessions through the billing API,
- refetch billing state after returning from hosted billing.

The hooks must define how they recover from stale post-checkout state:
- refetch immediately on return,
- allow a short follow-up retry window for webhook lag,
- surface a non-destructive pending state instead of reverting to incorrect static plan labels.

### 3. Replace demo CTAs with real billing actions
Files:
- `app/(main)/(demos)/screen-pricing.tsx`
- `client/components/ui/Notification.tsx` usage

Replace alert-based `onSelect` handlers with actions that:
- guard unauthenticated users,
- route unauthenticated users into the existing auth flow instead of failing silently,
- show loading state while creating sessions,
- open hosted billing URLs,
- surface cancel / failure / success feedback,
- refetch account state when the user returns from browser handoff.

### 4. Update profile or settings account surfaces
Files:
- `app/(main)/(tabs)/profile.tsx`
- `app/(main)/(tabs)/settings.tsx`

Update the account area so it renders live billing data:
- current plan name,
- normalized status,
- renewal or end date when available,
- `Manage Subscription` action when the user has a Stripe customer,
- `Upgrade` action when the user is on the free tier.

The UI spec must explicitly cover non-happy-path account states such as:
- `trialing`
- `past_due`
- `cancel_at_period_end`
- billing disabled for the environment

### 5. Preserve the documented visual system
Files:
- `Agent/Docs/DESIGN.md`
- relevant client screens

The billing UI should continue to use the existing design system conventions:
- neutral primary actions,
- teal accent highlights,
- border-first cards,
- current `PricingScreen` layout and typography patterns where possible.

## Acceptance Criteria
1. The pricing screen can represent real current-plan, upgrade, and manage states without relying on hard-coded alert dialogs.
2. The account screen no longer hard-codes `Free` and `Active` as billing values.
3. Billing CTAs are auth-aware and show sensible loading and error feedback.
4. Returning from hosted billing triggers billing-state refresh so the UI reflects the new plan without manual reload.
5. The implementation reuses the existing pricing screen and design primitives rather than replacing them with a separate billing-only screen by default.
6. The account UI has explicit rendering rules for `trialing`, `past_due`, and `cancelAtPeriodEnd`.

## Constraints
- Keep UI state derived from billing hooks, not from direct Stripe SDK usage in screens.
- Preserve the existing design tokens and component conventions in `Agent/Docs/DESIGN.md`.
- Keep the pricing component generic enough to remain useful as a template screen.
- Do not hard-code plan labels or prices in multiple screens once billing metadata exists.
- Keep the pricing demo usable as an example route, but make it a real billing-backed example when billing is enabled.

## Out of Scope
- Coupon entry fields
- Seat selectors or enterprise quote workflows
- Invoice history UI
- Complex experiment or paywall frameworks
- Region-specific billing copy variations

## Files Likely Affected
### Server
- none directly, beyond consuming the billing API contract from other specs

### Client
- `client/screens/PricingScreen.tsx`
- `app/(main)/(demos)/screen-pricing.tsx`
- `app/(main)/(tabs)/profile.tsx`
- `app/(main)/(tabs)/settings.tsx`
- `client/features/billing/**` (new)

### Docs
- `Agent/Docs/DESIGN.md`
- `Agent/Docs/USER_FLOWS.md`

## Edge Cases
- The user is not signed in when opening the pricing screen.
- The current plan is already selected and should not offer an upgrade CTA.
- Stripe portal creation succeeds but the browser closes before the return navigation completes.
- Billing is disabled for the environment and the UI should degrade gracefully.
- The client refetches before the webhook has updated the user's latest billing summary.
- The app returns from browser handoff to a billing return route while the pricing screen is no longer mounted.

## Risks
- If the UI is not explicit about status transitions such as `trialing` or `past_due`, the account screen will remain misleading even after billing is functional.
- Browser handoff can create transient stale-state windows; hooks need a clear refetch strategy.
