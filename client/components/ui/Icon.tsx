import * as React from "react";
import { StyleProp, ViewStyle, View } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { Feather } from "@expo/vector-icons";
import type { Theme } from "@/client/constants/colors";

/**
 * Theme color names that can be used as shortcuts
 * Only includes colors that actually exist in the theme
 */
export type ThemeColorName =
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "muted"
  | "destructive"
  | "success"
  | "warning"
  | "text"
  | "textDim";

const THEME_COLOR_KEYS: readonly ThemeColorName[] = [
  "primary", "primaryForeground", "secondary", "muted",
  "destructive", "success", "warning", "text", "textDim",
] as const;

function resolveIconColor(color: string | ThemeColorName | undefined, themeColors: Theme["colors"]): string {
  if (!color) return themeColors.text;
  if (THEME_COLOR_KEYS.includes(color as ThemeColorName)) {
    return themeColors[color as ThemeColorName];
  }
  return color;
}

export type IconName = React.ComponentProps<typeof Feather>["name"];

export interface IconProps {
  /**
   * The icon name to render (Feather icons)
   */
  name: IconName;
  /**
   * Size of the icon in pixels
   */
  size?: number;
  /**
   * Icon color - can be a hex color or a theme color name
   * Defaults to theme's text color
   */
  color?: string | ThemeColorName;
  /**
   * Additional styles for positioning, transforms, etc.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * When true, hides the icon from the accessibility tree.
   * Use for purely decorative icons that add no information.
   * @default false
   */
  decorative?: boolean;
}

/**
 * Universal Icon Component
 * Wraps @expo/vector-icons Feather with theme integration and style support
 *
 * Usage:
 * ```tsx
 * <Icon name="check" color="primary" size={16} />
 * <Icon name="calendar" color="#FF0000" size={24} />
 * <Icon name="terminal" style={{ marginRight: 8 }} />
 * ```
 */
export function Icon({
  name,
  size = 24,
  color,
  style,
  decorative = false,
}: IconProps) {
  const { theme } = useTheme();
  const iconColor = resolveIconColor(color, theme.colors);

  // Wrap in View with pointerEvents="none" to prevent icons from
  // intercepting touches when used inside TouchableOpacity on iOS
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
      <Feather
        name={name}
        size={size}
        color={iconColor}
      />
    </View>
  );
}
