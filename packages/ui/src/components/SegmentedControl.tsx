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
import { SegmentedControl as NativeSegmentedControl } from "@expo/ui/community/segmented-control";
import { useTheme } from "../hooks/useTheme";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { hapticSelection } from "../lib/haptics";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { spacing } from "../constants/spacing";
import { interaction } from "../constants/interaction";
import { StyledText } from "./StyledText";

/**
 * SegmentedControl — a horizontal single-select control backed by the
 * platform's native segmented control via
 * `@expo/ui/community/segmented-control`:
 *
 *   - iOS:     SwiftUI segmented `Picker` (system-styled).
 *   - Android: a Material segmented control, accent-tinted via `tintColor`.
 *   - Web:     the kit's own themed control (see `WebSegmentedControl`).
 *
 * The API is value-based to match the rest of the design system (RadioGroup /
 * Tabs / Select): pass the segment `values` plus a controlled `value` (or
 * `defaultValue` for uncontrolled), and read selections back as the chosen
 * string. A selection haptic fires on each change, matching Switch / Checkbox
 * (see `hapticSelection`).
 *
 * Theming: the accent color tints the selected segment on Android and web. iOS
 * draws the system segmented control, which ignores a custom tint — pass
 * `appearance` to force light/dark there.
 *
 * Web: `@expo/ui`'s vendored web control paints every label white once a
 * `tintColor` is passed, so unselected labels vanished on the light track and
 * the disabled state was unreadable; it also exposes no label styling. The
 * kit draws the control itself on web from theme tokens (`muted` track,
 * accent pill, `accentForeground` / `mutedForeground` labels, the shared
 * disabled opacity and focus ring). `appearance` is ignored there; the theme
 * decides.
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
  /** Controlled selected value. Omit to use uncontrolled mode with `defaultValue`. */
  value?: string;
  /** Initial selected value for uncontrolled mode. Defaults to the first segment. */
  defaultValue?: string;
  /** Called with the selected segment's value. */
  onValueChange?: (value: string) => void;
  /** Disable interaction. @default false */
  disabled?: boolean;
  /**
   * Accent color for the selected segment. Defaults to the theme accent.
   * Applied on Android and web; iOS uses the system style.
   */
  tintColor?: string;
  /** Force a color scheme irrespective of the system theme (iOS/Android; web follows the theme). */
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
  tintColor,
  appearance,
  style,
}: SegmentedControlProps) {
  const { theme } = useTheme();
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const selectedIndex = Math.max(0, values.indexOf(value ?? values[0]));

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

  if (Platform.OS === "web") {
    return (
      <WebSegmentedControl
        values={values}
        selectedIndex={selectedIndex}
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
      appearance={appearance ?? (theme.dark ? "dark" : "light")}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Web
// ---------------------------------------------------------------------------

/** Matches the Button `md` / vendored control height. */
const TRACK_HEIGHT = 32;
/** Gap between the track edge and the selected pill. */
const PILL_INSET = 2;

interface WebSegmentedControlProps {
  values: string[];
  selectedIndex: number;
  disabled: boolean;
  tintColor?: string;
  onSelect: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

function WebSegmentedControl({ values, selectedIndex, disabled, tintColor, onSelect, style }: WebSegmentedControlProps) {
  const { theme, getContrastingColor } = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useAnimatedValue(selectedIndex);

  useEffect(() => {
    Animated.timing(position, {
      toValue: selectedIndex,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
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
          height: TRACK_HEIGHT,
          borderRadius: spacing.radiusMd,
          backgroundColor: theme.colors.muted,
          opacity: disabled ? interaction.disabledOpacity : 1,
          overflow: "hidden",
          alignSelf: "stretch",
        },
        style,
      ]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
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
      <View style={{ position: "absolute", top: PILL_INSET, bottom: PILL_INSET, left: PILL_INSET, right: PILL_INSET, flexDirection: "row" }}>
        {values.map((label, index) => (
          <WebSegment
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

interface WebSegmentProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  color: string;
  onPress: () => void;
}

function WebSegment({ label, selected, disabled, color, onPress }: WebSegmentProps) {
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
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.sm,
          borderRadius: spacing.radiusSm,
          ...(Platform.OS === "web" && {
            cursor: (disabled ? "not-allowed" : "pointer") as any,
            userSelect: "none" as any,
            outlineStyle: "none" as any,
          }),
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
    </Pressable>
  );
}

export { SegmentedControl };
