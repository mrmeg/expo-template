# Spec: Core Test Coverage

**Status:** Draft
**Priority:** High
**Scope:** Client

---

## What

Add unit and integration tests for the most critical untested modules in the client layer: authStore (auth state machine), apiClient (HTTP requests, timeouts, error handling), useTheme (color contrast, theme toggling), form adapters (FormTextInput, FormCheckbox integration with react-hook-form), useScalePress, and useStaggeredEntrance. Current coverage is approximately 8% with these core modules entirely untested.

## Why

These modules are the foundation of the app. authStore controls the entire authentication lifecycle. apiClient handles every server communication. useTheme powers the design system and WCAG contrast compliance. Without tests, regressions in any of these modules would silently break the app. This spec establishes a baseline of confidence for the code that carries the most risk.

## Current State

- **Test infrastructure exists and works:** `jest.config.js` uses `jest-expo` preset, `test/setup.ts` has comprehensive mocks for Reanimated, gesture-handler, expo-router, AsyncStorage, i18next, etc.
- **6 test files exist:** `Button.test.tsx`, `TextInput.test.tsx`, `imageCompression/utils.test.ts`, `useToggle.test.ts`, `useClipboard.test.ts`, `useDebounce.test.ts`.
- **0 tests exist** for authStore, apiClient, apiProblem, useTheme, form adapters, useScalePress, or useStaggeredEntrance.
- `client/features/auth/stores/authStore.ts` -- Zustand store with `initialize()`, `signOut()`, `setUser()`, `reset()`, throttle guards, Hub listener setup via `initAuth()`.
- `client/lib/api/apiClient.ts` -- Singleton `Api` class with `request()`, `get()`, `post()`, `put()`, `patch()`, `delete()`. Uses `AbortController` for timeouts. Returns discriminated union `ApiResult<T>`.
- `client/lib/api/apiProblem.ts` -- `getApiProblem()` maps HTTP status codes to typed error kinds. `getApiProblemMessage()` returns human-readable strings.
- `client/hooks/useTheme.ts` -- Hook providing theme colors, `getShadowStyle()`, `getContrastingColor()` (cached), `getContrastRatio()`, `withAlpha()`, `getTextColorForBackground()`, `toggleTheme()`, `setTheme()`. Also exports `useStyles()` factory hook. Contains pure helper functions: `parseColor()`, `hexToRgb()`, `calculateLuminance()`, `calculateContrastRatio()`, `getBetterContrast()`, `getTextColorForBackground()`, `withAlpha()`.
- `client/lib/form/FormTextInput.tsx` -- Wires `useController` to `TextInput`, passes error/errorText from field state.
- `client/lib/form/FormCheckbox.tsx` -- Wires `useController` to `Checkbox`, maps field.value to checked.
- `client/hooks/useScalePress.ts` -- Returns animated style and press handlers. Uses Reanimated `useSharedValue`, `withSpring`, `withTiming`. Respects `useReducedMotion()`.
- `client/hooks/useStaggeredEntrance.ts` -- Returns animated style for entrance animations. Supports fade, fadeSlideUp, fadeSlideDown, scale types. Respects `useReducedMotion()`.

## Changes

### 1. authStore tests -- `client/features/auth/stores/__tests__/authStore.test.ts`

Test the Zustand store's state machine behavior by calling actions directly on the store instance.

**Happy paths:**
- Initial state is `{ state: "loading", user: null, error: null }`
- `setUser(user)` transitions state to `"authenticated"` and stores user data
- `setUser(null)` transitions state to `"unauthenticated"`
- `setState("authenticated")` updates state correctly
- `setPendingVerificationEmail("test@example.com")` stores the email
- `setError("some error")` stores the error string
- `reset()` returns store to `{ state: "unauthenticated", user: null, pendingVerificationEmail: null, error: null }`

**initialize() behavior:**
- Calls `getCurrentUser()` from aws-amplify/auth (mock it)
- When user exists: sets state to `"authenticated"` with user data
- When no user: sets state to `"unauthenticated"` with null user
- When getCurrentUser throws: sets state to `"unauthenticated"` (graceful degradation)

