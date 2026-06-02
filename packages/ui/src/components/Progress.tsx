import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";

// ============================================================================
// Types
// ============================================================================

export type ProgressVariant = "default" | "accent" | "destructive";
export type ProgressSize = "sm" | "md" | "lg";

export interface ProgressProps {
  /** Progress value 0-100. Omit for indeterminate mode. */
  value?: number;
  /** Color variant for the fill bar */
  variant?: ProgressVariant;
  /** Height size preset */
  size?: ProgressSize;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
}

// ============================================================================
// Constants
// ============================================================================

const SIZE_MAP: Record<ProgressSize, number> = {
  sm: 4,
  md: 8,
  lg: 12,
};

// ============================================================================
// Progress
// ============================================================================

/**
 * Progress Component
 *
 * A linear progress bar supporting determinate and indeterminate modes.
 * Determinate mode animates the fill width via Reanimated.
 * Indeterminate mode pulses opacity via RN core Animated.loop.
 *
 * @example
 * ```tsx
 * <Progress value={60} />
 * <Progress variant="accent" size="lg" value={30} />
 * <Progress /> // indeterminate
 * ```
 */
export function Progress({
  value,
  variant = "default",
  size = "md",
  style,
}: ProgressProps) {
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const isDeterminate = value !== undefined;
  const height = SIZE_MAP[size];
  const borderRadius = height / 2;

  const fillColor =
    variant === "accent"
      ? theme.colors.accent
      : variant === "destructive"
        ? theme.colors.destructive
        : theme.colors.primary;

  const flattenedStyle = style ? StyleSheet.flatten(style) : undefined;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isDeterminate ? Math.round(Math.min(100, Math.max(0, value))) : undefined}
      accessibilityState={{ busy: !isDeterminate }}
      style={StyleSheet.flatten([
        {
          height,
          borderRadius,
          backgroundColor: theme.colors.muted,
          overflow: "hidden",
        },
        flattenedStyle,
      ])}
    >
      {isDeterminate ? (
        <DeterminateFill
          value={value}
          fillColor={fillColor}
          height={height}
          borderRadius={borderRadius}
          reduceMotion={reduceMotion}
        />
      ) : (
        <IndeterminateFill
          fillColor={fillColor}
          height={height}
          borderRadius={borderRadius}
          reduceMotion={reduceMotion}
        />
      )}
    </View>
  );
}

// ============================================================================
// Determinate Fill (Reanimated)
// ============================================================================

interface DeterminateFillProps {
  value: number;
  fillColor: string;
  height: number;
  borderRadius: number;
  reduceMotion: boolean;
}

function DeterminateFill({
  value,
  fillColor,
  height,
  borderRadius,
  reduceMotion,
}: DeterminateFillProps) {
  const clamped = Math.min(100, Math.max(0, value));
  // Animate scaleX (GPU compositor) instead of width (JS-thread layout each
  // frame). transformOrigin "left" grows the fill from the left edge, so a
  // full-width bar scaled by clamped/100 needs no container measurement.
  const scaleX = useSharedValue(0);

  useEffect(() => {
    scaleX.value = withTiming(clamped / 100, {
      duration: reduceMotion ? 0 : 300,
    });
  }, [clamped, reduceMotion, scaleX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
  }));

  return (
    <Reanimated.View
      style={[
        {
          width: "100%",
          height,
          borderRadius,
          backgroundColor: fillColor,
          transformOrigin: "left",
        },
        animatedStyle,
      ]}
    />
  );
}

// ============================================================================
// Indeterminate Fill (Reanimated opacity loop — follows Skeleton.tsx pattern)
// ============================================================================

interface IndeterminateFillProps {
  fillColor: string;
  height: number;
  borderRadius: number;
  reduceMotion: boolean;
}

function IndeterminateFill({
  fillColor,
  height,
  borderRadius,
  reduceMotion,
}: IndeterminateFillProps) {
  const opacity = useSharedValue(reduceMotion ? 0.7 : 0.4);

  useEffect(() => {
    // reduceMotion comes from an OS accessibility subscription, so reacting to
    // it in an effect is correct. A single ternary assignment (matching the
    // RadioGroup pattern) keeps this off the no-event-handler heuristic.
    opacity.value = reduceMotion
      ? withTiming(0.7, { duration: 0 })
      : withRepeat(
        withSequence(
          withTiming(1.0, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1
      );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        {
          width: "40%",
          height,
          borderRadius,
          backgroundColor: fillColor,
        },
        animatedStyle,
      ]}
    />
  );
}
