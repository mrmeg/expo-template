# Spec: Add Missing Component Demos to Showcase

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## What
Add demo sections to the component showcase for Badge, Card, Label, and AnimatedView. Currently these 4 demo-worthy components exist in `client/components/ui/` but have no showcase representation.

## Why
The showcase serves as the living design system reference. Missing components are invisible to developers evaluating what's available, leading to duplicate implementations or missed reuse opportunities.

## Current State
- `app/(main)/(demos)/showcase/index.tsx` — 24 of 35 UI components are showcased
- Missing demo-worthy components:
  - **Badge** (`client/components/ui/Badge.tsx`) — 4 variants: default, secondary, outline, destructive
  - **Card** (`client/components/ui/Card.tsx`) — CardHeader, CardTitle, CardDescription, CardContent, CardFooter + pressable variant
  - **Label** (`client/components/ui/Label.tsx`) — form label component
  - **AnimatedView** (`client/components/ui/AnimatedView.tsx`) — 4 animation types: fade, fadeSlideUp, fadeSlideDown, scale
- Intentionally excluded (utility/structural, not visual): DismissKeyboard, ErrorBoundary, MaxWidthContainer, StatusBar

## Changes

### 1. Add Badge section
**File:** `app/(main)/(demos)/showcase/index.tsx`

Add a section after the existing Skeleton section showing all 4 variants:
```tsx
<Section title="Badge">
  <SubSection label="Variants">
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </View>
  </SubSection>
</Section>
```

### 2. Add Card section
Show basic card, card with all sub-components, and pressable card.

### 3. Add Label section
Show Label with a TextInput, and standalone Label.

### 4. Add AnimatedView section
Show all 4 animation types (fade, fadeSlideUp, fadeSlideDown, scale) with a toggle to remount and replay.

### 5. Add imports
Add `Badge`, `Card` (and sub-components), `Label`, `AnimatedView` imports.

## Acceptance Criteria
1. Badge section shows all 4 variants in a horizontal row
2. Card section shows a full card (header + content + footer) and a pressable card
3. Label section shows label paired with a TextInput
4. AnimatedView section shows all 4 types (fade, fadeSlideUp, fadeSlideDown, scale) with a remount toggle
5. All new sections follow existing Section/SubSection pattern
6. No new web console errors introduced
7. Showcase scrolls to top on mount (no autoFocus regressions)

## Constraints
- Follow existing showcase patterns (Section/SubSection components, same styling)
- Do not modify the UI components themselves
- Use `StyleSheet.flatten()` for any @rn-primitives style arrays per CLAUDE.md

## Out of Scope
- Showcasing Notification, DismissKeyboard, ErrorBoundary, MaxWidthContainer, StatusBar (structural/utility/overlay components not suited to static showcase sections)
- Reorganizing existing showcase sections

## Files Likely Affected
**Client:**
- `app/(main)/(demos)/showcase/index.tsx`

## Edge Cases
- **AnimatedView remount toggle** — should cleanly unmount/remount without animation glitches
- **Card pressable variant** — press handler should provide visual feedback without navigation
- **Badge text overflow** — long text in badge should truncate or wrap gracefully
