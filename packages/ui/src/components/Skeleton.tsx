import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { shouldUseNativeDriver } from "../lib/animations";
import { spacing } from "../constants/spacing";
import type { Theme } from "../constants/colors";

// ============================================================================
// Base Skeleton
// ============================================================================

export interface SkeletonProps {
  /** Width of the skeleton element */
  width?: number | `${number}%`;
  /** Height of the skeleton element */
  height?: number;
  /** Border radius (defaults to radiusMd) */
  borderRadius?: number;
  /** Render as a circle (overrides borderRadius) */
  circle?: boolean;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton Component
 *
 * A placeholder loading element with a pulsing shimmer animation.
 * Respects reduced-motion accessibility settings.
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} />
 * <Skeleton width={40} height={40} circle />
 * ```
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = spacing.radiusMd,
  circle = false,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 0.6 : 0.3)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.6);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  const resolvedSize = circle ? (typeof height === "number" ? height : 40) : undefined;

  return (
    <Animated.View
      style={[
        {
          width: circle ? resolvedSize : width,
          height: circle ? resolvedSize : height,
          borderRadius: circle ? (resolvedSize! / 2) : borderRadius,
          backgroundColor: theme.colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ============================================================================
// SkeletonText
// ============================================================================

export interface SkeletonTextProps {
  /** Number of text lines to render */
  lines?: number;
  /** Height of each line */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * SkeletonText renders N horizontal bars simulating text.
 * The last line is rendered at 60% width for a natural look.
 */
export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = spacing.sm,
  style,
}: SkeletonTextProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={lineHeight}
        />
      ))}
    </View>
  );
}

// ============================================================================
// SkeletonAvatar
// ============================================================================

export interface SkeletonAvatarProps {
  /** Diameter of the circular avatar placeholder */
  size?: number;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * SkeletonAvatar is a circular skeleton shorthand.
 */
export function SkeletonAvatar({ size = 40, style }: SkeletonAvatarProps) {
  return <Skeleton width={size} height={size} circle style={style} />;
}

// ============================================================================
// SkeletonCard
// ============================================================================

export interface SkeletonCardProps {
  /** Whether to show an image placeholder area */
  showImage?: boolean;
  /** Image placeholder height */
  imageHeight?: number;
  /** Whether to show an avatar row */
  showAvatar?: boolean;
  /** Number of text lines */
  textLines?: number;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * SkeletonCard composes an image placeholder, optional avatar row,
 * and text lines in a Card-styled wrapper.
 */
export function SkeletonCard({
  showImage = true,
  imageHeight = 140,
  showAvatar = true,
  textLines = 3,
  style,
}: SkeletonCardProps) {
  const { theme } = useTheme();
  const styles = createCardStyles(theme);

  return (
    <View style={[styles.card, style]}>
      {showImage && (
        <Skeleton
          width="100%"
          height={imageHeight}
          borderRadius={0}
        />
      )}

      <View style={styles.body}>
        {showAvatar && (
          <View style={styles.avatarRow}>
            <SkeletonAvatar size={36} />
            <View style={styles.avatarText}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
        )}

        <SkeletonText lines={textLines} />
      </View>
    </View>
  );
}

const createCardStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    body: {
      padding: spacing.md,
      gap: spacing.md,
    },
    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    avatarText: {
      flex: 1,
      gap: spacing.xs,
    },
  });
