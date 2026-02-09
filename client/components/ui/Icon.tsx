import * as React from "react";
import { StyleProp, ViewStyle, View } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

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

/** Icons that use MaterialCommunityIcons (not available in Feather) */
const mciIconSet = new Set<string>([
  "cursor-default-click",
  "cursor-text",
  "clipboard-list",
  "bug",
  "crown",
  "shield-check",
  "shield-alert",
  "folder-open",
  "link-off",
]);

type MCIIconName =
  | "cursor-default-click"
  | "cursor-text"
  | "clipboard-list"
  | "bug"
  | "crown"
  | "shield-check"
  | "shield-alert"
  | "folder-open"
  | "link-off";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

export type IconName = FeatherIconName | MCIIconName;

export interface IconProps {
  /**
   * The icon name to render (Feather or MaterialCommunityIcons)
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
}

/**
 * Universal Icon Component
 * Wraps @expo/vector-icons with theme integration and style support
 *
 * Uses Feather icons by default, falls back to MaterialCommunityIcons
 * for icons not available in Feather.
 *
 * Usage:
 * ```tsx
 * <Icon name="check" color="primary" size={16} />
 * <Icon name="calendar" color="#FF0000" size={24} />
 * <Icon name="bug" style={{ marginRight: 8 }} />
 * ```
 */
export function Icon({
  name,
  size = 24,
  color,
  style,
}: IconProps) {
  const { theme } = useTheme();

  // Determine if color is a theme color name or a custom color
  const getIconColor = (): string => {
    if (!color) {
      return theme.colors.text;
    }

    // Check if it's a theme color name
    const themeColorNames: Record<ThemeColorName, string> = {
      primary: theme.colors.primary,
      primaryForeground: theme.colors.primaryForeground,
      secondary: theme.colors.secondary,
      muted: theme.colors.muted,
      destructive: theme.colors.destructive,
      success: theme.colors.success,
      warning: theme.colors.warning,
      text: theme.colors.text,
      textDim: theme.colors.textDim,
    };

    // If it's a known theme color, use it
    if (color in themeColorNames) {
      return themeColorNames[color as ThemeColorName];
    }

    // Otherwise, treat it as a custom color string
    return color;
  };

  const iconColor = getIconColor();

  // Wrap in View with pointerEvents="none" to prevent icons from
  // intercepting touches when used inside TouchableOpacity on iOS
  return (
    <View pointerEvents="none" style={style}>
      {mciIconSet.has(name) ? (
        <MaterialCommunityIcons
          name={name as any}
          size={size}
          color={iconColor}
        />
      ) : (
        <Feather
          name={name as FeatherIconName}
          size={size}
          color={iconColor}
        />
      )}
    </View>
  );
}
