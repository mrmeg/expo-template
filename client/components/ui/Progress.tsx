import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";

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
  const [containerWidth, setContainerWidth] = useState(0);
  const clamped = Math.min(100, Math.max(0, value));
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    if (containerWidth === 0) return;
    const target = (clamped / 100) * containerWidth;
    animatedWidth.value = withTiming(target, {
      duration: reduceMotion ? 0 : 300,
    });
  }, [clamped, containerWidth, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
  }));

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Reanimated.View
        style={StyleSheet.flatten([
          {
            height,
            borderRadius,
            backgroundColor: fillColor,
          },
          animatedStyle,
        ])}
      />
    </View>
  );
}

// ============================================================================
// Indeterminate Fill (RN Animated loop — follows Skeleton.tsx pattern)
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
  const opacity = useRef(new Animated.Value(reduceMotion ? 0.7 : 0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={{
        width: "40%",
        height,
        borderRadius,
        backgroundColor: fillColor,
        opacity,
      }}
    />
  );
}
