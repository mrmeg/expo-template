import React from "react";
import { View, ViewStyle, StyleSheet, Platform } from "react-native";
import { useDimensions } from "@/hooks/useDimensions";

/**
 * Preset width options for common responsive breakpoints
 */
export type MaxWidthPreset = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const MAX_WIDTH_PRESETS: Record<MaxWidthPreset, number | "100%"> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  full: "100%",
};

interface MaxWidthContainerProps {
  children: React.ReactNode;
  /**
   * Maximum width in pixels (custom number)
   * If preset is provided, this is ignored
   */
  maxWidth?: number;
  /**
   * Preset width option (sm, md, lg, xl, 2xl, full)
   * Overrides maxWidth if provided
   */
  preset?: MaxWidthPreset;
  /**
   * Additional styles
   */
  style?: ViewStyle;
  /**
   * Whether to center the container horizontally
   * @default true
   */
  centered?: boolean;
}

/**
 * Max Width Container Component
 * Constrains content width on large screens (web only by default)
 *
 * Features:
 * - Preset width options (sm, md, lg, xl, 2xl, full)
 * - Custom max width
 * - Automatic centering
 * - Platform-aware (only applies on web by default)
 *
 * Usage:
 * ```tsx
 * // With preset
 * <MaxWidthContainer preset="lg">
 *   {children}
 * </MaxWidthContainer>
 *
 * // With custom width
 * <MaxWidthContainer maxWidth={1200}>
 *   {children}
 * </MaxWidthContainer>
 *
 * // Full width (no constraint)
 * <MaxWidthContainer preset="full">
 *   {children}
 * </MaxWidthContainer>
 * ```
 */
export function MaxWidthContainer({
  children,
  maxWidth = 1280,
  preset,
  style,
  centered = true,
}: MaxWidthContainerProps) {
  const { width } = useDimensions();

  // Determine final max width
  const finalMaxWidth = preset ? MAX_WIDTH_PRESETS[preset] : maxWidth;

  // Only apply max-width on web and large screens
  const shouldApplyMaxWidth =
    Platform.OS === "web" &&
    finalMaxWidth !== "100%" &&
    width > (finalMaxWidth as number);

  return (
    <View
      style={[
        styles.container,
        shouldApplyMaxWidth && {
          maxWidth: finalMaxWidth as number,
          ...(centered && {
            alignSelf: "center",
            width: "100%",
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
