# Spec: Select & RadioGroup Components

**Status:** Ready
**Priority:** High
**Scope:** Client
**Target Files:** `client/components/ui/Select.tsx`, `client/components/ui/RadioGroup.tsx`

---

## Summary

Two new form-oriented components:

1. **Select** -- A dropdown picker for choosing a single value from a list. Distinct from `DropdownMenu` (which is for actions/commands). Uses portal overlay, chevron trigger, placeholder, search/filter, and form integration (disabled, error states).

2. **RadioGroup** -- A standalone radio button group for single-select options. Currently the only radio UI exists inline in `SettingsScreen.tsx` (lines 131-160, styles at lines 314-330). This extracts that pattern into a proper reusable component with animation, sizes, and accessibility.

---

## Motivation

### Select
The codebase has `DropdownMenu` for action menus but no form-style Select for data input. Form screens need a standard dropdown picker that integrates with validation patterns (error states, disabled states, placeholders). The DropdownMenu component is built for commands and context menus -- Select fills the complementary "pick a value" role.

### RadioGroup
The `SettingsScreen.tsx` template has a hand-rolled radio UI (type: "select" items render radio circles inline). This works for settings but is not reusable. A standalone `RadioGroup` component would:
- Be usable anywhere (forms, modals, settings, onboarding)
- Match the `Checkbox` component's API patterns (sizes: sm/md/lg, error state, disabled state, label support)
- Provide animation for the selection indicator (matching Checkbox's animated checkmark)
- Provide proper accessibility roles

---

## Primitives

### Select
`@rn-primitives/select` exists on npm (`^1.4.0`) but is **not currently installed**. It must be added:

```bash
bun add @rn-primitives/select@^1.4.0
```

Wrap `@rn-primitives/select` following the `DropdownMenu.tsx` pattern (portal, overlay, content positioning, safe area insets).

### RadioGroup
`@rn-primitives/radio-group` exists on npm (`^1.4.0`) but is **not currently installed**. It must be added:

```bash
bun add @rn-primitives/radio-group@^1.4.0
```

Wrap `@rn-primitives/radio-group` following the `Checkbox.tsx` pattern (sizes, animated indicator, label, error state).

---

## Part A: Select Component

### API Design

#### Compound Components

| Component | Purpose | Wraps |
|-----------|---------|-------|
| `Select` | Root, manages selected value | `SelectPrimitive.Root` |
| `SelectTrigger` | Button showing current value + chevron | `SelectPrimitive.Trigger` |
| `SelectValue` | Display component for selected value text | `SelectPrimitive.Value` |
| `SelectContent` | Dropdown list container with portal | `SelectPrimitive.Content` |
| `SelectItem` | Individual option in the list | `SelectPrimitive.Item` |
| `SelectSeparator` | Visual divider between groups | `SelectPrimitive.Separator` |
| `SelectGroup` | Groups items under a label | `SelectPrimitive.Group` |
| `SelectLabel` | Label for a group | `SelectPrimitive.Label` |

#### Props

**Select (Root)**
```tsx
interface SelectProps extends SelectPrimitive.RootProps {
  // Inherits: value, onValueChange, defaultValue, open, onOpenChange, disabled
}
```

**SelectTrigger**
```tsx
interface SelectTriggerProps extends Omit<SelectPrimitive.TriggerProps, "style"> {
  /** Size variant matching other form components
   * - "sm": 32px height
   * - "md": 36px height (default)
   * - "lg": 40px height
   */
  size?: "sm" | "md" | "lg";
  /** Whether the trigger is in an error state */
  error?: boolean;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

**SelectContent**
```tsx
interface SelectContentProps extends SelectPrimitive.ContentProps {
  /** Portal host name */
  portalHost?: string;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

**SelectItem**
```tsx
interface SelectItemProps extends SelectPrimitive.ItemProps {
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

**SelectValue**
```tsx
interface SelectValueProps extends SelectPrimitive.ValueProps {
  /** Placeholder text shown when no value is selected */
  placeholder?: string;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

#### Usage Examples

```tsx
// Basic usage
<Select value={country} onValueChange={setCountry}>
  <SelectTrigger>
    <SelectValue placeholder="Select a country" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="us" label="United States" />
    <SelectItem value="ca" label="Canada" />
    <SelectItem value="mx" label="Mexico" />
  </SelectContent>
</Select>

// With error state and size
<Select value={role} onValueChange={setRole}>
  <SelectTrigger size="lg" error={!!errors.role}>
    <SelectValue placeholder="Choose a role" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Admin Roles</SelectLabel>
      <SelectItem value="owner" label="Owner" />
      <SelectItem value="admin" label="Admin" />
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Member Roles</SelectLabel>
      <SelectItem value="editor" label="Editor" />
      <SelectItem value="viewer" label="Viewer" />
    </SelectGroup>
  </SelectContent>
</Select>

// Disabled
<Select value={plan} onValueChange={setPlan} disabled>
  <SelectTrigger>
    <SelectValue placeholder="Locked" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="free" label="Free" />
  </SelectContent>
</Select>
```

### Visual Design

**SelectTrigger**
- Matches TextInput styling: border (`theme.colors.border`), `radiusMd` border radius, `theme.colors.background` background
- Error state: `theme.colors.destructive` border
- Disabled state: opacity 0.5
- Chevron icon (`chevron-down`) on right side, `theme.colors.mutedForeground` color
- When open, chevron rotates to `chevron-up` (or swap icon)
- Placeholder text: `theme.colors.mutedForeground`
- Selected value text: `theme.colors.foreground`

**Size configs** (matching Button/Toggle/Checkbox size system):

| Size | Height | Font Size | Icon Size | Padding Horizontal |
|------|--------|-----------|-----------|-------------------|
| sm | 32px | 12px | `spacing.iconSm` (16) | `spacing.sm` (8) |
| md | 36px | 14px | `spacing.iconSm` (16) | `spacing.inputPadding` (10) |
| lg | 40px | 14px | `spacing.iconMd` (24) | `spacing.md` (16) |

**SelectContent**
- Same styling as `DropdownMenuContent`: portal + overlay + animated fade-in
- `theme.colors.background` background, 1px `theme.colors.border` border, `radiusSm` radius
- Soft shadow on iOS (matching DropdownMenu pattern, no shadow on Android/Web)
- `minWidth: 128`, content stretches to match trigger width
- Uses `FullWindowOverlay` on iOS (same as DropdownMenu)
- Uses `AnimatedView type="fade"` for entrance animation
- Max height with ScrollView for long lists

**SelectItem**
- Same styling as `DropdownMenuItem`: padding, border radius, hover state
- Check icon on the left when selected (same as `DropdownMenuCheckboxItem` indicator pattern)
- `theme.colors.foreground` text, `theme.colors.text` check icon

**SelectSeparator**
- Same as `DropdownMenuSeparator`: 1px `theme.colors.border`, negative horizontal margin

---

## Part B: RadioGroup Component

### API Design

#### Compound Components

| Component | Purpose | Wraps |
|-----------|---------|-------|
| `RadioGroup` | Root, manages selected value | `RadioGroupPrimitive.Root` |
| `RadioGroupItem` | Individual radio button | `RadioGroupPrimitive.Item` |

#### Props

**RadioGroup (Root)**
```tsx
interface RadioGroupProps extends Omit<RadioGroupPrimitive.RootProps, "style"> {
  /** Size of radio buttons
   * - "sm": 16px
   * - "md": 20px (default)
   * - "lg": 24px
   * Matches Checkbox size system exactly.
   */
  size?: RadioGroupSize;
  /** Whether the group is in an error state (applies to all items) */
  error?: boolean;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}
```

Controlled: `value` + `onValueChange` (from primitive).
Uncontrolled: `defaultValue` (from primitive).

**RadioGroupItem**
```tsx
interface RadioGroupItemProps extends Omit<RadioGroupPrimitive.ItemProps, "style"> {
  /** Optional label text displayed next to the radio button */
  label?: string;
  /** Whether this specific item is disabled */
  disabled?: boolean;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
  /** Style for the label text */
  labelStyle?: StyleProp<ViewStyle>;
}
```

#### Usage Examples

```tsx
// Basic usage
const [value, setValue] = useState("option1");
<RadioGroup value={value} onValueChange={setValue}>
  <RadioGroupItem value="option1" label="Option 1" />
  <RadioGroupItem value="option2" label="Option 2" />
  <RadioGroupItem value="option3" label="Option 3" />
</RadioGroup>

// Different sizes
<RadioGroup size="sm" value={priority} onValueChange={setPriority}>
  <RadioGroupItem value="low" label="Low" />
  <RadioGroupItem value="medium" label="Medium" />
  <RadioGroupItem value="high" label="High" />
</RadioGroup>

// With error state
<RadioGroup error={!!errors.preference} value={pref} onValueChange={setPref}>
  <RadioGroupItem value="email" label="Email" />
  <RadioGroupItem value="sms" label="SMS" />
  <RadioGroupItem value="push" label="Push notification" />
</RadioGroup>

// Mixed disabled items
<RadioGroup value={plan} onValueChange={setPlan}>
  <RadioGroupItem value="free" label="Free" />
  <RadioGroupItem value="pro" label="Pro" />
  <RadioGroupItem value="enterprise" label="Enterprise" disabled />
</RadioGroup>

// Without labels (icon-style usage)
<RadioGroup value={color} onValueChange={setColor}>
  <View style={{ flexDirection: "row", gap: 12 }}>
    <RadioGroupItem value="red" />
    <RadioGroupItem value="green" />
    <RadioGroupItem value="blue" />
  </View>
</RadioGroup>
```

### Visual Design

**Size configs** (matching Checkbox exactly):

| Size | Outer Diameter | Inner Dot Diameter | Border Width |
|------|---------------|-------------------|-------------|
| sm | 16px | 8px | 1px |
| md | 20px | 10px | 1px |
| lg | 24px | 12px | 1px |

**RadioGroupItem (unchecked)**
- Circular border: `theme.colors.text` (via `getContrastingColor` against background, same as Checkbox unchecked)
- Transparent fill
- Error state: `theme.colors.destructive` border (matching Checkbox error pattern)

**RadioGroupItem (checked)**
- Border color: `theme.colors.primary` (matching Checkbox checked border)
- Inner dot: `theme.colors.primary` fill, centered, animated scale-in
- The inner dot animates from scale 0 to scale 1 using Reanimated `withTiming` (60ms duration, matching Checkbox's 60ms checkmark timing)
- Respect `useReducedMotion()` -- skip animation when preferred

**RadioGroupItem (disabled)**
- Opacity 0.5 (matching Checkbox disabled pattern)
- Non-interactive

**Label Layout**
- Same as Checkbox: `Pressable` row container, `gap: spacing.sm`, label in flex-1 container
- Pressing label activates the radio (same as Checkbox label tap behavior)
- Haptic feedback on selection (`hapticLight()`, same as Checkbox)
- Error label color: `theme.colors.destructive`

**RadioGroup Layout**
- Default: vertical stack with `gap: spacing.listItemSpacing` (8px) between items
- No opinion on horizontal layout -- consumers wrap items in a row View if needed

### Comparison to SettingsScreen Inline Radio

The current SettingsScreen radio (lines 314-330 of `SettingsScreen.tsx`):
- Outer: 22px, borderWidth 2, `theme.colors.border` (unchecked) / `theme.colors.primary` (checked)
- Inner: 12px dot, `theme.colors.primary`

The new RadioGroup component will use:
- Sizes: 16/20/24px (sm/md/lg) with 1px border (matching Checkbox, which also uses 1px)
- Default md (20px) is close to the existing 22px
- The SettingsScreen can optionally adopt this component later, but that migration is out of scope for this spec

---

## Implementation Notes

### File Structure
- `client/components/ui/Select.tsx`
- `client/components/ui/RadioGroup.tsx`

### Select Implementation Pattern

Follow `DropdownMenu.tsx` closely:

1. **Portal + Overlay pattern**: Use `SelectPrimitive.Portal`, `SelectPrimitive.Overlay`, and `FullWindowOverlay` (iOS) / `React.Fragment` (other platforms) -- identical to DropdownMenuContent
2. **AnimatedView entrance**: Wrap content in `<AnimatedView type="fade">` for fade-in
3. **Safe area insets**: Pass `insets` from `useSafeAreaInsets()` to content for positioning
4. **Style override pattern**: Always use `StyleSheet.flatten()` on style overrides

```tsx
// Import pattern (matching DropdownMenu)
import * as SelectPrimitive from "@rn-primitives/select";
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
```

### RadioGroup Implementation Pattern

Follow `Checkbox.tsx` closely:

1. **Animated indicator**: Use `useSharedValue` + `useAnimatedStyle` + `withTiming` for the inner dot scale animation (60ms, matching Checkbox)
2. **Haptic feedback**: Call `hapticLight()` on selection change
3. **Label wrapping**: Use `Pressable` container with the radio + label, same as Checkbox label layout
4. **Border color logic**: Use `getContrastingColor()` for unchecked border, `theme.colors.primary` for checked, `theme.colors.destructive` for error (matching Checkbox)
5. **Context**: Create `RadioGroupContext` to share `size` and `error` from root to items (same pattern as `ToggleGroupContext`)

```tsx
// Import pattern (matching Checkbox)
import * as RadioGroupPrimitive from "@rn-primitives/radio-group";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { hapticLight } from "@/client/lib/haptics";
```

### Style Array Crash Prevention
Both components MUST use `StyleSheet.flatten()` for all style overrides -- never pass style arrays to primitive components.

### Web-Specific Considerations
- Select trigger: `cursor: "pointer"` (web), `cursor: "not-allowed"` when disabled
- Select content: `zIndex: 50` (web), matching DropdownMenu
- RadioGroup items: `cursor: "pointer"` (web), `cursor: "not-allowed"` when disabled
- `outlineStyle: "none"` on interactive elements for custom focus styles
- `transition: "all 150ms"` on Select trigger and RadioGroup items

### Exports

**Select.tsx:**
```tsx
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
export type { SelectTriggerProps, SelectContentProps, SelectItemProps, SelectValueProps };
```

**RadioGroup.tsx:**
```tsx
export { RadioGroup, RadioGroupItem };
export type { RadioGroupProps, RadioGroupItemProps, RadioGroupSize };
```

---

## Testing Plan

### Select Tests (`client/components/ui/__tests__/Select.test.tsx`)

1. **Renders with default props** -- trigger shows placeholder
2. **Opens on trigger press** -- content becomes visible
3. **Selects an item** -- value updates, content closes, trigger shows selected label
4. **Controlled mode** -- `value` + `onValueChange` works
5. **Placeholder** -- shows when no value selected
6. **Disabled state** -- trigger cannot be pressed, opacity 0.5
7. **Error state** -- destructive border color on trigger
8. **Sizes** -- sm, md, lg apply correct height
9. **Groups and labels** -- render without errors
10. **Separator** -- renders visual divider

### RadioGroup Tests (`client/components/ui/__tests__/RadioGroup.test.tsx`)

1. **Renders with default props** -- all items visible, none selected
2. **Controlled mode** -- `value` + `onValueChange` works
3. **Uncontrolled mode** -- `defaultValue` sets initial selection
4. **Selection** -- pressing an item selects it, deselects previous
5. **Label tap** -- pressing label activates radio
6. **Disabled group** -- no items are interactive
7. **Disabled item** -- specific item cannot be selected
8. **Error state** -- destructive border colors
9. **Sizes** -- sm, md, lg apply correct outer/inner dimensions
10. **Accessibility** -- correct roles (`radiogroup`, `radio`) and `aria-selected` state

### Manual Testing Checklist

**Select:**
- [ ] Opens and closes correctly on iOS, Android, Web
- [ ] Positioned correctly relative to trigger (respects safe area)
- [ ] Scrollable when many items
- [ ] Selected item shows check indicator
- [ ] Theme switching updates colors
- [ ] Error state border visible
- [ ] Disabled state prevents interaction
- [ ] Keyboard navigation on web (arrow keys to move, enter to select, escape to close)

**RadioGroup:**
- [ ] Selection works on iOS, Android, Web
- [ ] Inner dot animation is smooth
- [ ] Reduced motion disables animation
- [ ] Label tap selects radio
- [ ] Haptic feedback on selection (native)
- [ ] All three sizes render correctly
- [ ] Error state shows destructive border
- [ ] Disabled items show correct visual state
- [ ] Theme switching updates colors

---

## Acceptance Criteria

1. `bun add @rn-primitives/select @rn-primitives/radio-group` succeeds and both packages are in `package.json`
2. `client/components/ui/Select.tsx` exports all compound components
3. `client/components/ui/RadioGroup.tsx` exports `RadioGroup` and `RadioGroupItem`
4. Select: opens/closes, selects items, shows placeholder, supports error/disabled/sizes
5. RadioGroup: selects items, animated dot indicator, supports error/disabled/sizes/labels
6. RadioGroup: haptic feedback on selection (native)
7. RadioGroup: respects `useReducedMotion()`
8. Both: keyboard navigation works on web
9. Both: accessibility roles and attributes present
10. All tests pass
11. `npx expo lint` passes with no new warnings
12. TypeScript strict mode passes with no errors

---

## Out of Scope

- Select search/filter within options (listed in summary as a feature but deferring to v2 to keep scope manageable -- the primitive may not support it natively)
- Select multi-select mode (single select only for v1)
- RadioGroup horizontal layout helper (consumers can wrap in a row View)
- Migrating SettingsScreen inline radio to use RadioGroup (separate task)
- Form library integration (react-hook-form adapters, etc.)
