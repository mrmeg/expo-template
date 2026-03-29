# Spec: Tabs Component

**Status:** Ready
**Priority:** High
**Scope:** Client
**Target File:** `client/components/ui/Tabs.tsx`

---

## Summary

A new compound `Tabs` component for content organization within screens. Provides accessible, animated tab switching with two visual variants (underline and pill) and two sizes following the existing component size system.

This is a general-purpose UI Tabs component (not to be confused with Expo Router's tab navigator in `app/(main)/(tabs)/_layout.tsx`, which handles routing). This component manages local content panels within a single screen.

---

## Motivation

The codebase has 27 UI primitives but no Tabs component for in-screen content switching. Several screens and features would benefit from tabbed layouts (e.g., media library views, profile sections, explore filters). The SettingsScreen already has grouped selection patterns; a proper Tabs component would handle the "view one panel at a time" use case that ToggleGroup does not cover.

---

## Primitives

`@rn-primitives/tabs` exists on npm (`^1.4.0`) but is **not currently installed**. It must be added:

```bash
bun add @rn-primitives/tabs@^1.4.0
```

The implementation should wrap `@rn-primitives/tabs` following the same pattern used by:
- `Toggle.tsx` wrapping `@rn-primitives/toggle`
- `ToggleGroup.tsx` wrapping `@rn-primitives/toggle-group`
- `DropdownMenu.tsx` wrapping `@rn-primitives/dropdown-menu`
- `Checkbox.tsx` wrapping `@rn-primitives/checkbox`

---

## API Design

### Compound Components

| Component | Purpose | Wraps |
|-----------|---------|-------|
| `Tabs` | Root, manages active tab state | `TabsPrimitive.Root` |
| `TabsList` | Horizontal container for triggers | `TabsPrimitive.List` |
| `TabsTrigger` | Individual tab button | `TabsPrimitive.Trigger` |
| `TabsContent` | Content panel, visible when active | `TabsPrimitive.Content` |

### Props

**Tabs (Root)**
```tsx
interface TabsProps extends TabsPrimitive.RootProps {
  /** Visual style variant
   * - "underline": active indicator below trigger (default)
   * - "pill": filled background indicator on active trigger
   */
  variant?: "underline" | "pill";
  /** Size of tab triggers
   * - "sm": 32px height
   * - "md": 36px height (default)
   */
  size?: "sm" | "md";
}
```

Controlled mode: `value` + `onValueChange` props (from primitive).
Uncontrolled mode: `defaultValue` prop (from primitive).

**TabsList**
```tsx
interface TabsListProps extends TabsPrimitive.ListProps {
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

**TabsTrigger**
```tsx
interface TabsTriggerProps extends TabsPrimitive.TriggerProps {
  /** Optional icon displayed before label text */
  icon?: IconName;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

**TabsContent**
```tsx
interface TabsContentProps extends TabsPrimitive.ContentProps {
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

### Usage Examples

```tsx
// Basic usage (uncontrolled)
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">
      <SansSerifText>Overview</SansSerifText>
    </TabsTrigger>
    <TabsTrigger value="details">
      <SansSerifText>Details</SansSerifText>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    <SansSerifText>Overview content here</SansSerifText>
  </TabsContent>
  <TabsContent value="details">
    <SansSerifText>Details content here</SansSerifText>
  </TabsContent>
</Tabs>

// Controlled with icons and pill variant
const [tab, setTab] = useState("photos");
<Tabs value={tab} onValueChange={setTab} variant="pill" size="sm">
  <TabsList>
    <TabsTrigger value="photos" icon="image">
      <SansSerifText>Photos</SansSerifText>
    </TabsTrigger>
    <TabsTrigger value="videos" icon="video">
      <SansSerifText>Videos</SansSerifText>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="photos">{/* ... */}</TabsContent>
  <TabsContent value="videos">{/* ... */}</TabsContent>
</Tabs>
```

---

## Visual Design

### Underline Variant (default)
- TabsList: transparent background, bottom border (`theme.colors.border`, 1px)
- Active trigger: `theme.colors.foreground` text, 2px bottom border in `theme.colors.foreground`
- Inactive trigger: `theme.colors.mutedForeground` text, no bottom border
- Active indicator animates horizontally to follow the selected tab (Reanimated `withTiming`, 200ms)

### Pill Variant
- TabsList: `theme.colors.muted` background, `radiusMd` border radius, 1px padding
- Active trigger: `theme.colors.background` background, `radiusSm` border radius, subtle shadow on iOS only (matching ToggleGroup pattern)
- Inactive trigger: transparent background, `theme.colors.mutedForeground` text
- Active background animates position (Reanimated `withTiming`, 200ms)

### Sizes
| Size | Trigger Height | Font Size | Icon Size | Padding Horizontal |
|------|---------------|-----------|-----------|-------------------|
| sm | 32px | 12px | `spacing.iconSm` (16) | `spacing.sm` (8) |
| md | 36px | 13px | `spacing.iconMd` (24) | `spacing.md` (16) |

These match the existing Toggle/ToggleGroup size system exactly.

### Theming
- Use `useTheme()` for all colors
- Use `TextColorContext.Provider` to propagate text color to children (same pattern as Toggle, ToggleGroup)
- Use `TextClassContext.Provider` wrapping triggers (same pattern as ToggleGroup)
- Respect `useReducedMotion()` -- skip animations when reduced motion is preferred (duration: 0)

---

## Behavior

### State Management
- The `@rn-primitives/tabs` primitive manages active tab state internally
- Context (`TabsContext`) shares `variant` and `size` from root to descendants (same pattern as `ToggleGroupContext`)
- Active tab determined by matching `TabsTrigger.value` to root `value`

### Keyboard Navigation (Web)
- Arrow Left/Right moves focus between triggers
- Home/End moves to first/last trigger
- Tab key moves focus out of the tab list
- The primitive should handle this; verify during implementation

### Accessibility
- TabsList: `role="tablist"`
- TabsTrigger: `role="tab"`, `aria-selected`, `aria-controls` linking to content panel
- TabsContent: `role="tabpanel"`, `aria-labelledby` linking to trigger
- Disabled triggers: `accessibilityState={{ disabled: true }}`, opacity 0.5
- The `@rn-primitives/tabs` primitive provides these roles; the wrapper should pass through and supplement with `accessibilityState`

### Animation
- Use `react-native-reanimated` for the active indicator animation
- Underline: animated `translateX` + `width` of the bottom border indicator
- Pill: animated `translateX` + `width` of the background highlight
- Use `useSharedValue` + `useAnimatedStyle` + `withTiming` (200ms duration)
- Respect `useReducedMotion()` from Reanimated

---

## Implementation Notes

### File Structure
Single file: `client/components/ui/Tabs.tsx`

### Imports (expected)
```tsx
import * as TabsPrimitive from "@rn-primitives/tabs";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { TextClassContext, TextColorContext } from "@/client/components/ui/StyledText";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { Platform, StyleSheet, StyleProp, ViewStyle, View } from "react-native";
```

### Style Array Crash Prevention
All style props MUST use `StyleSheet.flatten()` -- never pass style arrays directly to primitive components. This is a critical pattern in this codebase (see CLAUDE.md).

```tsx
// GOOD
style={{
  ...baseStyles,
  ...(styleOverride ? StyleSheet.flatten(styleOverride) : {}),
}}
```

### Web-Specific
- Add `cursor: "pointer"` on triggers (web only, via `Platform.OS === "web"`)
- Add `transition: "all 150ms"` on triggers for hover states (web only)
- Web shadow: return empty object (boxShadow causes RN Web crashes)
- Add `outlineStyle: "none"` for custom focus styles

### Exports
```tsx
export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
```

---

## Testing Plan

### Unit Tests (`client/components/ui/__tests__/Tabs.test.tsx`)

1. **Renders with default props** -- mounts without crashing, shows first tab content
2. **Uncontrolled mode** -- `defaultValue` sets initial active tab
3. **Controlled mode** -- `value` + `onValueChange` works correctly
4. **Tab switching** -- pressing a trigger shows corresponding content, hides others
5. **Disabled trigger** -- cannot be activated, shows disabled styling
6. **Variant prop** -- "underline" and "pill" render without errors
7. **Size prop** -- "sm" and "md" apply correct dimensions
8. **Icon in trigger** -- renders Icon component when `icon` prop provided
9. **Accessibility** -- correct roles and aria attributes present

### Manual Testing Checklist

- [ ] Underline variant renders correctly on iOS, Android, Web
- [ ] Pill variant renders correctly on iOS, Android, Web
- [ ] Active indicator animation is smooth on all platforms
- [ ] Reduced motion preference disables animation
- [ ] Tab switching works via touch/click
- [ ] Keyboard navigation works on web (arrow keys, home/end)
- [ ] Theme switching (light/dark) updates colors correctly
- [ ] Disabled tabs show correct visual state and cannot be activated
- [ ] Nested text inherits correct color via TextColorContext

---

## Acceptance Criteria

1. `bun add @rn-primitives/tabs` succeeds and package is in `package.json`
2. `client/components/ui/Tabs.tsx` exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
3. Both "underline" and "pill" variants render correctly
4. Both "sm" and "md" sizes apply correct dimensions
5. Controlled and uncontrolled modes work
6. Active indicator animates smoothly (respects reduced motion)
7. Keyboard navigation works on web
8. Accessibility roles and attributes are present
9. All tests pass
10. `npx expo lint` passes with no new warnings
11. TypeScript strict mode passes with no errors

---

## Out of Scope

- Vertical tab orientation (horizontal only for v1)
- Lazy rendering / virtualization of tab content
- Scrollable tab list for many tabs (can be added later)
- Integration with Expo Router tabs (this is a local UI component, not a navigator)
