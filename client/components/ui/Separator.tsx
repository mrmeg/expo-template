import React from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import * as SeparatorPrimitive from "@rn-primitives/separator";

/**
 * Size variants for Separator thickness
 */
export type SeparatorSize = "sm" | "md" | "lg";

/**
 * Visual variants for Separator
 */
export type SeparatorVariant = "default" | "muted" | "primary";

const SIZE_CONFIGS: Record<SeparatorSize, number> = {
  sm: 1,
  md: 2,
  lg: 4,
};

export interface SeparatorProps extends Omit<SeparatorPrimitive.RootProps, "style"> {
  /**
   * Orientation of the separator
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Whether the separator is purely decorative (no semantic meaning)
   * @default true
   */
  decorative?: boolean;
  /**
   * Size variant controlling thickness
   * @default "sm"
   */
  size?: SeparatorSize;
  /**
   * Visual variant controlling color
   * @default "default"
   */
  variant?: SeparatorVariant;
  /**
   * Custom style override (uses StyleSheet.flatten for web compatibility)
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Margin around the separator
   * For horizontal: vertical margin, for vertical: horizontal margin
   * @default spacing.md (16)
   */
  margin?: number;
}

/**
 * Enhanced Separator Component
 *
 * A visual or semantic distinction between content sections.
 * Supports both horizontal and vertical orientations with
 * theme-aware styling.
 *
 * Features:
 * - Orientation (horizontal, vertical)
 * - Size variants (sm, md, lg)
 * - Visual variants (default, muted, primary)
 * - Configurable margin
 * - Theme-aware colors
 * - Full accessibility support
 *
 * Usage:
 * ```tsx
 * // Basic horizontal separator
 * <Separator />
 *
 * // Vertical separator
 * <Separator orientation="vertical" />
 *
 * // With size variant
 * <Separator size="lg" />
 *
 * // Primary colored separator
 * <Separator variant="primary" />
 *
 * // Muted separator with custom margin
 * <Separator variant="muted" margin={spacing.lg} />
 *
 * // Non-decorative separator (has semantic meaning)
 * <Separator decorative={false} />
 *
 * // Custom style
 * <Separator style={{ opacity: 0.5 }} />
 * ```
 */
function Separator({
  orientation = "horizontal",
  decorative = true,
  size = "sm",
  variant = "default",
  style: styleOverride,
  margin = spacing.md,
  ...props
}: SeparatorProps) {
  const { theme } = useTheme();

  // Determine color based on variant
  const getColor = () => {
    switch (variant) {
      case "primary":
        return theme.colors.primary;
      case "muted":
        return theme.colors.muted;
      case "default":
      default:
        return theme.colors.border;
    }
  };

  const thickness = SIZE_CONFIGS[size];
  const color = getColor();

  // Flatten style override for web compatibility
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  const isHorizontal = orientation === "horizontal";

  return (
    <SeparatorPrimitive.Root
      {...props}
      orientation={orientation}
      decorative={decorative}
      style={{
        backgroundColor: color,
        ...(isHorizontal
          ? {
            height: thickness,
            width: "100%",
            marginVertical: margin,
          }
          : {
            width: thickness,
            height: "100%",
            marginHorizontal: margin,
          }),
        ...(flattenedStyle || {}),
      }}
    />
  );
}

export { Separator };
