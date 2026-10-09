import React from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { useThemeStore, type ThemePreference } from "../state/themeStore";
import { hapticSelection } from "../lib/haptics";
import { spacing } from "../constants/spacing";
import { interaction } from "../constants/interaction";
import { Icon, type IconName } from "./Icon";
import { StyledText } from "./StyledText";
import { useItemControlLabel } from "./Item";

/**
 * ThemeSelector — a compact System / Light / Dark switch wired to the kit's
 * theme store.
 *
 * Icon-only by default (about 116pt wide), sized to sit in an `Item` row's
 * `ItemActions` so the whole appearance setting is one row instead of three.
 * Pass `showLabels` for a full-width control with text under a group title.
 *
 * Reads and writes `useThemeStore` unless `value` / `onValueChange` are
 * passed. The package has no i18n: pass translated `labels`, which become the
 * visible text (with `showLabels`) and each segment's accessibility label.
 *
 * Drawn in RN on every platform (no native segmented control), so the icons
 * render on iOS and Android too and the server render matches the client: the
 * store boots `system` on both sides until the persisted preference loads.
 *
 * @example
 * ```tsx
 * <Item>
 *   <ItemContent>
 *     <ItemTitle>Theme</ItemTitle>
 *   </ItemContent>
 *   <ItemActions>
 *     <ThemeSelector />
 *   </ItemActions>
 * </Item>
 * ```
 */

export type ThemeSelectorLabels = Record<ThemePreference, string>;

export interface ThemeSelectorProps {
  /** Controlled preference. Defaults to the theme store's `userTheme`. */
  value?: ThemePreference;
  /** Called with the chosen preference. Defaults to the theme store's `setTheme`. */
  onValueChange?: (value: ThemePreference) => void;
  /** Segment labels, for screen readers and `showLabels`. @default English */
  labels?: Partial<ThemeSelectorLabels>;
  /** Show the label beside each icon and stretch to the parent's width. @default false */
  showLabels?: boolean;
  /** Disable interaction. @default false */
  disabled?: boolean;
  /** Names the group for screen readers. Inside an `Item`, defaults to the row title. */
  accessibilityLabel?: string;
  /** Style override for the track. */
  style?: StyleProp<ViewStyle>;
  /** Test id for the track; segments get `${testID}-${value}`. @default "theme-selector" */
  testID?: string;
}

const DEFAULT_LABELS: ThemeSelectorLabels = { system: "System", light: "Light", dark: "Dark" };

const OPTIONS: { value: ThemePreference; icon: IconName }[] = [
  // A phone reads as "device" on native; web visitors are mostly on a desktop.
  { value: "system", icon: Platform.OS === "web" ? "monitor" : "smartphone" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

const TRACK_HEIGHT = 32;
const TRACK_INSET = 2;
const ICON_SEGMENT_WIDTH = 36;

function ThemeSelector({
  value,
  onValueChange,
  labels,
  showLabels = false,
  disabled = false,
  accessibilityLabel,
  style,
  testID = "theme-selector",
}: ThemeSelectorProps) {
  const rowLabel = useItemControlLabel({ accessibilityLabel });
  const { theme } = useTheme();
  const userTheme = useThemeStore((state) => state.userTheme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const selected = value ?? userTheme;
  const text = { ...DEFAULT_LABELS, ...labels };

  const select = (next: ThemePreference) => {
    if (next === selected) return;
    hapticSelection();
    (onValueChange ?? setTheme)(next);
  };

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      {...rowLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.track,
        { backgroundColor: theme.colors.muted, opacity: disabled ? interaction.disabledOpacity : 1 },
        showLabels ? styles.trackStretch : styles.trackCompact,
        style,
      ]}
    >
      {OPTIONS.map((option) => (
        <Segment
          key={option.value}
          testID={`${testID}-${option.value}`}
          icon={option.icon}
          label={text[option.value]}
          showLabel={showLabels}
          selected={option.value === selected}
          disabled={disabled}
          onPress={() => select(option.value)}
        />
      ))}
    </View>
  );
}

interface SegmentProps {
  testID: string;
  icon: IconName;
  label: string;
  showLabel: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

function Segment({ testID, icon, label, showLabel, selected, disabled, onPress }: SegmentProps) {
  const { theme, getFocusRingStyle } = useTheme();
  const focus = useFocusVisible();
  const color = selected ? theme.colors.foreground : theme.colors.mutedForeground;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      // The track is 32pt; reach the 44pt touch target vertically.
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.segment,
        showLabel ? styles.segmentStretch : styles.segmentCompact,
        selected && { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
        pressed && !selected && { opacity: interaction.pressedOpacity },
        Platform.OS === "web" && {
          cursor: (disabled ? "not-allowed" : "pointer") as any,
          outlineStyle: "none" as any,
        },
        focus.focused && !disabled && getFocusRingStyle(),
      ]}
    >
      <Icon name={icon} size={16} color={color} decorative />
      {showLabel && (
        <StyledText
          selectable={false}
          numberOfLines={1}
          fontWeight="medium"
          style={{ fontSize: 13, lineHeight: 18, color }}
        >
          {label}
        </StyledText>
      )}
    </Pressable>
  );
}

const styles = /*#__PURE__*/ StyleSheet.create({
  track: {
    flexDirection: "row",
    height: TRACK_HEIGHT,
    padding: TRACK_INSET,
    borderRadius: spacing.radiusMd,
  },
  trackCompact: {
    alignSelf: "flex-start",
  },
  trackStretch: {
    alignSelf: "stretch",
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: spacing.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  segmentCompact: {
    width: ICON_SEGMENT_WIDTH,
  },
  segmentStretch: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
});

export { ThemeSelector };
