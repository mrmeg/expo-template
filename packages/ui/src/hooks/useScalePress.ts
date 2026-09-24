import { useCallback, useMemo } from "react";
import { Animated } from "react-native";
import { hapticLight, hapticPress } from "../lib/haptics";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { useReducedMotion } from "./useReduceMotion";

interface ScalePressOptions {
  /**
   * Scale value when pressed (1 = no change, 0.97 = subtle, 0.93 = more pronounced)
   * @default 0.97
   */
  scaleTo?: number;
  /**
   * Haptic on press-in. `"setting"` follows the provider-level `haptics`
   * setting (a light tap only under `"all"`); `true` always taps; `false`
   * never does.
   * @default "setting"
   */
  haptic?: boolean | "setting";
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
 * Returns an animated style and onPressIn/onPressOut handlers to spread onto a
 * Pressable. Under reduced motion the scale stays at 1 — the pressed opacity
 * the components layer on carries the feedback instead.
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
    haptic = "setting",
    damping = 20,
    stiffness = 300,
    disabled = false,
  } = options;

  const reduceMotion = useReducedMotion();
  const scale = useAnimatedValue(1);

  const animateTo = useCallback(
    (toValue: number) => {
      scale.stopAnimation();

      // Reduced motion: no scale change at all (not even an instant jump), so
      // the surface stays still while its pressed opacity does the signalling.
      if (reduceMotion) {
        scale.setValue(1);
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
    if (haptic === true) hapticLight();
    else if (haptic === "setting") hapticPress();
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
