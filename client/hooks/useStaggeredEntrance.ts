import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  useReducedMotion,
  Easing,
} from "react-native-reanimated";

type EntranceType = "fade" | "fadeSlideUp" | "fadeSlideDown" | "scale";

interface StaggeredEntranceOptions {
  /**
   * Type of entrance animation
   * @default "fadeSlideUp"
   */
  type?: EntranceType;
  /**
   * Delay before this item starts animating (ms).
   * Use index * staggerMs for staggered lists.
   * @default 0
   */
  delay?: number;
  /**
   * Duration of the entrance animation (ms)
   * @default 200
   */
  duration?: number;
  /**
   * Slide distance in pixels (for fadeSlideUp/fadeSlideDown)
   * @default 8
   */
  slideDistance?: number;
  /**
   * Initial scale (for scale type)
   * @default 0.95
   */
  initialScale?: number;
}

/**
 * Hook for entrance animations with stagger support using Reanimated.
 *
 * Returns an animated style to apply to an Animated.View.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * // Single entrance
 * const entranceStyle = useStaggeredEntrance({ type: "fadeSlideUp" });
 * <Animated.View style={entranceStyle}>...</Animated.View>
 *
 * // Staggered list
 * {items.map((item, i) => {
 *   const style = useStaggeredEntrance({ delay: i * 50 });
 *   return <Animated.View key={item.id} style={style}>...</Animated.View>;
 * })}
 * ```
 */
export function useStaggeredEntrance(options: StaggeredEntranceOptions = {}) {
  const {
    type = "fadeSlideUp",
    delay = 0,
    duration = 200,
    slideDistance = 8,
    initialScale = 0.95,
  } = options;

  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(
    reduceMotion
      ? 0
      : type === "fadeSlideUp"
        ? slideDistance
        : type === "fadeSlideDown"
          ? -slideDistance
          : 0
  );
  const scale = useSharedValue(
    reduceMotion ? 1 : type === "scale" ? initialScale : 1
  );

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
      return;
    }

    const timingConfig = {
      duration,
      easing: Easing.out(Easing.cubic),
    };

    opacity.value = withDelay(delay, withTiming(1, timingConfig));

    if (type === "fadeSlideUp" || type === "fadeSlideDown") {
      translateY.value = withDelay(delay, withTiming(0, timingConfig));
    }

    if (type === "scale") {
      scale.value = withDelay(
        delay,
        withSpring(1, { damping: 14, stiffness: 250 })
      );
    }
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (type === "fade") {
      return { opacity: opacity.value };
    }
    if (type === "fadeSlideUp" || type === "fadeSlideDown") {
      return {
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
      };
    }
    // scale
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  return animatedStyle;
}

/**
 * Convenience constant: default stagger delay between items (ms)
 */
export const STAGGER_DELAY = 30;
