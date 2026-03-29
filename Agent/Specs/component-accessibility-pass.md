# Spec: Component Accessibility & Web Polish

**Status:** Ready
**Priority:** High
**Scope:** Client

---

## What

An accessibility and web-polish pass across 8 UI components to meet WCAG 2.1 AA requirements and improve screen reader / keyboard-navigation support. Every change is additive or opt-in; no existing APIs break.

## Why

1. **Keyboard users on web** cannot tell which element has focus because Button has no visible focus ring (WCAG 2.4.7 Focus Visible).
2. **Screen readers** do not announce BottomSheet and Drawer as modal dialogs because `aria-modal` and `role` attributes are missing.
3. **Accordion** uses the legacy `Animated` API for its chevron rotation. This is inconsistent with the rest of the codebase (which uses Reanimated) and the reduced-motion behavior is manually wired with a separate `Animated.Value` check instead of using the Reanimated `useReducedMotion` integration that `useStaggeredEntrance` already provides. AccordionContent relies entirely on the `@rn-primitives/accordion` Content primitive for its expand/collapse animation, which may not respect reduced-motion on all platforms.
4. **Color-blind users** cannot distinguish TextInput error state because it relies solely on a red border color with no secondary visual indicator.
5. **Card** does not set `accessibilityRole="button"` when it is pressable, so screen readers announce it as a generic view.
6. **Badge** has no `accessibilityRole`, so screen readers do not convey its semantic purpose.
7. **Icon** has no way to mark purely decorative icons as hidden from the accessibility tree.
8. **Popover and Tooltip** do not link trigger to content via `aria-describedby` / `aria-labelledby` on web, so screen readers cannot associate the floating content with its trigger.

## Current State

### 1. Button (`client/components/ui/Button.tsx`)

- Uses `Pressable` with `accessibilityRole="button"` and `accessibilityState` -- good baseline.
- The inner `View` applies preset-based styles via `createStyles`, which sets `cursor: "pointer"` on web.
- **No focus ring.** There is no `:focus-visible` equivalent or `onFocus`/`onBlur` state tracking. When a keyboard user tabs to the button on web, there is zero visual indication of focus.
- The `Pressable` wrapper has an inline style for `alignSelf` but no web outline/boxShadow treatment.

### 2. BottomSheet (`client/components/ui/BottomSheet.tsx`)

- The backdrop is an `Animated.View` with a nested `Pressable` for close-on-tap.
- The sheet panel is an `Animated.View` with the sheet content.
- **No `aria-modal`, no `role="dialog"`**, and no `accessibilityViewIsModal` prop on the sheet panel or the enclosing overlay. Screen readers on web and iOS will read content behind the sheet.

### 3. Drawer (`client/components/ui/Drawer.tsx`)

- Same overlay architecture as BottomSheet: backdrop `Animated.View` + drawer panel `Animated.View`.
- **Same missing attributes**: no `aria-modal`, no `role="dialog"`, no `accessibilityViewIsModal`.

### 4. Accordion (`client/components/ui/Accordion.tsx`)

- Chevron rotation uses `new Animated.Value(0)` from the core RN `Animated` API (line 95) and `Animated.timing` (line 102).
- Imports `useReducedMotion` from `react-native-reanimated` (line 3) but only uses the return value to short-circuit by calling `rotateAnim.setValue(target)` directly.
- The expand/collapse animation of `AccordionContent` is delegated entirely to `@rn-primitives/accordion`'s `Content` primitive. This primitive may handle height animation internally but there is no explicit reduced-motion guard at our layer.
- The rest of the codebase (AnimatedView, useStaggeredEntrance, useScalePress) all use Reanimated shared values and `useAnimatedStyle`.

### 5. TextInput (`client/components/ui/TextInput.tsx`)

- Error state sets `borderColor: theme.colors.destructive` and renders red `errorText` below the input.
- Sets `aria-invalid={hasError}` -- good.
- **No icon or non-color indicator inside the input field itself** to signal error visually for color-blind users. The only cue is the red border and red text below.

### 6. Card (`client/components/ui/Card.tsx`)

- When `onPress` is provided, wraps content in a `Pressable` with `useScalePress`.
- The `Pressable` sets `disabled` and `cursor: "pointer"` on web.
- **No `accessibilityRole`** on the Pressable. Screen readers announce it as a generic view, not as a button.

### 7. Badge (`client/components/ui/Badge.tsx`)

