import type { ComponentType } from "react";
import Animated from "react-native-reanimated";
import type { MotionViewProps } from "./MotionView";

export type { MotionStyle, MotionViewProps } from "./MotionView";

type ReanimatedViewProps = Omit<MotionViewProps, "onTransitionEnd"> & {
  onCSSTransitionEnd?: () => void;
};

const AnimatedView = Animated.View as unknown as ComponentType<ReanimatedViewProps>;

/**
 * SPIKE. Native half: Reanimated's `Animated.View` reads the same
 * `transition*` style props as CSS transitions and runs them on the UI thread.
 * No worklets or shared values are written here, so nothing in this package
 * needs the worklets Babel plugin.
 */
export function MotionView({ onTransitionEnd, ...props }: MotionViewProps) {
  return <AnimatedView onCSSTransitionEnd={onTransitionEnd} {...props} />;
}
