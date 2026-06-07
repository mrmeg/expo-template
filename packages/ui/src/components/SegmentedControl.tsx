import React, { useCallback, useRef } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { SegmentedControl as NativeSegmentedControl } from "@expo/ui/community/segmented-control";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";

/**
 * SegmentedControl — a horizontal single-select control backed by the
 * platform's native segmented control via
 * `@expo/ui/community/segmented-control`:
 *
 *   - iOS:     SwiftUI segmented `Picker` (system-styled).
 *   - Android: a Material segmented control, accent-tinted via `tintColor`.
 *   - Web:     the vendored `@react-native-segmented-control/segmented-control`
 *              JS implementation, accent-tinted via `tintColor`.
 *
 * The API is value-based to match the rest of the design system (RadioGroup /
 * Tabs / Select): pass the segment `values` plus a controlled `value` (or
 * `defaultValue` for uncontrolled), and read selections back as the chosen
 * string. A light haptic fires on each change, matching Slider / Switch.
 *
 * Theming: the accent color tints the selected segment on Android and web. iOS
 * draws the system segmented control, which ignores a custom tint — pass
 * `appearance` to force light/dark there.
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
  /** Force a color scheme irrespective of the system theme. */
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
        hapticLight();
      }
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange, values],
  );

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

export { SegmentedControl };
