import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "./useReduceMotion";

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
 * Hook for entrance animations with stagger support using React Native Animated.
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
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(
    reduceMotion
      ? 0
      : type === "fadeSlideUp"
        ? slideDistance
        : type === "fadeSlideDown"
          ? -slideDistance
          : 0
  )).current;
  const scale = useRef(new Animated.Value(
    reduceMotion ? 1 : type === "scale" ? initialScale : 1
  )).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(
      type === "fadeSlideUp"
        ? slideDistance
        : type === "fadeSlideDown"
          ? -slideDistance
          : 0
    );
    scale.setValue(type === "scale" ? initialScale : 1);

    const timingConfig = {
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    };

    const animations = [
      Animated.timing(opacity, {
        toValue: 1,
        ...timingConfig,
      }),
    ];

    if (type === "fadeSlideUp" || type === "fadeSlideDown") {
      animations.push(
        Animated.timing(translateY, {
          toValue: 0,
          ...timingConfig,
        })
      );
    }

    if (type === "scale") {
      animations.push(
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 250,
          useNativeDriver: true,
        })
      );
    }

    const animation = delay > 0
      ? Animated.sequence([Animated.delay(delay), Animated.parallel(animations)])
      : Animated.parallel(animations);

    animation.start();
    return () => animation.stop();
  }, [delay, duration, initialScale, opacity, reduceMotion, scale, slideDistance, translateY, type]);

  const animatedStyle = useMemo(() => {
    if (type === "fade") {
      return { opacity };
    }
    if (type === "fadeSlideUp" || type === "fadeSlideDown") {
      return {
        opacity,
        transform: [{ translateY }],
      };
    }
    // scale
    return {
      opacity,
      transform: [{ scale }],
    };
  }, [opacity, scale, translateY, type]);

  return animatedStyle;
}

/**
 * Convenience constant: default stagger delay between items (ms)
 */
export const STAGGER_DELAY = 30;
