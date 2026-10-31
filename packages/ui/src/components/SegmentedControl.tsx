import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { NativeSegmentedControl } from "./nativeSegmentedControl";
import { useTheme } from "../hooks/useTheme";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { hapticSelection } from "../lib/haptics";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { spacing } from "../constants/spacing";
import { interaction } from "../constants/interaction";
import { shouldUseNativeDriver } from "../lib/animations";
import { StyledText } from "./StyledText";

/**
 * SegmentedControl — a horizontal single-select control backed by the
 * platform's native segmented control through `./nativeSegmentedControl`
 * (`@expo/ui`'s community control on iOS, its Material segmented buttons on
 * Android):
 *
 *   - iOS:     SwiftUI segmented `Picker` (system-styled).
 *   - Android: a Material segmented control, accent-tinted via `tintColor`,
 *     with a readable selected label (`nativeSegmentedControl.android.tsx`).
 *   - Web:     the kit's own themed control (see `DrawnSegmentedControl`).
 *
 * `size="lg"` draws the kit's own control (`DrawnSegmentedControl`) on every
 * platform at `spacing.touchTarget` (44 pt), because the native control's
 * height is fixed by the system at about 32 pt.
 *
 * The API is value-based to match the rest of the design system (RadioGroup /
 * Tabs / Select): pass the segment `values` plus a controlled `value` (or
 * `defaultValue` for uncontrolled), and read selections back as the chosen
 * string. A `value` that is not in `values` selects no segment. A selection
 * haptic fires on each change, matching Switch / Checkbox (see
 * `hapticSelection`).
 *
 * Theming: the accent color tints the selected segment on Android, web and
 * `size="lg"`. The native iOS control draws the system segmented control,
 * which ignores a custom tint — pass `appearance` to force light/dark there.
 *
 * Drawn control: `@expo/ui`'s vendored web control paints every label white
 * once a `tintColor` is passed, so unselected labels vanished on the light
 * track and the disabled state was unreadable; it also exposes no label
 * styling. The kit draws the control itself on web, and for `size="lg"` on iOS
 * and Android, from theme tokens (`muted` track, accent pill,
 * `accentForeground` / `mutedForeground` labels, the shared disabled opacity
 * and focus ring). `appearance` is ignored there; the theme decides.
 *
 * @example
 * ```tsx
 * <SegmentedControl
 *   values={["Day", "Week", "Month"]}
 *   value={range}
 *   onValueChange={setRange}
 * />
 * ```
 */

export interface SegmentedControlProps {
  /** Segment labels, in display order. */
  values: string[];
  /**
   * Controlled selected value. Omit to use uncontrolled mode with
   * `defaultValue`. A value that is not in `values` selects no segment.
   */
  value?: string;
  /**
   * Initial selected value for uncontrolled mode. Defaults to the first
   * segment. A value not in `values` selects none.
   */
  defaultValue?: string;
  /** Called with the selected segment's value. */
  onValueChange?: (value: string) => void;
  /** Disable interaction. @default false */
  disabled?: boolean;
  /**
   * Control size. `md` is the platform control (system height, about 32 pt on
   * iOS). `lg` is the kit-drawn control at `spacing.touchTarget` (44) on every
   * platform, for screens that need 44 pt targets. On `lg`, `tintColor`
   * applies on iOS too, and `appearance` is ignored (the theme decides), as on
   * web today.
   * @default "md"
   */
  size?: "md" | "lg";
  /**
   * Accent color for the selected segment. Defaults to the theme accent.
   * Applied on Android, web and `size="lg"`; the native iOS control uses the
   * system style.
   */
  tintColor?: string;
  /**
   * Force a color scheme irrespective of the system theme (native iOS/Android;
   * web and `size="lg"` follow the theme).
   */
  appearance?: "light" | "dark";
  /** Style override for the control. */
  style?: StyleProp<ViewStyle>;
}

