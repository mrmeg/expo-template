# Spec: Component Enhancements

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## Summary

Three targeted improvements to existing UI components: custom component support for Icon, a clearable prop for TextInput, and missing type exports across several components. These are non-breaking, additive changes.

---

## Changes

### A) Icon — Custom component support (`client/components/ui/Icon.tsx`)

**Current behavior:** The Icon component is locked to Feather icons from `@expo/vector-icons`. The `name` prop only accepts Feather icon names.

**Change:** Add two new optional props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `component` | `React.ComponentType<{ size: number; color: string }>` | — | Custom component to render instead of Feather. Receives `size` and `color` as props. |
| `decorative` | `boolean` | `false` | When true, hides the icon from the accessibility tree. |

**Implementation details:**

- When `component` is provided, render it instead of the Feather icon. Pass `size` and `color` (resolved via the existing `resolveIconColor` helper) as props.
- When `component` is provided, `name` becomes optional. TypeScript overloads or a union type should enforce that either `name` or `component` is provided (but not neither).
- When `decorative` is true, add `accessible={false}` and `importantForAccessibility="no-hide-descendants"` to the wrapping `View`. This is for icons that are purely visual (e.g., next to a label that already describes the action).
- The existing `pointerEvents="none"` wrapper remains for both Feather and custom components.

**Prop type approach — discriminated union:**

```typescript
type IconBaseProps = {
  size?: number;
  color?: string | ThemeColorName;
  style?: StyleProp<ViewStyle>;
  decorative?: boolean;
};

type FeatherIconProps = IconBaseProps & {
  name: IconName;
  component?: never;
};

type CustomIconProps = IconBaseProps & {
  name?: never;
  component: React.ComponentType<{ size: number; color: string }>;
};

export type IconProps = FeatherIconProps | CustomIconProps;
```

This ensures at the type level that consumers provide either `name` (Feather) or `component` (custom), but not both and not neither.

**Usage examples:**

```tsx
// Feather icon (unchanged)
<Icon name="check" color="primary" size={16} />

// Custom component
import { MaterialIcons } from "@expo/vector-icons";
const MyIcon = (props: { size: number; color: string }) => (
  <MaterialIcons name="favorite" {...props} />
);
<Icon component={MyIcon} color="destructive" size={20} />

// Decorative icon (hidden from screen readers)
<Icon name="chevron-right" decorative />
```

**Backward compatibility:** Fully backward compatible. All existing `<Icon name="..." />` usage continues to work without changes.

---

### B) TextInput — Clearable prop (`client/components/ui/TextInput.tsx`)

**Current behavior:** TextInput supports `leftElement` and `rightElement` for custom content, but has no built-in clear button.

**Change:** Add a `clearable` boolean prop.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `clearable` | `boolean` | `false` | Shows an X clear button when the field has a value. |

**Implementation details:**

- When `clearable` is true AND `value` is non-empty (truthy after trim), render a clear button in the right element area.
- The clear button is a `Pressable` containing `<Icon name="x" size={spacing.iconSm} color="textDim" />`.
- Tapping the clear button calls `onChangeText("")`.
- Fire `hapticLight()` on clear for tactile feedback.
- When the field is empty, do not render the clear button.
- **Coexistence with `rightElement`:** If both `clearable` and `rightElement` are provided, render both. The clear button appears first (closer to the text), then the custom `rightElement` after it. Wrap both in a row container with `gap: spacing.xs`.
- **Coexistence with `secureTextEntry` + `showSecureEntryToggle`:** If both `clearable` and `showSecureEntryToggle` are active, the password toggle takes precedence in the right position (existing behavior). The clear button is not shown — this avoids a cluttered input. Document this in the JSDoc.
- The clear button should have the same positioning as the existing `rightElement` (absolute positioned, vertically centered).
- Add `accessibilityLabel="Clear input"` and `accessibilityRole="button"` to the clear button Pressable.
- Padding calculation: When `clearable` is active and value is non-empty, account for the clear button in `inputPaddingRight` (same logic as existing rightElement padding).

**Clear button styling:**

```typescript
// Same pattern as passwordToggle in current code
const clearButton = (
  <Pressable
    style={styles.clearButton}  // position: absolute, right: spacing.sm, vertically centered
    onPress={() => {
      hapticLight();
      onChangeText?.("");
    }}
    accessibilityLabel="Clear input"
    accessibilityRole="button"
  >
    <Icon name="x" size={spacing.iconSm} color="textDim" />
  </Pressable>
);
```

**When both clearable and rightElement are present:**

Replace the absolute positioning approach with a flex row container for the right side:

```typescript
// Right elements container
<View style={styles.rightElements}>
  {clearable && value && (
    <Pressable onPress={handleClear} accessibilityLabel="Clear input" accessibilityRole="button">
      <Icon name="x" size={spacing.iconSm} color="textDim" />
    </Pressable>
  )}
  {rightElement}
</View>
```

The `rightElements` container uses `flexDirection: "row"`, `alignItems: "center"`, `gap: spacing.xs`, and is absolutely positioned on the right (matching current `rightElement` positioning).

**Backward compatibility:** Fully backward compatible. Existing TextInput usage is unchanged when `clearable` is not set.

---

### C) Missing type exports

