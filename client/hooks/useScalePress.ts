import { useCallback } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { hapticLight } from "@/client/lib/haptics";

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
 * Hook for press-feedback scale animation using Reanimated.
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
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    if (haptic) hapticLight();

    if (reduceMotion) {
      scale.value = withTiming(scaleTo, { duration: 0 });
    } else {
      scale.value = withSpring(scaleTo, { damping, stiffness });
    }
  }, [disabled, haptic, reduceMotion, scale, scaleTo, damping, stiffness]);

  const onPressOut = useCallback(() => {
    if (disabled) return;

    if (reduceMotion) {
      scale.value = withTiming(1, { duration: 0 });
    } else {
      scale.value = withSpring(1, { damping, stiffness });
    }
  }, [disabled, reduceMotion, scale, damping, stiffness]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return {
    animatedStyle,
    pressHandlers: { onPressIn, onPressOut },
    scale,
  };
}
