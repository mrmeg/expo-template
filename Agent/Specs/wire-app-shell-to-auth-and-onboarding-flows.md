# Spec: Wire App Shell to Auth and Onboarding Flows

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What
Move onboarding and auth bootstrap from demo-only screens into the real app shell, and define an explicit route policy for first-run, authenticated, unauthenticated, and auth-disabled states. The root experience should initialize onboarding and auth once, render a consistent startup gate, and update the system docs so the runtime behavior matches the documented user flows.

## Why
The current docs describe onboarding and auth initialization as part of normal app entry, but `app/_layout.tsx` goes straight to `(main)` after fonts and i18n load. Onboarding state is persisted but never consulted outside the demo route, and the auth listener is only initialized when the auth demo mounts, which leaves account surfaces and future billing work built on an undefined shell contract.

## Current State
- `Agent/Docs/USER_FLOWS.md` says app entry should initialize auth, check onboarding completion, and show onboarding before the main tabs on first launch.
- `app/_layout.tsx` only waits for fonts and i18n readiness, then renders the main stack.
- `client/features/onboarding/onboardingStore.ts` persists `hasSeenOnboarding`, but the only real consumer is `app/(main)/(demos)/onboarding.tsx`.
- `client/features/auth/components/AuthWrapper.tsx` performs auth bootstrap through `checkAuthState()`, but it is only used by `app/(main)/(demos)/auth-demo.tsx`.
- `app/(main)/(tabs)/profile.tsx` and `app/(main)/(tabs)/settings.tsx` render account-related UI without a shared app-level auth gate or startup bootstrap.
- `client/features/auth/config.ts` intentionally warns and no-ops in development when auth env vars are missing, so any shell integration must not brick the template when auth is unconfigured.

## Changes
### 1. Introduce a root startup gate
Files:
- `app/_layout.tsx`
- `client/features/onboarding/onboardingStore.ts`
- `client/features/auth/stores/authStore.ts`
- `client/features/auth/hooks/useAuth.ts`
- `client/features/app/**` or equivalent new shell helpers

Create a root startup gate that waits for:
- fonts/resources
- i18n initialization
- onboarding state load
- auth bootstrap registration and initial auth-state resolution

The startup gate should own the initial loading state so the app does not flash directly into tabs before onboarding or auth decisions are known.

### 2. Make onboarding part of the real app entry path
Files:
- `app/_layout.tsx`
- `app/(main)/(demos)/onboarding.tsx` or a promoted shared onboarding route/component
- `client/features/onboarding/**`

Honor `hasSeenOnboarding` at real startup instead of only on the demo screen. On first launch, the user should see onboarding before the main shell; on later launches, onboarding should be skipped automatically unless storage is reset.

### 3. Promote auth bootstrap to an app-level concern
Files:
- `app/_layout.tsx`
- `client/features/auth/stores/authStore.ts`
- `client/features/auth/components/AuthWrapper.tsx`
- `app/(main)/(tabs)/profile.tsx`
- `app/(main)/(tabs)/settings.tsx`
- `app/(main)/(tabs)/media.tsx`

Register the Amplify Hub listener once during app startup and define which app surfaces are public versus protected. The template should remain explorable when auth is not configured in development, but routes and actions that genuinely depend on identity should use a shared auth policy instead of ad hoc checks or demo-only wrappers.

A valid end-state may resemble:

```tsx
if (!startupReady) return <SplashGate />;
if (!hasSeenOnboarding) return <OnboardingEntry />;
if (routeRequiresAuth && authEnabled && authState !== "authenticated") {
  return <AuthEntry />;
}
return <AppStack />;
```

**Defined terms for this spec — do not reinterpret:**
- `authEnabled` = both `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_USER_POOL_CLIENT_ID` are present at runtime. This must mirror the predicate already used in `client/features/auth/config.ts` so there is one source of truth. When `authEnabled` is false, the template is fully explorable and `routeRequiresAuth` evaluates to false everywhere.
- `routeRequiresAuth` — default policy for this spec:
  - **Require auth:** `app/(main)/(tabs)/profile.tsx`, `app/(main)/(tabs)/settings.tsx`
  - **Public (no auth gate):** `app/(main)/(tabs)/index.tsx`, `app/(main)/(tabs)/media.tsx`, the entire `app/(main)/showcase/**`, and all `app/(main)/(demos)/**` screens (including `auth-demo.tsx` so it remains demoable without a live session)
  - If the implementation disagrees with this split, it must document the reasoning in `USER_FLOWS.md` in the same PR.