- Renders a `View` with styled `StyledText` children.
- **No `accessibilityRole`** at all. Screen readers have no semantic context for what this element represents.

### 8. Popover & Tooltip (`client/components/ui/Popover.tsx`, `client/components/ui/Tooltip.tsx`)

- Both use their respective `@rn-primitives/*` primitives which handle basic open/close state.
- Neither component passes `aria-describedby` or `aria-labelledby` attributes to link the trigger element to the content on web.
- The primitives from `@rn-primitives` may handle some of this internally on web. Needs verification -- if the primitive already sets `aria-describedby`, we only document it; if not, we add it.

## Changes

### 1. Button: Keyboard focus ring on web

Add `onFocus` / `onBlur` state tracking to the `Pressable`, and apply a visible focus ring style on web when focused via keyboard.

```tsx
// Inside Button component, add state:
const [focused, setFocused] = useState(false);

// On the Pressable:
<Pressable
  accessibilityRole="button"
  accessibilityState={{ disabled: !!isDisabled, busy: loading }}
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  {...rest}
  {...pressHandlers}
  style={{
    alignSelf: fullWidth ? "stretch" : (flattenedStyle?.alignSelf as ViewStyle["alignSelf"]) ?? "flex-start",
  }}
  disabled={isDisabled}
>
  {(state) => (
    <Animated.View style={scaleStyle}>
      <View
        style={[
          styles.button,
          // ... existing preset styles ...
          // Focus ring on web only, keyboard navigation
          Platform.OS === "web" && focused && {
            boxShadow: `0 0 0 2px ${theme.colors.background}, 0 0 0 4px ${theme.colors.accent}`,
          } as any,
        ]}
      >
```

The double-ring pattern (2px background + 2px accent) ensures visibility on any background color. This matches the existing TextInput focus ring pattern (line 317-319 of TextInput.tsx).

### 2. BottomSheet: `aria-modal` and `role`

Add accessibility attributes to the sheet panel `Animated.View`:

```tsx
// On the sheet panel Animated.View in BottomSheetContent:
<Animated.View
  style={[sheetStyle, { transform: [{ translateY }] }, ...]}
  accessibilityViewIsModal={true}
  {...(Platform.OS === "web" && {
    role: "dialog",
    "aria-modal": true,
  } as any)}
  {...(panResponder ? panResponder.panHandlers : {})}
  {...props}
>
```

Also add `accessibilityLabel` passthrough: allow `BottomSheetContentProps` to accept an optional `accessibilityLabel` prop so consumers can name the dialog.

### 3. Drawer: `aria-modal` and `role`

Same pattern as BottomSheet on the drawer panel `Animated.View`:

```tsx
// On the drawer panel Animated.View in DrawerContent:
<Animated.View
  style={[drawerStyle, { transform: [{ translateX }] }, ...]}
  accessibilityViewIsModal={true}
  {...(Platform.OS === "web" && {
    role: "dialog",
    "aria-modal": true,
  } as any)}
  {...(panResponder ? panResponder.panHandlers : {})}
  {...props}
>
```

### 4. Accordion: Migrate chevron to Reanimated + reduced-motion guard

Replace the legacy `Animated` import and `Animated.Value` / `Animated.timing` usage in `AccordionTrigger` with Reanimated shared values and `useAnimatedStyle`.

```tsx
// Replace in AccordionTrigger:
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";

function AccordionTrigger({ children, style: styleOverride, ...props }) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const { isExpanded } = AccordionPrimitive.useItemContext();
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    const target = isExpanded ? 1 : 0;
    if (reduceMotion) {
      rotation.value = target;
      return;
    }
    rotation.value = withTiming(target, {
      duration: isExpanded ? 200 : 150,
    });
  }, [isExpanded, reduceMotion]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    // ... existing JSX ...
    <Animated.View style={chevronStyle}>
      <Icon name="chevron-down" size={16} color={theme.colors.textDim} />
    </Animated.View>
  );
}
```

This removes the `Animated` import from `react-native` (for the RN core Animated API) and the `useRef(new Animated.Value(...))` pattern, replacing them with Reanimated primitives consistent with the rest of the codebase.

Also remove the now-unused core RN `Animated` import from the file. The `Animated` from `react-native` import on line 2 should be cleaned up (only `Pressable`, `View`, `ViewStyle`, `Platform` are still needed from RN).

### 5. TextInput: Error icon indicator

