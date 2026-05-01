# Spec: Define Feature Dependency Contracts

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Make feature portability honest by documenting and, where practical, formalizing allowed cross-feature dependencies. The goal is not to remove all coupling immediately, but to give adopters a reliable dependency map when copying auth, billing, app shell, onboarding, keyboard, or media features into another project.

## Why
The template promises self-contained feature folders. Current direct imports between features make copying one feature harder unless the dependency contract is explicit.

## Current State
`Agent/Docs/ARCHITECTURE.md` says features never import from other features except media to notifications. In practice, `client/features/app/useAppStartup.ts` imports onboarding and auth stores, `OnboardingGate.tsx` imports the onboarding flow and store, `AuthGate.tsx` imports auth internals, and billing hooks import `authStore`. These dependencies may be reasonable shell-level composition, but the docs currently describe a stricter rule than the code follows.

## Changes
1. Define dependency tiers.
   - Core shared layer: `shared`, `client/lib`, `client/hooks`, `client/constants`, `client/components/ui`.
   - Shell composition layer: `client/features/app` may orchestrate auth and onboarding.
   - Domain features: billing may depend on auth identity; media may depend on global notifications if retained.

2. Document each feature's required and optional dependencies.
   - Add a table in `Agent/Docs/ARCHITECTURE.md` or a new feature portability doc.
   - Include what must be copied with each feature and what can be replaced by an adapter.

3. Add adapter seams where low-cost.
   - Prefer exported helpers or small ports over deep imports from `stores/*` when used outside the owning feature.
   - Route external consumers through feature barrels where possible.

4. Add an enforcement check if practical.
   - A lightweight script can flag disallowed `client/features/<a>` to `client/features/<b>` imports.
   - Start in report mode if immediate enforcement would be noisy.

5. Update docs to remove false absolutes.
   - Replace "never cross-import" with the actual allowed dependency matrix.

## Acceptance Criteria
1. Architecture docs accurately describe existing allowed cross-feature imports.
2. Each reusable feature has a clear "copy with" dependency note.
3. New or existing imports that cross feature boundaries either use a documented adapter/barrel or are explicitly listed as allowed.
4. Optional enforcement exists or the spec implementation explains why it is deferred.
5. Typecheck and tests still pass.

## Constraints
- Do not do a broad feature refactor unless it is required to define the contract.
- Preserve app shell behavior.
- Do not break existing public feature exports.

## Out of Scope
- Fully packaging every feature as an npm workspace package.
- Removing Zustand stores.
- Replacing the app shell architecture.

## Files Likely Affected
Client:
- `client/features/app/*`
- `client/features/auth/index.ts`
- `client/features/billing/*`
- `client/features/media/*`

Docs:
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/DOMAIN.md`
- `Agent/Docs/APP_OVERVIEW.md`

Tooling:
- Optional dependency-check script under `scripts/`

## Edge Cases
- App shell may intentionally orchestrate features that should not depend on the shell in return.
- Billing should not need UI auth components, only identity/session access.
- Demo routes can import across features more freely if documented as composition code, not portable feature internals.

## Risks
Trying to make every feature perfectly isolated could create unnecessary abstractions. Keep the first pass focused on accurate contracts and low-cost seams.
