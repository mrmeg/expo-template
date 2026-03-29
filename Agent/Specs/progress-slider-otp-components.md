# Spec: Progress, Slider & OTP Components

**Status:** Ready
**Priority:** Medium
**Scope:** Client

---

## Summary

Add three new UI primitives to the design system: a linear progress bar, a value slider, and an OTP code input. All three follow the existing component conventions (size system, Reanimated animations, reduced motion support, theme integration, accessibility).

---

## Components

### A) Progress (`client/components/ui/Progress.tsx`)

A linear progress bar with animated fill.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | `undefined` | Progress value 0-100. Omit for indeterminate mode. |
| `variant` | `"default" \| "accent" \| "destructive"` | `"default"` | Color variant. Default uses `primary`, accent uses `accent` (teal), destructive uses `destructive`. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Track height: sm=4px, md=8px, lg=12px. |
| `style` | `StyleProp<ViewStyle>` | — | Custom style override (use `StyleSheet.flatten` for web safety). |

**Behavior:**

- **Determinate mode** (`value` provided): Animated fill bar from 0% to `value`% width. Animate with `withTiming` (duration ~300ms). Clamp value to 0-100.
- **Indeterminate mode** (`value` omitted/undefined): Pulsing opacity animation on the fill bar using `Animated.loop` with `Animated.sequence` (similar to Skeleton.tsx pattern). The fill bar should be ~40% width and pulse opacity between 0.4 and 1.0.
- **Reduced motion:** When `useReducedMotion()` is true, determinate skips animation (duration: 0). Indeterminate shows a static 40% fill at 0.7 opacity.
- Track background: `theme.colors.muted`.
- Track border radius: `radiusFull` (fully rounded).
- Fill border radius: `radiusFull` (fully rounded).

**Variant colors (fill):**

| Variant | Fill color |
|---------|-----------|
| `default` | `theme.colors.primary` |
| `accent` | `theme.colors.accent` |
| `destructive` | `theme.colors.destructive` |

**Accessibility:**

- `accessibilityRole="progressbar"` on the outer container.
- `aria-valuenow={value}` (only when determinate).
- `aria-valuemin={0}`.
- `aria-valuemax={100}`.
- When indeterminate, set `accessibilityState={{ busy: true }}`.

**Type exports:**

```typescript
export type ProgressVariant = "default" | "accent" | "destructive";
export type ProgressSize = "sm" | "md" | "lg";
export interface ProgressProps { ... }
```

**Size config pattern** (follow Checkbox.tsx):

```typescript
const SIZE_CONFIGS: Record<ProgressSize, { height: number }> = {
  sm: { height: 4 },
  md: { height: 8 },
  lg: { height: 12 },
};
```

**Animation pattern** (follow Switch.tsx for determinate, Skeleton.tsx for indeterminate):

- Determinate: Use `useSharedValue` + `useAnimatedStyle` + `withTiming` from `react-native-reanimated`. Animate width as a percentage via `interpolate(progress.value, [0, 100], [0, containerWidth])`. Use `onLayout` to capture container width.
- Indeterminate: Use RN `Animated.loop` + `Animated.sequence` with `Animated.timing` for opacity pulse (matches Skeleton.tsx approach).

---

### B) Slider (`client/components/ui/Slider.tsx`)

A single-value slider with draggable thumb and filled track.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | `0` | Current value. |
| `onValueChange` | `(value: number) => void` | — | Called on value change. |
| `min` | `number` | `0` | Minimum value. |
| `max` | `number` | `100` | Maximum value. |
| `step` | `number` | `1` | Step increment. Values snap to nearest step. |
| `size` | `"sm" \| "md"` | `"md"` | Track/thumb size. |
| `disabled` | `boolean` | `false` | Disables interaction. |
| `showValue` | `boolean` | `false` | Shows current value label above thumb. |
| `style` | `StyleProp<ViewStyle>` | — | Custom style override. |

**Size config:**

| Size | Track height | Thumb diameter |
|------|-------------|----------------|
| `sm` | 4px | 16px |
| `md` | 6px | 20px |

**Behavior:**

- Track background (unfilled): `theme.colors.muted`.
- Track fill (left of thumb): `theme.colors.primary`.
- Thumb: white circle with 1px `theme.colors.border` border and subtle shadow (same pattern as Switch.tsx thumb).
- Use `react-native-gesture-handler` `Pan` gesture for drag interaction.
- On drag, calculate position as ratio of track width, map to value range, snap to nearest `step`.
- Fire `onValueChange` during drag (not just on release) for real-time feedback.
- Fire haptic feedback (`hapticLight`) on step changes during drag.
- Animate thumb position with `useAnimatedStyle` from Reanimated. Use `withTiming` (short duration, ~80ms) for controlled value changes (e.g., external `value` prop updates). Direct gesture tracking should be immediate (no timing delay).
- When `disabled`, set opacity to 0.5 and ignore gestures.
- `showValue`: Render a small label above the thumb displaying the current numeric value. Use `StyledText` with `fontSize: 11`, color `theme.colors.textDim`.
- Use `onLayout` to capture track width for position calculations.
- Track and thumb border radius: `radiusFull`.

**Gesture implementation:**

```typescript
// Conceptual approach — use Gesture.Pan() from react-native-gesture-handler
const pan = Gesture.Pan()
  .onStart(() => { ... })
  .onUpdate((e) => {
    // Calculate new value from translationX + start position
    // Snap to step
    // Update shared value for thumb position
    // Call onValueChange via runOnJS
  })
  .onEnd(() => { ... })
  .enabled(!disabled);
```

**Accessibility:**

