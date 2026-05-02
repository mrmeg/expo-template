import React from "react";
import { ViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { useStaggeredEntrance } from "../hooks/useStaggeredEntrance";

/**
 * Animation type options
 */
export type AnimationType = "fade" | "fadeSlideUp" | "fadeSlideDown" | "scale";

interface AnimatedViewProps extends ViewProps {
  children: React.ReactNode;
  /**
   * Type of animation to use
   * @default "fade"
   */
  type?: AnimationType;
  /**
   * Animation duration in milliseconds for enter animation
   * @default 200
   */
  enterDuration?: number;
  /**
   * Delay before starting the enter animation (in milliseconds)
   * Useful for staggered animations
   * @default 0
   */
  delay?: number;
}

/**
 * Cross-Platform Animated View Component
 * Uses Reanimated for smooth 60fps animations on all platforms
 *
 * Features:
 * - Multiple animation types (fade, fadeSlideUp, fadeSlideDown, scale)
 * - Configurable enter duration
 * - Optional delay for staggered animations
 * - Respects reduced motion accessibility preference
 *
 * Usage:
 * ```tsx
 * // Simple fade
 * <AnimatedView>
 *   {children}
 * </AnimatedView>
 *
 * // Fade with slide up
 * <AnimatedView type="fadeSlideUp">
 *   {children}
 * </AnimatedView>
 *
 * // With delay (for staggered lists)
 * <AnimatedView type="fadeSlideUp" delay={100}>
 *   {children}
 * </AnimatedView>
 * ```
 */
export function AnimatedView({
  children,
  type = "fade",
  enterDuration = 200,
  delay = 0,
  style,
  ...props
}: AnimatedViewProps) {
  const entranceStyle = useStaggeredEntrance({
    type,
    delay,
    duration: enterDuration,
  });

  return (
    <Animated.View style={[style, entranceStyle]} {...props}>
      {children}
    </Animated.View>
  );
}