function SegmentedControl({
  values,
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled = false,
  size = "md",
  tintColor,
  appearance,
  style,
}: SegmentedControlProps) {
  const { theme, getContrastingColor } = useTheme();
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Uncontrolled with no `defaultValue` selects the first segment; a value that
  // is not in `values` gives -1, which selects no segment.
  const selectedIndex = value === undefined ? 0 : values.indexOf(value);

  const lastIndex = useRef(selectedIndex);
  const handleValueChange = useCallback(
    (next: string) => {
      const nextIndex = values.indexOf(next);
      if (nextIndex !== lastIndex.current) {
        lastIndex.current = nextIndex;
        hapticSelection();
      }
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange, values],
  );

  if (Platform.OS === "web" || size === "lg") {
    return (
      <DrawnSegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        height={TRACK_HEIGHTS[size]}
        disabled={disabled}
        tintColor={tintColor}
        onSelect={handleValueChange}
        style={style}
      />
    );
  }

  return (
    <NativeSegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={!disabled}
      onValueChange={handleValueChange}
      tintColor={tintColor ?? theme.colors.accent}
      selectedLabelColor={tintColor ? getContrastingColor(tintColor) : theme.colors.accentForeground}
      appearance={appearance ?? (theme.dark ? "dark" : "light")}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Drawn (web, and `size="lg"` on native)
// ---------------------------------------------------------------------------

/** `md` matches the Button `md` / vendored control height; `lg` is a touch target. */
const TRACK_HEIGHTS = { md: 32, lg: spacing.touchTarget };
/** Gap between the track edge and the selected pill. */
const PILL_INSET = 2;

interface DrawnSegmentedControlProps {
  values: string[];
  /** Selected segment, or -1 for none. */
  selectedIndex: number;
  height: number;
  disabled: boolean;
  tintColor?: string;
  onSelect: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

function DrawnSegmentedControl({
  values,
  selectedIndex,
  height,
  disabled,
  tintColor,
  onSelect,
  style,
}: DrawnSegmentedControlProps) {
  const { theme, getContrastingColor } = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useAnimatedValue(selectedIndex);
  const previousIndex = useRef(selectedIndex);

  useEffect(() => {
    const from = previousIndex.current;
    previousIndex.current = selectedIndex;
    // Nothing is selected, so the pill is not drawn and there is nothing to slide.
    if (selectedIndex < 0) return;
    // The pill was hidden: place it on the new segment instead of sliding in from 0.
    if (from < 0) {
      position.setValue(selectedIndex);
      return;
    }
    const slide = Animated.timing(position, {
      toValue: selectedIndex,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: shouldUseNativeDriver,
    });
    slide.start();
    // Stop on unmount (and before the next selection starts its own slide) so
    // no animation frame outlives the control.
    return () => slide.stop();
  }, [position, reduceMotion, selectedIndex]);

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  const count = Math.max(1, values.length);
  const segmentWidth = Math.max(0, trackWidth - PILL_INSET * 2) / count;
  const travel = Math.max(1, count - 1);
  const pillColor = tintColor ?? theme.colors.accent;
  // A custom tint may not pair with `accentForeground`; pick the readable one.
  const selectedLabelColor = tintColor ? getContrastingColor(tintColor) : theme.colors.accentForeground;

  return (
    <View
      testID="segmented-control"
      accessibilityState={{ disabled }}
      onLayout={onLayout}
      style={[
        {
          height,
          borderRadius: spacing.radiusMd,
          backgroundColor: theme.colors.muted,
          opacity: disabled ? interaction.disabledOpacity : 1,
          overflow: "hidden",
          alignSelf: "stretch",
        },
        style,
      ]}
    >
      {segmentWidth > 0 && selectedIndex >= 0 && (
        <Animated.View
          testID="segmented-control-pill"
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: PILL_INSET,
            bottom: PILL_INSET,
            left: PILL_INSET,
            width: segmentWidth,
            borderRadius: spacing.radiusSm,
            backgroundColor: pillColor,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, travel],
                  outputRange: [0, segmentWidth * travel],
                }),
              },
            ],
          }}
        />
      )}
      {/* The row spans the full track height so each segment's tap target is the
          track height (44 pt on `lg`, also on web, where `hitSlop` does nothing);
          only the pill and focus ring are inset. */}
      <View
        testID="segmented-control-segments"
        style={{ position: "absolute", top: 0, bottom: 0, left: PILL_INSET, right: PILL_INSET, flexDirection: "row" }}
      >
        {values.map((label, index) => (
          <DrawnSegment
            key={`${index}-${label}`}
            label={label}
            selected={index === selectedIndex}
            disabled={disabled}
            color={index === selectedIndex ? selectedLabelColor : theme.colors.mutedForeground}
            onPress={() => onSelect(label)}
          />
        ))}
      </View>
    </View>
  );
}

interface DrawnSegmentProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  color: string;
  onPress: () => void;
}

function DrawnSegment({ label, selected, disabled, color, onPress }: DrawnSegmentProps) {
  const { getFocusRingStyle } = useTheme();
  const focus = useFocusVisible();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        {
          flex: 1,
          paddingVertical: PILL_INSET,
          ...(Platform.OS === "web" && {
            cursor: (disabled ? "not-allowed" : "pointer") as any,
            userSelect: "none" as any,
            outlineStyle: "none" as any,
          }),
        },
      ]}
    >
      {/* Matches the pill's inset box, so the label and focus ring sit where they did. */}
      <View
        style={[
          {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.sm,
            borderRadius: spacing.radiusSm,
          },
          focus.focused && !disabled && getFocusRingStyle(),
        ]}
      >
        <StyledText
          selectable={false}
          numberOfLines={1}
          fontWeight="medium"
          style={{ fontSize: 14, lineHeight: 18, color }}
        >
          {label}
        </StyledText>
      </View>
    </Pressable>
  );
}

export { SegmentedControl };
