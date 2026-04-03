# Spec: Expand Test Coverage for UI Components and Hooks

**Status:** Ready
**Priority:** Low
**Scope:** Client

---

## What
Add unit tests for the most-used UI components and core hooks. Current coverage is ~5% (2/35 UI components, 3/9 hooks). This spec targets the highest-value additions: components with complex logic or platform-specific behavior, and hooks used across many consumers.

## Why
Night shift autonomous development has no safety net — regressions in core components propagate silently. The recent Progress.tsx and Tabs.tsx bugs (Reanimated flatten, text-in-View) would have been caught by basic render tests on web.

## Current State

### Existing tests (8 files):
- `client/components/ui/__tests__/Button.test.tsx`
- `client/components/ui/__tests__/TextInput.test.tsx`
- `client/hooks/__tests__/useToggle.test.ts`
- `client/hooks/__tests__/useClipboard.test.ts`
- `client/hooks/__tests__/useDebounce.test.ts`
- `client/lib/api/__tests__/apiProblem.test.ts`
- `client/lib/api/__tests__/retry.test.ts`
- `client/features/media/lib/imageCompression/__tests__/utils.test.ts`

### Test infrastructure:
- Jest 29 + `jest-expo` preset
- `@testing-library/react-native` available
- Setup file: `test/setup.ts`
- Coverage targets: `client/**` (excluding devtools, test files, index re-exports)
- Global timeout: 10000ms

## Changes

**Important:** Each phase is a valid stopping point. Phase 1 alone is a successful outcome. Do not skip phases or cherry-pick — complete each in order.

### Phase 1: Core hooks (2 test files)

#### 1a. useTheme tests
**File:** `client/hooks/__tests__/useTheme.test.tsx`
- Returns light/dark theme objects with expected color keys
- `getShadowStyle()` returns empty object on web, shadow props on native
- `getContrastingColor()` picks higher-contrast option
- `withAlpha()` produces valid rgba strings
- Contrast ratio cache doesn't exceed 500 entries

#### 1b. useStaggeredEntrance tests
**File:** `client/hooks/__tests__/useStaggeredEntrance.test.tsx`
- Returns delay values based on index
- Respects reduce motion preference

### Phase 2: High-value UI components (6 test files)

#### 2a. Tabs tests
**File:** `client/components/ui/__tests__/Tabs.test.tsx`
- Renders without crashing (web and native)
- String children wrapped in StyledText (no raw text in View)
- Active tab shows correct styling
- Variant prop switches between underline and pill

#### 2b. Progress tests
**File:** `client/components/ui/__tests__/Progress.test.tsx`
- Determinate mode renders with value
- Indeterminate mode renders without value
- Reanimated.View receives animated style (not flattened)
- Accessibility: `progressbar` role, `aria-valuenow`

#### 2c. InputOTP tests
**File:** `client/components/ui/__tests__/InputOTP.test.tsx`
- Renders correct number of cells for `length` prop
- Does NOT auto-focus by default
- Auto-focuses when `autoFocus={true}` is passed
- Error state renders error styling
- `onComplete` fires when all cells filled

#### 2d. Switch tests
**File:** `client/components/ui/__tests__/Switch.test.tsx`
- Renders in on/off states
- Calls `onCheckedChange` on press
- Disabled state prevents interaction

#### 2e. Checkbox tests
**File:** `client/components/ui/__tests__/Checkbox.test.tsx`
- Renders checked/unchecked states
- Calls `onCheckedChange` on press
- Accessibility role is "checkbox"

#### 2f. Select tests
**File:** `client/components/ui/__tests__/Select.test.tsx`
- Renders trigger with placeholder
- Shows selected value text

### Phase 3: Store tests (2 test files)

#### 3a. themeStore tests
**File:** `client/state/__tests__/themeStore.test.ts`
- Default theme is "system"
- `setTheme()` updates persisted preference
- Light/dark/system modes resolve correctly

#### 3b. globalUIStore tests
**File:** `client/state/__tests__/globalUIStore.test.ts`
- `show()` sets alert with `show: true` and provided type/messages
- `hide()` sets alert back to `null`
- Alert object shape matches `{ show, type, messages?, title?, duration?, loading?, position? }`

## Acceptance Criteria
1. All new test files pass with `jest --watchAll`
2. No mocking of AsyncStorage or localStorage beyond what `test/setup.ts` already provides
3. Each test file has at least 3 meaningful assertions
4. Tests run in under 10 seconds total (global timeout budget)
5. No snapshot tests — prefer explicit assertions
6. Tests follow existing patterns in `Button.test.tsx` and `TextInput.test.tsx`

## Constraints
- Use existing test infrastructure only — no new test dependencies
- Follow existing file naming pattern: `__tests__/*.test.{ts,tsx}`
- Do not add tests for components that are thin wrappers over @rn-primitives with no custom logic
- Do not mock Reanimated — use `jest-expo`'s built-in Reanimated mock

## Out of Scope
- E2E tests or integration tests
- Auth flow tests (requires Amplify mocking infrastructure)
- API client tests beyond what already exists
- Coverage threshold enforcement in CI
- Visual regression testing

## Files Likely Affected
**Client (new files):**
- `client/hooks/__tests__/useTheme.test.tsx`
- `client/hooks/__tests__/useStaggeredEntrance.test.tsx`
- `client/components/ui/__tests__/Tabs.test.tsx`
- `client/components/ui/__tests__/Progress.test.tsx`
- `client/components/ui/__tests__/InputOTP.test.tsx`
- `client/components/ui/__tests__/Switch.test.tsx`
- `client/components/ui/__tests__/Checkbox.test.tsx`
- `client/components/ui/__tests__/Select.test.tsx`
- `client/state/__tests__/themeStore.test.ts`
- `client/state/__tests__/globalUIStore.test.ts`

## Edge Cases
- **Reanimated mocks** — `jest-expo` preset includes Reanimated mocks; verify they work for `useAnimatedStyle` assertions
- **Platform-specific behavior** — `getShadowStyle` returns different values on web vs native; test both if possible via `Platform.OS` mock
- **Store persistence** — tests should clear store state between runs to avoid cross-test pollution

## Risks
- **Reanimated mock compatibility** — if `jest-expo`'s Reanimated mock doesn't support all APIs used, tests may need custom mocks. Mitigation: start with render-only tests, add animation assertions only where mocks work.
- **Test flakiness from timers** — InputOTP and Notification use `setTimeout`. Mitigation: use `jest.useFakeTimers()` and `jest.advanceTimersByTime()`.
