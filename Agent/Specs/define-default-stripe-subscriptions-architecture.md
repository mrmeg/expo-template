# Spec: Define Default Stripe Subscriptions Architecture

**Status:** Ready
**Priority:** High
**Scope:** Server + Client

---

## What
Define the default Stripe subscription architecture for this template so billing works consistently on web, iOS, and Android without forcing every adopter to invent the flow from scratch. The baseline integration should use Stripe Checkout for subscription purchase and Stripe Billing Portal for subscription management, with browser handoff on native and webhook-driven billing state on the server for products where hosted external billing is an allowed default.

## Why
The template currently targets three platforms, but it has no billing architecture decision. Without a documented default, any future Stripe work risks mixing incompatible approaches such as hosted checkout, native PaymentSheet, and store-specific digital goods handling.

## Current State
- The app is positioned as a universal Expo template for iOS, Android, and web in `Agent/Docs/APP_OVERVIEW.md` and `Agent/Docs/ARCHITECTURE.md`.
- `app.json` already defines a custom scheme (`myapp`) and includes `expo-web-browser`, which is enough to support browser-based checkout and return flows.
- There is no billing-specific documentation in `Agent/Docs/`.
- The pricing screen at `app/(main)/(demos)/screen-pricing.tsx` is a demo only and does not express a real purchase path.
- The profile screen at `app/(main)/(tabs)/profile.tsx` hard-codes plan information, so there is no current source of truth for subscription state.

## Changes
### 1. Establish the baseline billing path
Files:
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/API.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/USER_FLOWS.md`

Document the default subscription flow as:
- Web: authenticated user requests a Checkout Session and is redirected to Stripe Checkout.
- Native: authenticated user requests a Checkout Session, opens the URL with `expo-web-browser`, and returns through the app scheme.
- All platforms: authenticated user opens Stripe Billing Portal from the app for manage / cancel / update-card flows.
- Server: Stripe webhooks are the authoritative trigger for billing state changes.
- The baseline applies to server-backed subscriptions and service-style products. Apps that later need store-managed digital-goods billing must opt into a different billing mode instead of stretching the hosted flow beyond this spec.

### 2. Define the canonical billing lifecycle
Files:
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/DOMAIN.md`

Document a normalized lifecycle for the template:
- `free`
- `trialing`
- `active`
- `past_due`
- `canceled`
- `incomplete`

Define that the app consumes a normalized billing summary rather than raw Stripe objects. The summary should be keyed to Cognito identity, not email alone.

### 3. Explicitly choose hosted billing over native-first collection for the default
Files:
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/APP_OVERVIEW.md`

State that the template's default subscription integration is hosted Stripe billing, not native card collection. Native PaymentSheet, platform-specific in-app purchase flows, and digital-goods policy handling remain optional follow-up work rather than part of the baseline template promise.

### 4. Define return URL and handoff conventions
Files:
- `Agent/Docs/BILLING.md` (new)
- `app.json`

Document a single return contract for hosted billing, for example:

```ts
const returnPath = "/billing/return";
const nativeReturnUrl = "myapp://billing/return";
const webReturnUrl = "https://app.example.com/billing/return";
```

The implementation must standardize success, cancel, and portal return behavior so client hooks can refetch billing state predictably after the browser closes.

### 5. Define explicit applicability guardrails
Files:
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/APP_OVERVIEW.md`

Document that the template's default billing mode is `hosted-external`. The docs must explicitly tell adopters to confirm their product category and platform policy requirements before enabling hosted subscriptions in a shipped native app.

## Acceptance Criteria
1. A billing architecture doc exists and names Stripe Checkout plus Billing Portal as the default template integration.
2. The system docs describe one canonical cross-platform billing flow instead of leaving the purchase path implicit.
3. The docs define normalized billing states and name the server webhook flow as the source of truth.
4. The docs explicitly state that native PaymentSheet and store-specific digital-goods handling are out of scope for the baseline template.
5. The return URL conventions needed for web and native browser handoff are documented.
6. The docs explicitly state when the hosted default applies and that other product categories may require a different billing mode.

## Constraints
- Keep the baseline compatible with the existing Expo Router and API route structure.
- Do not require a project-specific database choice in order to define the architecture.
- Preserve feature isolation; billing should be introduced as a self-contained feature/module, not by spreading Stripe logic through unrelated code.
- Do not advertise a billing path that depends on undeclared App Store or Play Store entitlements.
- Do not imply that hosted Stripe subscriptions are the correct solution for every native digital-goods use case.

## Out of Scope
- Native PaymentSheet or CustomerSheet as the default template flow
- Apple / Google in-app purchase implementations
- Usage-based or metered billing
- Team plans, seat management, and organization billing
- Tax configuration, invoices, and accounting exports

## Files Likely Affected
### Server
- `app/api/**` billing routes
- `server/index.ts`

### Client
- `app.json`
- `app/_layout.tsx`
- `client/features/billing/**`
- `app/(main)/(demos)/screen-pricing.tsx`

### Docs
- `Agent/Docs/BILLING.md` (new)
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/API.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/USER_FLOWS.md`
- `Agent/Docs/DOMAIN.md`

## Edge Cases
- An unauthenticated user taps an upgrade CTA.
- A user returns from Checkout on native but the app process was backgrounded or recreated.
- A user already has an active subscription when opening the pricing screen on a second device.
- The billing browser closes before the success or cancel redirect completes.
- A project wants digital in-app subscriptions later; the baseline must not block that extension.
- The browser return succeeds but the billing webhook has not been processed yet.

## Risks
- Hosted billing is the most pragmatic default, but policy-sensitive mobile billing rules can change over time; the docs must present this as the template baseline, not universal legal advice.
- If the return-flow contract is underspecified, the later implementation will produce stale account state or confusing post-checkout UX.
