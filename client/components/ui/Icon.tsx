import * as React from "react";
import { StyleProp, ViewStyle, View } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import type { LucideIcon } from "lucide-react-native";

/**
 * Theme color names that can be used as shortcuts
 * Only includes colors that actually exist in the theme
 */
export type ThemeColorName =
  | "primary"
  | "secondary"
  | "muted"
  | "destructive"
  | "success"
  | "warning"
  | "text"
  | "textDim";

export interface IconProps {
  /**
   * The Lucide icon component to render
   */
  as: LucideIcon;
  /**
   * Size of the icon in pixels
   */
  size?: number;
  /**
   * Stroke width of the icon
   */
  strokeWidth?: number;
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
 * Wraps Lucide React Native icons with theme integration and style support
 *
 * Features:
 * - Theme color shortcuts: color="primary", color="error", etc.
 * - Custom hex colors: color="#FF0000"
 * - Style prop for positioning and transforms
 * - Automatic theme integration
 *
 * Usage:
 * ```tsx
 * import { Check, Calendar } from 'lucide-react-native';
 *
 * <Icon as={Check} color="primary" size={16} />
 * <Icon as={Calendar} color="#FF0000" size={24} />
 * <Icon as={Calendar} style={{ marginRight: 8 }} />
 * ```
 */
export function Icon({
  as: LucideIconComponent,
  size = 24,
  strokeWidth = 2,
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
      <LucideIconComponent
        size={size}
        strokeWidth={strokeWidth}
        color={iconColor}
      />
    </View>
  );
}