When `hasError` is true, render a small alert-circle icon inside the input (positioned absolutely, similar to the existing `leftElement` / `rightElement` pattern). This provides a shape-based indicator alongside the color change.

```tsx
// After the existing rightElement / passwordToggle blocks:
{hasError && !rightElement && !(secureTextEntry && showSecureEntryToggle) && (
  <View
    style={styles.errorIcon}
    accessibilityLabel="Error"
    pointerEvents="none"
  >
    <Icon
      name="alert-circle"
      size={spacing.iconSm}
      color="destructive"
    />
  </View>
)}
```

Add `errorIcon` to `createStyles`:

```tsx
errorIcon: {
  position: "absolute",
  right: spacing.sm,
  top: "50%",
  transform: [{ translateY: -10 }],
  zIndex: 1,
},
```

When `rightElement` is already set or the password toggle is active, skip the error icon to avoid overlap. The icon only renders when there is space in the right slot.

Also adjust `inputPaddingRight` calculation to account for the error icon:

```tsx
const inputPaddingRight =
  rightElement || (secureTextEntry && showSecureEntryToggle) || hasError
    ? sizeConfig.paddingHorizontal + spacing.xl
    : sizeConfig.paddingHorizontal;
```

### 6. Card: `accessibilityRole` when pressable

Add `accessibilityRole="button"` to the `Pressable` when `onPress` is set:

```tsx
// In the onPress branch of Card:
<Pressable
  onPress={onPress}
  disabled={disabled}
  accessibilityRole="button"
  accessibilityState={{ disabled: !!disabled }}
  {...pressHandlers}
  style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
>
```

### 7. Badge: `accessibilityRole`

Add `accessibilityRole="text"` to the Badge root `View`. This is the closest built-in RN role for a status label. On web this maps to a `<span>` semantic equivalent.

```tsx
<View
  accessibilityRole="text"
  style={[styles.badge, ...]}
>
```

### 8. Icon: `decorative` prop

Add an optional `decorative` prop. When true, sets `accessible={false}` and `importantForAccessibility="no"` to hide the icon from the accessibility tree.

```tsx
export interface IconProps {
  name: IconName;
  size?: number;
  color?: string | ThemeColorName;
  style?: StyleProp<ViewStyle>;
  /**
   * When true, hides the icon from the accessibility tree.
   * Use for purely decorative icons that add no information.
   * @default false
   */
  decorative?: boolean;
}

export function Icon({ name, size = 24, color, style, decorative = false }: IconProps) {
  const { theme } = useTheme();
  const iconColor = resolveIconColor(color, theme.colors);

  return (
    <View
      pointerEvents="none"
      style={style}
      accessible={!decorative}
      {...(decorative && {
        importantForAccessibility: "no" as const,
        accessibilityElementsHidden: true,
        "aria-hidden": true,
      })}
    >
      <Feather name={name} size={size} color={iconColor} />
    </View>
  );
}
```

### 9. Popover & Tooltip: `aria-describedby` linking

First verify whether `@rn-primitives/popover` and `@rn-primitives/tooltip` already set `aria-describedby` on the trigger when content is open. Inspect the primitive source:

- If the primitive handles it: document in code comments that the primitive provides this, no action needed.
- If not: generate a unique ID with `useId()` (React 19), pass it to both `PopoverTrigger` (as `aria-describedby`) and `PopoverContent` (as `nativeID` / `id`). Same for Tooltip.

Pattern if manual wiring is needed:

```tsx
// In PopoverContent, add an id:
function PopoverContent({ id, ...props }: PopoverContentProps & { id?: string }) {
  return (
    <PopoverPrimitive.Content
      {...(Platform.OS === "web" && id ? { id } : {})}
      ...
    />
  );
}

// Consumer wires it:
const popoverId = useId();
<Popover>
  <Popover.Trigger aria-describedby={popoverId}>...</Popover.Trigger>
  <Popover.Content id={popoverId}>...</Popover.Content>
</Popover>
```

Since this changes consumer code, the preferred path is that the primitives already handle it. The implementer should verify first and only add manual wiring if the primitive does not.

## Acceptance Criteria

