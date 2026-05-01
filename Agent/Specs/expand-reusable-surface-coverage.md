# Spec: Expand Reusable Surface Coverage

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Add focused regression coverage for the reusable UI, form, screen, and shell surfaces that template adopters are most likely to copy or extend. Also clean up noisy React `act(...)` warnings in existing tests so failures are easier to spot.

## Why
The template has many reusable components and screens, but only a subset has tests. Higher-value coverage around common surfaces reduces the risk of shipping broken foundations into new apps.

## Current State
`Agent/Docs/DESIGN.md` lists 35 UI components. `client/components/ui/__tests__` currently covers Button, Checkbox, InputOTP, Progress, Select, Switch, Tabs, and TextInput. Many heavily reused primitives and screen templates have no direct tests. `bun run test:ci` passes, but logs React `act(...)` warnings from auth and billing tests due to store resets outside `act`.

## Changes
1. Clean up noisy existing tests.
   - Wrap Zustand state resets that affect rendered hooks/components in `act`.
   - Silence expected route/webhook error logs only where tests intentionally exercise error paths.

2. Add coverage for high-use UI primitives.
   - Prioritize Card, Badge, Alert, EmptyState, Skeleton, Dialog, DropdownMenu, Tooltip, RadioGroup, Slider, Toggle, and ToggleGroup.
   - Keep tests behavior-oriented and resilient to styling refactors.

3. Add coverage for form primitives.
   - Test `FormProvider`, `FormTextInput`, `FormCheckbox`, `FormSwitch`, `FormSelect`, `FormMessage`, and `useFormField` behavior.

4. Add smoke coverage for reusable screens.
   - Test that screen templates render with representative props/defaults and do not crash under light/dark themes where practical.
   - Prioritize PricingScreen, SettingsScreen, ProfileScreen, ListScreen, ChatScreen, and FormScreen.

5. Update testing docs.
   - Document the coverage focus for reusable surfaces.
   - Keep coverage thresholds optional unless the implementation adds them intentionally.

## Acceptance Criteria
1. `bun run test:ci` passes without React `act(...)` warnings from known store-reset cleanup.
2. At least five additional high-use UI primitives gain focused tests.
3. Form primitives gain at least one test file or a small suite covering core integration.
4. At least three reusable screen templates gain smoke or behavior tests.
5. Tests avoid snapshot-only coverage and assert useful behavior.

## Constraints
- Do not test implementation details from `@rn-primitives`.
- Do not create brittle full-tree snapshots for large screens.
- Keep tests fast enough for CI.
- Mock native-only modules where needed instead of requiring simulators.

## Out of Scope
- End-to-end Playwright or Detox flows.
- Full visual regression testing.
- Enforcing global coverage thresholds.
- Testing every screen and component in a single pass.

## Files Likely Affected
Client tests:
- `client/components/ui/__tests__/*`
- `client/lib/form/__tests__/*`
- `client/screens/__tests__/*`
- `client/features/app/__tests__/AuthGate.test.tsx`
- `client/features/billing/__tests__/useBillingActions.test.tsx`

Docs:
- `Agent/Docs/PERFORMANCE.md`
- `CONTRIBUTING.md`

## Edge Cases
- Components that use portals need a provider wrapper.
- Components that use React Query need an isolated `QueryClient`.
- Screens that use router links should mock or wrap Expo Router correctly.
- Expected console errors should be scoped to individual tests and restored.

## Risks
Broad coverage work can become unfocused. Keep tests on surfaces with the highest reuse value and avoid chasing percentage coverage alone.
