---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# `TextInput` ignores the Android mount blur that arrives before any focus

## Goal

A consumer's `onBlur` fires only after the field has actually been focused. Today on Android the native field reports a blur as soon as it mounts, the package forwards it, and any form that validates on blur shows "required" errors before the user touches anything. The fix is a guard in the package so consumers stop reimplementing it.

## Context

Verified on `dev` at 3f72dc4 (`@mrmeg/expo-ui` 0.27.0 source, unpublished).

- Native path: `packages/ui/src/components/TextInput.tsx` `NativeTextInput` (`:512+`). `handleFocus` (`:633-651`) sets `isFocusedRef.current = true`, registers the field for tap-away dismissal and calls the parent's `onFocus`. `handleBlur` (`:653-661`) sets `isFocusedRef.current = false`, clears the registry and calls the parent's `onBlur` unconditionally (after the iOS-only outgoing-flavour check at `:655`). The native field is rendered once on Android with `onFocus={() => handleFocus(secure)}` / `onBlur={() => handleBlur(secure)}` (`:897-902`).
- Source of the event: Compose's `onFocusChanged` modifier reports its initial state (`isFocused = false`) when the field is first composed. The package-owned Android field forwards every report verbatim — `nativeTextField.android.tsx:239-246` `handleFocusChanged` calls `onBlur` whenever `focused` is `false`. `@expo/ui`'s universal field behaves the same way, which is how tractor observed it. iOS (SwiftUI `TextField`/`SecureField`) fires no mount blur; the web path (`:253-330`, RN `TextInput`) does not either.
- Confirmed downstream tonight: tractor-tools-direct PR #28 added `client/features/auth/hooks/useTouchedFields.ts` and gated blur validation in `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm` on "has this field ever reported focus". Its reviewer asked for the guard upstream in the package's `handleBlur`. The template's own `client/features/auth/components/AuthTextField.tsx:115-117` and `app/(main)/(demos)/form-demo.tsx` also wire `onBlur`.
- Existing coverage: `__tests__/TextInput.android.test.tsx` mocks `@expo/ui` with a lifecycle model (`lifecycle.inputs[n].props.onFocus/onBlur` are the callbacks the package passed to the native field, `:29-113`), flips `Platform.OS = "android"` per test (`:135-147`). `__tests__/TextInput.test.tsx:92-100` ("calls onBlur when blurred", iOS default platform) fires `blur` without a prior `focus` and expects `onBlur` to be called — that iOS pass-through stays as is.

**Decision (night mode).** Gate on the existing `isFocusedRef` rather than a separate sticky `hasFocused` latch: on Android `isFocusedRef` is true exactly between a forwarded focus and its blur, so it also drops a duplicate blur after a real one and a repeat mount blur if the native field is ever recomposed. Android only, per the observed platforms and the existing iOS test; the iOS handoff code (`:673-696`) already calls the parent's `onBlur` directly in its own fallback path and is not touched. The registry clear stays outside the guard (idempotent).

## Work

1. `packages/ui/src/components/TextInput.tsx` `handleBlur` (`:653-661`):
   ```ts
   const handleBlur = useCallback(
     (secure: boolean) => {
       if (Platform.OS === "ios" && secure !== activeSecureRef.current) return;
       // Compose reports `isFocused=false` when the field is first composed and
       // the Android field forwards it as a blur. A blur the field never
       // preceded with a focus is not a user leaving the field: keep it from
       // the consumer so blur-validation does not flag untouched fields.
       const wasFocused = isFocusedRef.current;
       isFocusedRef.current = false;
       restoreAfterSecureHandoffRef.current = false;
       clearKeyboardFocusedInput(focusRegistryToken);
       if (Platform.OS === "android" && !wasFocused) return;
       parentOnBlur?.();
     },
     [focusRegistryToken, parentOnBlur]
   );
   ```
   Add one sentence to the `NativeTextInput` header comment (`:488-510`): on Android, `onBlur` is reported only after a forwarded `onFocus`.
2. Tests — `packages/ui/src/components/__tests__/TextInput.android.test.tsx`, new `describe("TextInput Android mount blur")` using the same `beforeEach`/`afterEach` as the existing block:
   - "does not forward a blur that arrives before any focus": render `<TextInput placeholder="Email" onBlur={onBlur} onFocus={onFocus} />`; in `act`, call `lifecycle.inputs[0].props.onBlur?.()` (the native callback, bypassing the mock's focused check, which is exactly what Compose does); `onBlur` not called, `onFocus` not called.
   - "forwards a real blur after focus, once": same render; mount blur as above, then `fireEvent(screen.getByTestId("compose-input"), "focus")`, then `fireEvent(..., "blur")`; `onFocus` called once, `onBlur` called once. Then a second native `props.onBlur?.()` with no focus in between: still once.
   - "the mount blur does not unregister a later focus for tap-away dismissal": mount blur, focus, `expect(hasKeyboardFocusedInput()).toBe(true)`; blur, `false` (imports already exist at `:5`).
   - Leave `TextInput.test.tsx:92-100` ("calls onBlur when blurred", iOS default platform) unchanged; it documents the iOS pass-through.
3. Docs
   - `packages/ui/README.md:562-567` `TextInput` bullet: add "On Android the native field reports a blur when it is first composed; the package forwards `onBlur` only after the field has reported focus, so blur validation never flags an untouched field."
   - `packages/ui/LLM_USAGE.md:258` row or a new bullet under Component Selection Rules (`:276+`): "`TextInput` `onBlur` fires only after a real focus on Android; do not add a touched-fields guard in app code." Run `bun run docs:llms`; commit `llms-full.txt`.
   - `packages/ui/CHANGELOG.md`, existing `## [0.27.0]` → `### Fixed`: "**`TextInput` no longer forwards the Android mount blur.** Compose reports `isFocused=false` on first composition; the field forwarded it as `onBlur`, so forms validating on blur showed required errors before any input. `onBlur` now fires only after the field reported focus (Android; iOS and web unchanged). Consumers can drop touched-field guards added for this (tractor-tools-direct #28)." No version bump.

## Validation

- `cd packages/ui && bun run typecheck && bun run test && bun run build` (51 suites; 588 + 3 cases).
- Root: `bun run lint`, `bun run docs:llms:check`, `bun run docs:versions:check`.
- `bunx jest packages/ui/src/components/__tests__/TextInput` green (`TextInput.test.tsx`, `TextInput.android.test.tsx`, `nativeTextField.android.test.tsx`).
- Manual (no device tonight; list in the PR): Android emulator, template sign-in form — open the screen: no required errors before typing; focus email, tap away: error appears; iOS: unchanged.

### Downstream follow-ups (after Matt publishes 0.27.0)

- tractor-tools-direct: `client/features/auth/hooks/useTouchedFields.ts` and the `touch`/`isTouched` wiring in `SignInForm.tsx`, `SignUpForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx` (with `__tests__/authBlurValidation.test.tsx`) become redundant and can be removed; harmless if kept.
- Other consumers with blur validation (doglog, simplesell, camera-app, fieldnest, mindmap, terlo, neurospicyos, downrangedays): nothing to change; premature required errors on Android disappear on bump.

## Out of scope

- Guarding inside `nativeTextField.android.tsx` (internal module; the public contract is `TextInput`'s `onBlur`, and the `@expo/ui` universal field has the same report).
- iOS or web blur semantics; the iOS secure-toggle handoff code.
- Version bump or publish.

## Open questions

None.