- `accessibilityRole="adjustable"` on the root container.
- `accessibilityValue={{ min, max, now: value }}`.
- `accessibilityActions` for increment/decrement.
- `onAccessibilityAction` to handle increment (value + step) and decrement (value - step).

**Type exports:**

```typescript
export type SliderSize = "sm" | "md";
export interface SliderProps { ... }
```

---

### C) InputOTP (`client/components/ui/InputOTP.tsx`)

An OTP/verification code input with individual character boxes.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `length` | `number` | `6` | Number of digits/characters. |
| `value` | `string` | `""` | Current value (controlled). |
| `onChangeText` | `(value: string) => void` | — | Called on value change. |
| `onComplete` | `(code: string) => void` | — | Called when all boxes are filled. |
| `error` | `boolean` | `false` | Error state — red borders. |
| `errorText` | `string` | — | Error message displayed below. |
| `disabled` | `boolean` | `false` | Disables all input. |
| `autoFocus` | `boolean` | `true` | Auto-focus first box on mount. |
| `secureTextEntry` | `boolean` | `false` | Masks input with dots. |
| `inputMode` | `"numeric" \| "text"` | `"numeric"` | Keyboard type. |
| `style` | `StyleProp<ViewStyle>` | — | Custom style override on container. |

**Behavior:**

- Render `length` individual box cells in a row.
- Each cell is a square with dimensions matching the `md` component size (36px wide, 40px tall).
- Cell styling: 1px border with `theme.colors.border`, `radiusMd` border radius, centered text, `fontSize: 20`, `fontWeight: "600"`.
- **Focus behavior:** Only one cell is "active" at a time (the next empty cell, or the last filled cell if all are filled). The active cell has a 2px border with `theme.colors.primary`.
- **Typing:** When a character is entered, it fills the active cell and focus advances to the next cell. When all cells are filled, call `onComplete`.
- **Backspace:** Deletes the character in the active cell. If the active cell is already empty, move focus to the previous cell and delete that character.
- **Paste support:** If the user pastes text, fill cells left-to-right from the pasted string (truncated to `length`). Call `onComplete` if fully filled.
- **Error state:** All cell borders become `theme.colors.destructive`. Display `errorText` below using the same pattern as TextInput (small text, destructive color).
- **Disabled state:** opacity 0.5, no interaction.
- **Secure entry:** Show a filled circle (bullet character) instead of the typed character.
- **Focus indicator animation:** Animate border color transition using Reanimated `withTiming` (60ms, matching Checkbox.tsx). Respect `useReducedMotion`.
- Gap between cells: `spacing.sm` (8px).

**Implementation approach:**

- Use a single hidden `TextInput` (from React Native, not the custom component) to capture keyboard input. Position it off-screen or with opacity 0.
- The visible cells are `Pressable` views that, when tapped, focus the hidden input.
- Map the hidden input's value to the individual cell displays.
- This avoids managing multiple TextInput refs and simplifies paste handling.

**Accessibility:**

- Hidden input: `accessibilityLabel="Verification code input"`.
- Container: `accessibilityRole="none"`.
- Announce "Verification code: X of Y digits entered" on value change.

**Type exports:**

```typescript
export interface InputOTPProps { ... }
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `client/components/ui/Progress.tsx` | Progress bar component |
| `client/components/ui/Slider.tsx` | Slider component |
| `client/components/ui/InputOTP.tsx` | OTP input component |

## Files to Modify

| File | Change |
|------|--------|
| `Agent/Docs/DESIGN.md` | Add entries for Progress, Slider, InputOTP |

## Dependencies

- `react-native-reanimated` (already installed)
- `react-native-gesture-handler` (already installed, needed for Slider Pan gesture)
- No new packages required.

## Patterns to Follow

- **Size system:** Use `SIZE_CONFIGS` record pattern from Checkbox.tsx / TextInput.tsx.
- **Animation:** Use Reanimated `useSharedValue` + `useAnimatedStyle` + `withTiming` for state-driven animations (Switch.tsx). Use RN `Animated.loop` for continuous animations (Skeleton.tsx).
- **Reduced motion:** Always check `useReducedMotion()` from Reanimated. Set duration to 0 or use static fallbacks.
- **Theme integration:** Use `useTheme()` hook for all colors. Never hardcode colors.
- **Haptics:** Use `hapticLight()` from `@/client/lib/haptics` for feedback on user interactions.
- **Style override:** Accept `style` prop, apply via `StyleSheet.flatten` for web compatibility.
- **Type exports:** Export all prop interfaces and variant/size type aliases.

## Testing Plan

- Progress: Renders in all variants/sizes, value clamping, indeterminate mode renders, accessibility attributes present.
- Slider: Value changes on gesture, step snapping, min/max enforcement, disabled state, accessibility value reporting.
- InputOTP: Character entry advances focus, backspace behavior, paste fills cells, onComplete fires when full, error state styling, secure entry masking.

## Edge Cases

- Progress value outside 0-100 range (clamp).
- Slider value outside min/max range (clamp).
- Slider step that doesn't evenly divide the range (snap to nearest valid value).
- InputOTP paste with more characters than `length` (truncate).
- InputOTP paste with non-numeric characters when `inputMode="numeric"` (filter).
- InputOTP rapid typing (debounce not needed — hidden input handles naturally).
- All components on web vs native (test both platforms).

## Out of Scope

- Range slider (two thumbs) — future enhancement.
- Circular/radial progress — future enhancement.
- Progress with label text inside the bar — keep it simple.
- InputOTP with alphanumeric grouping separators (e.g., XXX-XXX) — future enhancement.