**Throttle and guard behavior:**
- Calling `initialize()` while `isInitializing === true` is a no-op (returns early)
- Calling `initialize()` within 2 seconds of last call is throttled (returns early)
- Calling `initialize()` after 2 seconds succeeds

**signOut() behavior:**
- Sets state to `"loading"`, then calls amplify `signOut()`, then sets state to `"unauthenticated"` with null user
- On signOut error: sets state to `"unauthenticated"` with error message

**Edge cases:**
- `reset()` clears `pendingVerificationEmail` and `error` along with user/state
- Multiple rapid `setUser` calls settle on the last value

### 2. apiClient tests -- `client/lib/api/__tests__/apiClient.test.ts`

Test the `Api` class by creating fresh instances (not the singleton) and mocking `global.fetch`.

**Happy paths:**
- `get("/users")` sends GET request to `baseUrl + /users` with correct headers
- `post("/users", { name: "Alice" })` sends POST with JSON body
- `put()`, `patch()`, `delete()` send correct HTTP methods
- Successful 200 response returns `{ kind: "ok", data: parsedJson }`
- 201 response returns `{ kind: "ok", data: parsedJson }`
- 204 response returns `{ kind: "ok", data: null }`

**Auth token handling:**
- No Authorization header when `authToken` is null
- `setAuthToken("token123")` adds `Authorization: Bearer token123` header
- `setAuthToken(null)` removes the header
- `getAuthToken()` returns current token

**Error handling (HTTP status codes):**
- 401 returns `{ kind: "unauthorized" }`
- 403 returns `{ kind: "forbidden" }`
- 404 returns `{ kind: "not-found" }`
- 408 returns `{ kind: "timeout", temporary: true }`
- 500/502/503/504 return `{ kind: "server", status }`
- Other 4xx returns `{ kind: "rejected", status }`
- Unparseable JSON body returns `{ kind: "bad-data" }`

**Timeout behavior:**
- Request that exceeds timeout returns `{ kind: "timeout", temporary: true }`
- Custom timeout option overrides default
- Timeout clears on successful response (no leaked timers)

**Network errors:**
- TypeError (network failure) returns `{ kind: "network-error", temporary: true }`
- Other errors return `{ kind: "unknown", temporary: true }`

**Configuration:**
- `setBaseUrl("https://other.api")` changes the URL prefix
- Custom headers merge with defaults

### 3. apiProblem tests -- `client/lib/api/__tests__/apiProblem.test.ts`

Test the pure functions `getApiProblem()` and `getApiProblemMessage()`.

**getApiProblem:**
- 200, 201, 204 return `null`
- 401 returns `{ kind: "unauthorized" }`
- 403, 404, 408, 500, 502, 503, 504 return correct kinds
- 422 (generic 4xx) returns `{ kind: "rejected", status: 422 }`
- 600 (unknown) returns `{ kind: "unknown", temporary: true }`

**getApiProblemMessage:**
- Each problem kind returns a non-empty human-readable string
- All messages are distinct

### 4. useTheme tests -- `client/hooks/__tests__/useTheme.test.ts`

Test the pure helper functions directly (they are module-scoped but testable). Test the hook via `renderHook` from `@testing-library/react-native`.

**Pure function tests (import from module or test via hook):**
- `parseColor("#FF0000")` returns `[255, 0, 0, 1]`
- `parseColor("#F00")` (shorthand hex) returns `[255, 0, 0, 1]`
- `parseColor("rgba(255, 0, 0, 0.5)")` returns `[255, 0, 0, 0.5]`
- `parseColor("rgb(255, 0, 0)")` returns `[255, 0, 0, 1]`
- `parseColor("invalid")` returns `null`
- `hexToRgb("#336699")` returns `[51, 102, 153]`
- `calculateLuminance(255, 255, 255)` is close to 1.0
- `calculateLuminance(0, 0, 0)` is close to 0.0
- `calculateContrastRatio(1.0, 0.0)` returns 21 (maximum contrast)
- `calculateContrastRatio(0.5, 0.5)` returns 1 (no contrast)