1. **Button focus ring**: Tabbing to a Button on web shows a visible 2px accent ring. The ring disappears on blur. The ring does not appear on mouse click (use `:focus-visible` heuristic or track keyboard vs pointer). No visual change on native.
2. **BottomSheet aria-modal**: When BottomSheet is open on web, the sheet panel element has `role="dialog"` and `aria-modal="true"` in the DOM. On iOS, `accessibilityViewIsModal` is true, causing VoiceOver to trap focus inside the sheet.
3. **Drawer aria-modal**: Same verification as BottomSheet. Drawer panel has `role="dialog"`, `aria-modal="true"` on web, `accessibilityViewIsModal` on native.
4. **Accordion Reanimated migration**: The chevron rotation animation plays identically to before. The file no longer imports `Animated` from `react-native`. When reduced-motion is enabled, the chevron snaps instantly with no animation.
5. **TextInput error icon**: When `error` or `errorText` is set, a red alert-circle icon appears inside the input on the right side. The icon does not appear when `rightElement` or `showSecureEntryToggle` is active. The icon has `accessibilityLabel="Error"`.
6. **Card accessibilityRole**: When `onPress` is set, screen readers announce the Card as a button. When `onPress` is not set, no role is added.
7. **Badge accessibilityRole**: Screen readers announce Badge content with the `text` role.
8. **Icon decorative**: `<Icon name="star" decorative />` results in `aria-hidden="true"` in the web DOM and `accessibilityElementsHidden` on native. `<Icon name="star" />` (default) remains accessible.
9. **Popover/Tooltip aria-describedby**: On web, when Popover or Tooltip content is open, the trigger element has an `aria-describedby` attribute pointing to the content element's `id`. If the `@rn-primitives` primitives already handle this, a code comment documents that fact and no additional code is needed.

## Constraints

- No breaking API changes. All new props are optional with safe defaults.
- No new npm dependencies.
- Preserve existing visual appearance (the focus ring is the only new visual element, and only on web keyboard navigation).
- All changes must work on iOS, Android, and web.
- Follow existing code style: double quotes, semicolons, 2-space indentation.
- Use `StyleSheet.flatten()` pattern where style arrays touch `@rn-primitives` components.

## Out of Scope

- Full WCAG audit of all 27 components (this spec covers the 8 most impactful).
- Focus trapping (Tab key cycling within modals) -- complex cross-platform problem for a separate spec.
- Screen reader announcements for BottomSheet/Drawer open/close transitions.
- Automated accessibility testing infrastructure (jest-axe, Detox a11y checks).
- RTL layout fixes.

## Files Likely Affected

- `client/components/ui/Button.tsx` -- focus ring state + web style
- `client/components/ui/BottomSheet.tsx` -- aria-modal, role, accessibilityViewIsModal
- `client/components/ui/Drawer.tsx` -- aria-modal, role, accessibilityViewIsModal
- `client/components/ui/Accordion.tsx` -- Reanimated migration for chevron
- `client/components/ui/TextInput.tsx` -- error icon indicator + padding adjustment
- `client/components/ui/Card.tsx` -- accessibilityRole on Pressable
- `client/components/ui/Badge.tsx` -- accessibilityRole on View
- `client/components/ui/Icon.tsx` -- decorative prop
- `client/components/ui/Popover.tsx` -- aria-describedby (if primitive does not handle it)
- `client/components/ui/Tooltip.tsx` -- aria-describedby (if primitive does not handle it)

## Edge Cases

- **Button focus ring + disabled**: Do not show focus ring when button is disabled, even if it receives focus programmatically.
- **Button focus ring + pressed state**: Focus ring should remain visible while the button is pressed (do not conflict with the pressed opacity style).
- **TextInput error icon + multiline**: The error icon should be positioned at the top-right for multiline inputs, not vertically centered (which would look wrong in a tall textarea). Alternatively, skip the icon for multiline and rely on the border + error text.
- **TextInput error icon + left-to-right element overlap**: If consumer passes both `rightElement` and `error`, the error icon is suppressed to avoid double icons in the right slot.
- **Accordion reduced-motion + initial expanded**: If an Accordion item starts expanded (`defaultValue`), the chevron should start at 180deg with no animation, regardless of reduced-motion setting.
- **BottomSheet/Drawer aria-modal + nested modals**: If a BottomSheet is opened from within a Drawer, both should have `aria-modal`. The innermost one wins for screen reader focus trapping.
- **Icon decorative={false} (default)**: Ensure the Icon remains accessible by default. Do not accidentally set `aria-hidden` on all icons.
- **Popover/Tooltip primitive already handles aria-describedby**: If the `@rn-primitives` primitive already sets this attribute, adding a duplicate could cause issues. Check first, then document or add.