- **Post-sign-in redirect target:** the route the user originally attempted when the auth gate intercepted them, otherwise `(main)/(tabs)/` (index tab). A simple stored-redirect pattern is acceptable; deep-link preservation across a native cold-start is not required by this spec.
- **Post-sign-out behavior:** after signing out from a protected surface, route back to `(main)/(tabs)/` (index tab). Do not force-push the `AuthScreen`; the user is unauthenticated but can still browse public surfaces.
- **Onboarding route placement:** promote onboarding out of `(main)/(demos)/onboarding.tsx` into a shell-owned entry (either rendered inline from `_layout.tsx` above the stack, or as a new route such as `app/onboarding.tsx` at the root). Either approach is acceptable as long as the `(demos)/onboarding.tsx` demo continues to work for showcase purposes.

### 4. Define consistent sign-in and sign-out navigation
Files:
- `client/features/auth/components/AuthScreen.tsx`
- `client/features/auth/components/AuthWrapper.tsx`
- protected route entry points in `app/**`

Sign-in, verification, sign-out, and auth-failure flows must route through the real shell contract rather than only inside the auth demo. The implementation should decide and document where users land after sign-in, and what happens when they sign out from a protected surface.

### 5. Update system docs to reflect the chosen shell contract
Files:
- `Agent/Docs/USER_FLOWS.md`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/DOMAIN.md`

Update the docs so they describe the actual startup policy, protected-route behavior, onboarding flow, and auth-disabled development behavior. The docs should stop describing onboarding and auth as demo-only accidents, and they should stop promising behaviors the shell does not implement.

## Acceptance Criteria
1. First launch in a clean install shows onboarding before entering the main shell.
2. Completing onboarding persists state and skips onboarding on the next launch.
3. Auth bootstrap runs once at app startup rather than only inside the auth demo.
4. Protected surfaces follow a shared auth policy instead of relying on the demo route for auth initialization.
5. Development mode remains usable when auth env vars are missing; the template must not dead-end on an unusable auth screen.
6. The system docs accurately describe the implemented onboarding and auth shell behavior.

## Constraints
- Do not make auth configuration mandatory just to browse the template in development.
- Avoid duplicate auth initialization and listener registration.
- Preserve Expo Router structure and typed-route ergonomics.
- Keep the change focused on shell integration; do not mix in server-side authorization or billing state.
- Maintain access to the showcase and other demo content unless the final route policy explicitly documents otherwise.

## Out of Scope
- Server-side authorization for API routes
- Social login implementation details
- Account deletion or profile backend persistence
- Billing route integration
- Full redesign of auth or onboarding UI visuals

## Files Likely Affected
### Client
- `app/_layout.tsx`
- `app/(main)/**`
- `client/features/auth/**`
- `client/features/onboarding/**`
- `client/components/**` or new shell gate components

### Docs
- `Agent/Docs/USER_FLOWS.md`
- `Agent/Docs/ARCHITECTURE.md`
- `Agent/Docs/APP_OVERVIEW.md`
- `Agent/Docs/DOMAIN.md`

## Edge Cases
- Auth env vars are missing in development and the app still needs to render a usable template shell.
- A user deep-links directly into a protected route while unauthenticated.
- Startup auth resolution is still loading when onboarding has already been completed.
- A user signs out while viewing a protected tab or modal.
- Onboarding storage is corrupt or unavailable and the app must choose a safe fallback.
- Cognito configuration is present but unreachable (network failure, outage). The startup gate must not hang indefinitely. Treat a bounded resolution failure (`getCurrentUser` rejects) as `unauthenticated` — the existing `authStore.initialize` already does this — and let the user retry via sign-in.
- `client/features/app/**` does not exist today. If new shell helpers are introduced, place them under a new `client/features/app/` folder (or reuse an existing shared layer folder under `client/`). Do not scatter startup logic across unrelated feature folders.

## Risks
- Poorly ordered startup checks can cause route flicker or auth/onboarding loops. The mitigation is to centralize bootstrapping in a single gate with explicit ready flags instead of scattering initialization across screens.