**Hook tests via renderHook:**
- Returns `theme`, `scheme`, `getShadowStyle`, `toggleTheme`, `setTheme`, `currentTheme`, `getContrastingColor`, `getTextColorForBackground`, `withAlpha`, `getContrastRatio`
- `scheme` defaults to `"light"` when system scheme is null
- `toggleTheme()` cycles light -> dark -> system -> light
- `getShadowStyle("base")` returns a valid ViewStyle with shadowColor on native
- `getShadowStyle("base")` returns empty object on web (mock Platform.OS)
- `getContrastingColor("#000000")` returns `"#FFFFFF"` (white has better contrast on black)
- `getContrastingColor("#FFFFFF")` returns `"#000000"` (black has better contrast on white)
- `getContrastingColor("#808080", "#FFFFFF", "#000000")` returns the one with higher contrast
- `getTextColorForBackground("#000000")` returns `"light"`
- `getTextColorForBackground("#FFFFFF")` returns `"dark"`
- `withAlpha("#336699", 0.5)` returns `"rgba(51, 102, 153, 0.5)"`
- `withAlpha("invalid", 0.5)` returns `"rgba(0, 0, 0, 0.5)"` (fallback)
- `getContrastRatio("#000000", "#FFFFFF")` returns approximately 21

**Contrast cache behavior:**
- Calling `getContrastingColor` twice with same args returns cached result
- Cache does not exceed 500 entries (test with many unique calls)

**useStyles hook:**
- Returns `styles` created by `StyleSheet.create` from the factory
- Passes `theme` and `spacing` to the factory function
- Returns all utilities from `useTheme` alongside styles

### 5. Form adapter tests -- `client/lib/form/__tests__/FormTextInput.test.tsx`

Test integration between react-hook-form controllers and UI components using `@testing-library/react-native`.

**FormTextInput:**
- Renders a TextInput and displays the placeholder
- Typing updates the form field value
- Displays error message when field validation fails (e.g., required field left empty, then trigger validation)
- `error` and `errorText` from field state override manual props
- `defaultValue` sets the initial input value
- `onBlur` marks the field as touched

**FormCheckbox tests -- `client/lib/form/__tests__/FormCheckbox.test.tsx`:**
- Renders unchecked initially when field value is falsy
- Pressing toggles the form field value to true
- Displays `FormMessage` when validation fails (e.g., required: true)
- `error` from field state is passed through to Checkbox component

For both: wrap with a test `FormProvider` / `useForm` and render within a small form to test integration.

### 6. useScalePress tests -- `client/hooks/__tests__/useScalePress.test.ts`

Test via `renderHook`.

- Returns `animatedStyle`, `pressHandlers`, and `scale`
- `pressHandlers` contains `onPressIn` and `onPressOut` functions
- Calling `onPressIn()` sets scale to `scaleTo` (default 0.97)
- Calling `onPressOut()` sets scale back to 1
- When `disabled: true`, `onPressIn` is a no-op (scale stays at 1)
- Custom `scaleTo: 0.9` uses that value on press
- When `haptic: false`, no haptic feedback is triggered (mock `hapticLight`)
- When `reduceMotion` is true, uses `withTiming` with `duration: 0` instead of `withSpring`

### 7. useStaggeredEntrance tests -- `client/hooks/__tests__/useStaggeredEntrance.test.ts`

Test via `renderHook`.

- Returns an animated style object
- Default type is `"fadeSlideUp"`
- With `reduceMotion: true`, initial opacity is 1 and translateY is 0 (no animation)
- `STAGGER_DELAY` export equals 30
- `type: "fade"` returns style with opacity only
- `type: "scale"` returns style with opacity and scale transform
- `type: "fadeSlideDown"` sets initial translateY to negative slideDistance
- Custom `delay`, `duration`, `slideDistance`, `initialScale` options are respected

