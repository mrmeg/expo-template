# Spec: Accessibility Improvements for Interactive Components

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Add missing `accessibilityRole`, `accessibilityLabel`, and `decorative` props to interactive components (Drawer, Accordion, InputOTP) so screen readers can properly identify and announce them.

## Why
Several Pressable components lack accessibility roles, making them invisible or unidentifiable to screen readers. These are low-effort fixes with high accessibility impact — particularly for Drawer (used in navigation) and Accordion (used for content disclosure).

## Current State

### Drawer (`client/components/ui/Drawer.tsx`)
- **Line 254** — `DrawerTrigger` Pressable: no `accessibilityRole` or `accessibilityLabel`
- **Line 510** — Backdrop Pressable: no `accessibilityRole` or `accessibilityLabel`
- **Line 666** — `DrawerClose` Pressable: no `accessibilityRole` or `accessibilityLabel`
- Zero `accessibilityRole` or `accessibilityLabel` usages in the entire file

### Accordion (`client/components/ui/Accordion.tsx`)
- **Line 120** — `AccordionTrigger` wraps `AccordionPrimitive.Trigger` which already sets `role='button'` internally (verified in dist). No change needed for the trigger role.
- **Line 139** — Chevron `Icon` missing `decorative` prop — gets announced by screen readers as meaningless content

### InputOTP (`client/components/ui/InputOTP.tsx`)
- **Line 185** — Hidden TextInput has `accessibilityLabel="Verification code input"` (good)
- Individual cell Pressable views (that tap to focus) lack `accessibilityRole` and `accessibilityLabel`

## Changes

### 1. Drawer accessibility
**File:** `client/components/ui/Drawer.tsx`

```tsx
// DrawerTrigger non-asChild path (line 254) — add:
accessibilityRole="button"

// DrawerTrigger asChild path (line 243) — inject via cloneElement:
accessibilityRole="button"

// Backdrop (line 510) — add:
accessibilityRole="button"
accessibilityLabel="Close drawer"

// DrawerClose (line 666) — add:
accessibilityRole="button"
accessibilityLabel="Close"
```

### 2. Accordion chevron icon
**File:** `client/components/ui/Accordion.tsx`

Note: `@rn-primitives/accordion` Trigger already sets `role='button'` — do NOT add a duplicate `accessibilityRole`.

```tsx
// Chevron Icon (line 139) — add decorative prop:
<Icon
  name="chevron-down"
  size={16}
  color={theme.colors.textDim}
  decorative
/>
```

### 3. InputOTP cell accessibility
**File:** `client/components/ui/InputOTP.tsx`

Add `accessibilityRole="button"` and a dynamic `accessibilityLabel` to each cell's Pressable wrapper (e.g., "Enter digit 1 of 6").

## Acceptance Criteria
1. DrawerTrigger announces as "button" to screen readers
2. Drawer backdrop announces as "Close drawer" button
3. DrawerClose announces as "Close" button
4. Accordion chevron icon is hidden from screen readers (`decorative` prop)
6. InputOTP cells announce their position (e.g., "Enter digit 1 of 6")
7. No visual changes to any component
8. All existing functionality unchanged

## Constraints
- Only add accessibility attributes — no visual or behavioral changes
- Do not change component APIs or add new props
- **Do NOT add `accessibilityRole` to AccordionTrigger** — `@rn-primitives` already provides `role='button'` (verified in dist/accordion.js:158)

## Out of Scope
- Full WCAG audit of all components
- Adding focus management (tab order, focus trapping)
- Accessibility testing infrastructure

## Files Likely Affected
**Client:**
- `client/components/ui/Drawer.tsx`
- `client/components/ui/Accordion.tsx`
- `client/components/ui/InputOTP.tsx`

## Edge Cases
- **Drawer with `asChild` trigger** — `DrawerTrigger` supports `asChild` which clones props onto a child; `accessibilityRole` should pass through via the clone
- **Accordion disabled state** — ensure `accessibilityState={{ disabled: true }}` is set when the trigger is disabled
- **InputOTP disabled cells** — cells should announce as disabled when the component is disabled
- **@rn-primitives AccordionTrigger** — may already set `accessibilityRole` internally; check before adding to avoid duplicate announcements
