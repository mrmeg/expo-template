import type { ComponentType } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

/**
 * SPIKE. The subset of CSS transition style props that react-native-web (real
 * CSS) and Reanimated 4's CSS transitions (native, UI thread) both accept with
 * the same names and value shapes:
 *
 * - `transitionProperty`: style prop names. Keep to single-word props
 *   (`opacity`, `transform`, `height`): web wants `background-color`, native
 *   wants `backgroundColor`.
 * - `transitionDuration` / `transitionDelay`: `"200ms"` strings (web rejects
 *   bare numbers, Reanimated takes both).
 * - `transitionTimingFunction`: the CSS keywords only. Reanimated does not
 *   parse `"cubic-bezier(...)"` strings; it wants its `cubicBezier()` helper.
 */
export type MotionStyle = ViewStyle & {
  transitionProperty?: "opacity" | "transform" | "height" | ("opacity" | "transform" | "height")[];
  transitionDuration?: `${number}ms`;
  transitionDelay?: `${number}ms`;
  transitionTimingFunction?: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
};

export type MotionViewProps = Omit<ViewProps, "style"> & {
  style?: StyleProp<MotionStyle>;
};

/**
 * Web (and the type-level default): a plain `View`. react-native-web compiles
 * the `transition*` props to CSS, so the browser runs the transition and no
 * animation library is in the web bundle. `MotionView.native.tsx` is the
 * Reanimated half.
 */
export const MotionView = View as unknown as ComponentType<MotionViewProps>;
