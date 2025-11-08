import React, { useEffect, useState } from "react";
import { Animated, ViewProps, Easing } from "react-native";

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
   * Animation duration in milliseconds for exit animation
   * @default 150
   */
  exitDuration?: number;
  /**
   * Delay before starting the enter animation (in milliseconds)
   * Useful for staggered animations
   * @default 0
   */
  delay?: number;
}

/**
 * Cross-Platform Animated View Component
 * Uses React Native's Animated API for consistent behavior across iOS, Android, and Web
 *
 * Features:
 * - Multiple animation types (fade, fadeSlideUp, fadeSlideDown, scale)
 * - Configurable enter/exit durations
 * - Optional delay for staggered animations
 * - Automatic cleanup on unmount
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
 * <AnimatedView type="fade" delay={100}>
 *   {children}
 * </AnimatedView>
 * ```
 */
export function AnimatedView({
  children,
  type = "fade",
  enterDuration = 200,
  exitDuration = 150,
  delay = 0,
  style,
  ...props
}: AnimatedViewProps) {
  // Create animation state
  const [animationState] = useState({
    fadeAnim: new Animated.Value(0),
    translateAnim: new Animated.Value(0),
    scaleAnim: new Animated.Value(0),
  });

  // Trigger animation on mount
  useEffect(() => {
    // Reset animations based on type
    if (type === "fade") {
      animationState.fadeAnim.setValue(0);
    } else if (type === "fadeSlideUp") {
      animationState.fadeAnim.setValue(0);
      animationState.translateAnim.setValue(20); // Start 20px below
    } else if (type === "fadeSlideDown") {
      animationState.fadeAnim.setValue(0);
      animationState.translateAnim.setValue(-20); // Start 20px above
    } else if (type === "scale") {
      animationState.fadeAnim.setValue(0);
      animationState.scaleAnim.setValue(0.8); // Start at 80% scale
    }

    // Start enter animation after delay
    const timer = setTimeout(() => {
      if (type === "fade") {
        Animated.timing(animationState.fadeAnim, {
          toValue: 1,
          duration: enterDuration,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      } else if (type === "fadeSlideUp" || type === "fadeSlideDown") {
        Animated.parallel([
          Animated.timing(animationState.fadeAnim, {
            toValue: 1,
            duration: enterDuration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animationState.translateAnim, {
            toValue: 0,
            duration: enterDuration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else if (type === "scale") {
        Animated.parallel([
          Animated.timing(animationState.fadeAnim, {
            toValue: 1,
            duration: enterDuration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(animationState.scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, delay);

    // Cleanup: fade out on unmount
    return () => {
      clearTimeout(timer);
      Animated.timing(animationState.fadeAnim, {
        toValue: 0,
        duration: exitDuration,
        useNativeDriver: true,
      }).start();
    };
  }, [animationState, enterDuration, exitDuration, delay, type]);

  // Build animated style based on type
  const getAnimatedStyle = () => {
    if (type === "fade") {
      return {
        opacity: animationState.fadeAnim,
      };
    } else if (type === "fadeSlideUp" || type === "fadeSlideDown") {
      return {
        opacity: animationState.fadeAnim,
        transform: [{ translateY: animationState.translateAnim }],
      };
    } else if (type === "scale") {
      return {
        opacity: animationState.fadeAnim,
        transform: [{ scale: animationState.scaleAnim }],
      };
    }
    return {};
  };

  return (
    <Animated.View style={[style, getAnimatedStyle()]} {...props}>
      {children}
    </Animated.View>
  );
}