**Current state:** Several components define prop/variant types internally but do not export them. This prevents TypeScript consumers from properly typing variables, arrays, or function parameters that reference these types.

**Components to audit and fix:**

#### DropdownMenu (`client/components/ui/DropdownMenu.tsx`)

Currently uses `type` (not `export type`) for all prop interfaces:

- `DropdownMenuSubTriggerProps`
- `DropdownMenuSubContentProps`
- `DropdownMenuContentProps`
- `DropdownMenuItemProps`
- `DropdownMenuCheckboxItemProps`
- `DropdownMenuRadioItemProps`
- `DropdownMenuLabelProps`
- `DropdownMenuSeparatorProps`
- `DropdownMenuShortcutProps` (interface)

**Change:** Add `export` to each type/interface declaration. Add them to the bottom `export { ... }` block as type exports:

```typescript
export type {
  DropdownMenuSubTriggerProps,
  DropdownMenuSubContentProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuCheckboxItemProps,
  DropdownMenuRadioItemProps,
  DropdownMenuLabelProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
};
```

#### Tooltip (`client/components/ui/Tooltip.tsx`)

Currently exports `TooltipVariant` but not the prop interfaces:

- `TooltipContentProps` (interface, not exported)
- `TooltipBodyProps` (interface, not exported)
- `TooltipProps` (interface, not exported)

**Change:** Export these interfaces. Add to the bottom `export { ... }` block:

```typescript
export type {
  TooltipContentProps,
  TooltipBodyProps,
  TooltipProps,
};
```

#### Skeleton (`client/components/ui/Skeleton.tsx`)

Currently exports all interfaces (`SkeletonProps`, `SkeletonTextProps`, `SkeletonAvatarProps`, `SkeletonCardProps`). **No changes needed** — this component is already correct. Listed here for completeness after audit.

#### Full component audit

Scan all 27 components in `client/components/ui/` for any other prop types or variant types that are defined but not exported. Common patterns to check:

- `type XxxProps = ...` without `export`
- `interface XxxProps { ... }` without `export`
- `type XxxVariant = ...` without `export`
- `type XxxSize = ...` without `export`

Fix any found. This is a sweep — the DropdownMenu and Tooltip are the known issues, but the implementer should verify all components.

---

## Files to Modify

| File | Change |
|------|--------|
| `client/components/ui/Icon.tsx` | Add `component` and `decorative` props, update `IconProps` type |
| `client/components/ui/TextInput.tsx` | Add `clearable` prop, clear button rendering logic |
| `client/components/ui/DropdownMenu.tsx` | Export prop type aliases |
| `client/components/ui/Tooltip.tsx` | Export prop interfaces |
| Any other components found in audit | Export missing types |
| `Agent/Docs/DESIGN.md` | Update Icon and TextInput documentation |

## Files to Create

None.

## Dependencies

No new packages required. All changes use existing imports.

## Patterns to Follow

- **Icon.tsx:** Follow the existing pattern — `resolveIconColor` for color resolution, `View` wrapper with `pointerEvents="none"`.
- **TextInput.tsx:** Follow the existing `passwordToggle` pattern for the clear button (absolute positioned Pressable, same vertical centering approach). Follow the existing `rightElement` conditional rendering pattern.
- **Type exports:** Use `export type { ... }` for type-only exports (TypeScript isolatedModules compatibility). Keep the component `export { ... }` block separate from the type export block.
- **Haptics:** Use `hapticLight()` from `@/client/lib/haptics` for the clear button interaction.
- **Accessibility:** The `decorative` prop on Icon follows the standard pattern for decorative images — `accessible={false}` + `importantForAccessibility="no-hide-descendants"`.

## Testing Plan

- **Icon `component` prop:** Renders custom component with correct size/color, Feather still works when `name` is provided, TypeScript errors when neither `name` nor `component` is provided.
- **Icon `decorative` prop:** Sets accessibility attributes correctly when true, does not set them when false/omitted.
- **TextInput `clearable`:** Clear button appears when value is non-empty, disappears when empty, calls `onChangeText("")` on press, works alongside `rightElement`, does not appear alongside `showSecureEntryToggle`.
- **Type exports:** Verify the types are importable from the component files (compile-time check).

## Edge Cases

- Icon with both `name` and `component` — TypeScript should prevent this at compile time via the discriminated union.
- Icon with neither `name` nor `component` — TypeScript should prevent this.
- TextInput `clearable` with `value={undefined}` — treat as empty, no clear button.
- TextInput `clearable` with `value=""` — empty string, no clear button.
- TextInput `clearable` with `value="  "` (whitespace only) — show clear button (the field has content the user may want to remove; the trim check is only to determine visibility).
- TextInput `clearable` + `disabled` — render the clear button but do not handle press (or hide it entirely since the field is not editable). Recommend: hide it when disabled.
- DropdownMenu type exports — ensure no circular dependency issues with `@rn-primitives` base types being re-exported.

## Out of Scope

- Icon: Supporting multiple icon libraries via a registry/provider pattern — too complex for this enhancement.
- TextInput: Animated clear button appearance (fade in/out) — keep it simple with conditional rendering.
- TextInput: Clear button for multiline/textarea inputs — the clear button pattern is for single-line inputs. Multiline should not show it.
- Creating a barrel index file for `client/components/ui/` — separate concern.