## Acceptance Criteria

1. All Tier 1 test files exist and pass: `authStore.test.ts`, `apiClient.test.ts`, `apiProblem.test.ts`, `useTheme.test.ts`
2. All Tier 2 test files exist and pass: `FormTextInput.test.tsx`, `FormCheckbox.test.tsx`, `useScalePress.test.ts`, `useStaggeredEntrance.test.ts`
3. No existing tests break
4. All tests run in under 30 seconds total
5. Tests use proper mocking -- aws-amplify/auth is mocked (not called for real), global.fetch is mocked for apiClient tests, Platform.OS is mockable for web/native shadow tests
6. Each test file has at least: 3 happy path tests, 2 error/edge case tests
7. `npx expo lint` passes with no new warnings
8. Test coverage for the targeted files reaches at least 80% line coverage

## Constraints

- Do NOT modify any source code -- this spec is tests-only
- Do NOT add new dependencies -- use jest, @testing-library/react-native, and the existing mock infrastructure in test/setup.ts
- Mocks for aws-amplify/auth should be per-test (not global in setup.ts) to avoid polluting other tests
- The pure color functions in useTheme.ts are not exported -- test them through the hook's public API or extract and export them as a separate change (prefer testing through the hook)
- Form adapter tests need react-hook-form as a real dependency (it is already installed), not mocked

## Out of Scope

- Visual regression testing
- E2E / integration tests with real API calls
- Tests for screen templates (covered by a separate spec)
- Tests for authentication flow components (AuthScreen, SignInForm, etc.)
- Tests for media features (compression, upload, etc. -- already partially covered)
- Increasing coverage thresholds in jest.config.js (do that after this spec lands)

## Files Likely Affected

**Client (new test files only):**
- `client/features/auth/stores/__tests__/authStore.test.ts`
- `client/lib/api/__tests__/apiClient.test.ts`
- `client/lib/api/__tests__/apiProblem.test.ts`
- `client/hooks/__tests__/useTheme.test.ts`
- `client/lib/form/__tests__/FormTextInput.test.tsx`
- `client/lib/form/__tests__/FormCheckbox.test.tsx`
- `client/hooks/__tests__/useScalePress.test.ts`
- `client/hooks/__tests__/useStaggeredEntrance.test.ts`

## Edge Cases

- authStore `initialize()` called with no Amplify configuration -- should gracefully set unauthenticated
- apiClient request with empty string path -- should still build valid URL
- apiClient response with valid status but unparseable body (e.g., HTML error page) -- returns `{ kind: "bad-data" }`
- `getContrastingColor` with rgba color containing alpha -- should still compute luminance correctly
- `parseColor` with 8-digit hex (#RRGGBBAA) -- currently unsupported, returns null
- `withAlpha` with alpha values outside 0-1 -- should still produce a valid rgba string
- FormTextInput with `undefined` value from form -- should render empty string (the `?? ""` fallback)
- useScalePress `onPressIn` then immediate `onPressOut` without delay -- should not crash

## Risks

- **useTheme pure functions are not exported:** The `parseColor`, `hexToRgb`, `calculateLuminance`, `calculateContrastRatio`, `getBetterContrast` functions are module-private. Tests must exercise them through the hook's public API (`getContrastingColor`, `getContrastRatio`, `withAlpha`, `getTextColorForBackground`). If coverage is insufficient through the public API, consider a follow-up to extract color utilities into `client/lib/color.ts`.
- **Reanimated mocks are approximations:** The mock in `test/setup.ts` makes `useSharedValue` return `{ value: init }` and `withSpring`/`withTiming` return the target value immediately. This means animation tests verify intent (correct values passed) but not actual animation behavior.
- **authStore depends on dynamic imports:** `await import("aws-amplify/auth")` is used inside `initialize()` and `signOut()`. Jest can mock these with `jest.mock("aws-amplify/auth", ...)` but the async import pattern needs careful mock setup.
