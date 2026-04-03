# Spec: InputOTP autoFocus Default Should Be False

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What
Change the `InputOTP` component's `autoFocus` prop default from `true` to `false`. The current default causes unintended scroll-to-bottom behavior on any screen that renders InputOTP below the fold.

## Why
When InputOTP mounts with `autoFocus={true}`, the browser/native platform scrolls the viewport to bring the focused input into view. On screens like the showcase or any form where OTP isn't the first field, this creates a jarring scroll-to-bottom on mount. Consumers who want auto-focus can opt in explicitly; the safe default is off.

## Current State
- `client/components/ui/InputOTP.tsx:108` — `autoFocus = true` in the destructured props
- `client/components/ui/InputOTP.tsx:178` — passes `autoFocus={autoFocus}` to the hidden `RNTextInput`
- The showcase already works around this with explicit `autoFocus={false}` on all 3 instances (lines 1765, 1768, 1771)

## Changes

### 1. Change default in InputOTP.tsx
**File:** `client/components/ui/InputOTP.tsx`

Change line 108:
```tsx
// Before
autoFocus = true,

// After
autoFocus = false,
```

### 2. Remove workarounds in showcase
**File:** `app/(main)/(demos)/showcase/index.tsx`

Remove the explicit `autoFocus={false}` from all 3 InputOTP instances (lines 1765, 1768, 1771) since `false` will now be the default.

### 3. Update JSDoc
**File:** `client/components/ui/InputOTP.tsx`

Update the `@default` annotation on the `autoFocus` prop (line 59) from `true` to `false`.

## Acceptance Criteria
1. `InputOTP` renders without auto-focusing when no `autoFocus` prop is passed
2. `InputOTP` still auto-focuses when `autoFocus={true}` is explicitly passed
3. Showcase page loads scrolled to top, not bottom
4. No `autoFocus={false}` workarounds remain in showcase

## Constraints
- Do not change any other InputOTP behavior
- Do not change the hidden TextInput's focus mechanism — only the default

## Out of Scope
- Adding a `ref` API for imperative focus control
- Changing focus behavior on other input components

## Files Likely Affected
**Client:**
- `client/components/ui/InputOTP.tsx`
- `app/(main)/(demos)/showcase/index.tsx`

## Edge Cases
- **Consumer passes `autoFocus={true}` explicitly** — should still auto-focus (opt-in works)
- **Consumer passes no `autoFocus` prop** — should NOT auto-focus (new safe default)
- **Multiple InputOTP on one screen with `autoFocus={true}`** — last one mounted wins focus (unchanged behavior)
