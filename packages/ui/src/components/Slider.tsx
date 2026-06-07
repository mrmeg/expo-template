import { palette } from "../constants/colors";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";
import React, { useCallback, useRef } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { Slider as NativeSlider } from "@expo/ui/community/slider";
import { StyledText } from "./StyledText";

/**
 * Slider — a themed range input backed by the platform's native slider via
 * `@expo/ui/community/slider`:
 *
 *   - iOS:     SwiftUI `Slider`
 *   - Android: Material 3 `Slider`
 *   - Web:     native `<input type="range">` (themed via `accentColor`)
 *
 * The public `SliderProps` surface (value / onValueChange / min / max / step /
 * disabled / showValue / size / style) is preserved, and the active track is
 * themed with the design system's accent color on every platform. Thumb and
 * inactive-track tints additionally apply on Android (iOS/web draw the system
 * thumb). Haptic feedback fires on each step change, matching the prior
 * hand-rolled slider.
 *
 * Platform-owned behaviors (props accepted for ergonomics, but the platform
 * decides):
 *   - `size` is accepted for call-site compatibility but has no effect — the
 *     platform owns the track/thumb dimensions.
 */

export type SliderSize = "sm" | "md";

export interface SliderProps {
  /** Current value */
  value?: number;
  /** Called when the user drags the thumb */
  onValueChange?: (value: number) => void;
  /** Minimum value @default 0 */
  min?: number;
  /** Maximum value @default 100 */
  max?: number;
  /** Step increment @default 1 */
  step?: number;
  /** Size variant. Accepted for compatibility; the platform owns sizing. @default "md" */
  size?: SliderSize;
  /** Disable interaction @default false */
  disabled?: boolean;
  /** Show the current value as a label above the track @default false */
  showValue?: boolean;
  /** Style override for outer container */
  style?: StyleProp<ViewStyle>;
}

function Slider({
  value = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  // Accepted for call-site compatibility; the platform owns track/thumb sizing.
  size: _size = "md",
  disabled = false,
  showValue = false,
  style: styleOverride,
}: SliderProps) {
  const { theme, withAlpha } = useTheme();

  const inactiveTrackColor = theme.dark ? withAlpha(palette.white, 0.1) : theme.colors.muted;
  const activeTrackColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.28)
      : theme.colors.mutedForeground
    : theme.colors.accent;
  const thumbTintColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.32)
      : theme.colors.mutedForeground
    : theme.colors.accent;

  // Fire a light haptic whenever the slider crosses a step boundary, matching
  // the prior hand-rolled behavior. Native emits already-stepped values.
  const lastValue = useRef(value);
  const handleValueChange = useCallback(
    (next: number) => {
      if (next !== lastValue.current) {
        lastValue.current = next;
        hapticLight();
      }
      onValueChange?.(next);
    },
    [onValueChange],
  );

  return (
    // `alignSelf: "stretch"` gives the native slider's Host a definite width on
    // the first layout pass. Without it the SwiftUI/Compose Host measures width
    // lazily, so the thumb starts at an unresolved position and visibly snaps to
    // the correct spot on first interaction.
    <View style={[{ opacity: disabled ? 0.5 : 1, alignSelf: "stretch" }, styleOverride]}>
      {showValue && (
        <StyledText
          selectable={false}
          style={{
            fontSize: 12,
            color: theme.colors.textDim,
            marginBottom: 4,
            userSelect: "none",
          }}
        >
          {value}
        </StyledText>
      )}
      <NativeSlider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        style={{ width: "100%" }}
        // Active track — honored on iOS, Android, and web (`accentColor`).
        minimumTrackTintColor={activeTrackColor}
        // Inactive track + thumb — honored on Android; system-drawn elsewhere.
        maximumTrackTintColor={inactiveTrackColor}
        thumbTintColor={thumbTintColor}
      />
    </View>
  );
}

export { Slider };
