import { useCallback, useMemo, useRef } from "react";
import { Animated } from "react-native";
import { hapticLight } from "../lib/haptics";
import { useReducedMotion } from "./useReduceMotion";

interface ScalePressOptions {
  /**
   * Scale value when pressed (1 = no change, 0.97 = subtle, 0.93 = more pronounced)
   * @default 0.97
   */
  scaleTo?: number;
  /**
   * Whether to fire haptic feedback on press
   * @default true
   */
  haptic?: boolean;
  /**
   * Spring damping for bounce-back
   * @default 20
   */
  damping?: number;
  /**
   * Spring stiffness
   * @default 300
   */
  stiffness?: number;
  /**
   * Whether the component is disabled (skips animation)
   * @default false
   */
  disabled?: boolean;
}

/**
 * Hook for press-feedback scale animation using React Native Animated.
 *
 * Returns an animated style and onPressIn/onPressOut handlers to spread onto a Pressable.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * const { animatedStyle, pressHandlers } = useScalePress();
 *
 * <Animated.View style={animatedStyle}>
 *   <Pressable {...pressHandlers} onPress={handlePress}>
 *     <Text>Press me</Text>
 *   </Pressable>
 * </Animated.View>
 * ```
 */
export function useScalePress(options: ScalePressOptions = {}) {
  const {
    scaleTo = 0.97,
    haptic = true,
    damping = 20,
    stiffness = 300,
    disabled = false,
  } = options;

  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      scale.stopAnimation();

      if (reduceMotion) {
        scale.setValue(toValue);
        return;
      }

      Animated.spring(scale, {
        toValue,
        damping,
        stiffness,
        useNativeDriver: true,
      }).start();
    },
    [damping, reduceMotion, scale, stiffness],
  );

  const onPressIn = useCallback(() => {
    if (disabled) return;
    if (haptic) hapticLight();
    animateTo(scaleTo);
  }, [animateTo, disabled, haptic, scaleTo]);

  const onPressOut = useCallback(() => {
    if (disabled) return;
    animateTo(1);
  }, [animateTo, disabled]);

  const animatedStyle = useMemo(() => ({
    transform: [{ scale }],
  }), [scale]);

  return {
    animatedStyle,
    pressHandlers: { onPressIn, onPressOut },
    scale,
  };
}
