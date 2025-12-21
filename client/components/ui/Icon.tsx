import * as React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import type { LucideIcon } from "lucide-react-native";

/**
 * Theme color names that can be used as shortcuts
 * Only includes colors that actually exist in the theme
 */
export type ThemeColorName =
  | "primary"
  | "secondary"
  | "neutral"
  | "error"
  | "success"
  | "warning"
  | "textPrimary";

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
   * Defaults to theme's textPrimary
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
 * import { Check } from 'lucide-react-native';
 *
 * // With theme color name
 * <Icon as={Check} color="primary" size={16} />
 *
 * // With custom color
 * <Icon as={Check} color="#FF0000" size={24} />
 *
 * // With style
 * <Icon as={Check} style={{ marginRight: 8 }} />
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
      return theme.colors.textPrimary;
    }

    // Check if it's a theme color name
    const themeColorNames: Record<ThemeColorName, string> = {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      neutral: theme.colors.neutral,
      error: theme.colors.error,
      success: theme.colors.success,
      warning: theme.colors.warning,
      textPrimary: theme.colors.textPrimary,
    };

    // If it's a known theme color, use it
    if (color in themeColorNames) {
      return themeColorNames[color as ThemeColorName];
    }

    // Otherwise, treat it as a custom color string
    return color;
  };

  const iconColor = getIconColor();

  return (
    <LucideIconComponent
      size={size}
      strokeWidth={strokeWidth}
      color={iconColor}
      style={style}
    />
  );
}
