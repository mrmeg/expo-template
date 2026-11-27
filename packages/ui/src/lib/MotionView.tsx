import { useEffect, useRef, type ComponentRef, type Ref } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { composeRefs } from "./composeRefs";

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

type ViewRef = ComponentRef<typeof View>;

export type MotionViewProps = Omit<ViewProps, "style"> & {
  style?: StyleProp<MotionStyle>;
  ref?: Ref<ViewRef>;
  /**
   * One of this view's own transitions finished (not a descendant's, and not
   * one that was interrupted). The platform's signal that an exit has really
   * run, which a timer started at render time cannot know.
   */
  onTransitionEnd?: () => void;
};

/**
 * Web (and the type-level default): a plain `View`. react-native-web compiles
 * the `transition*` props to CSS, so the browser runs the transition and no
 * animation library is in the web bundle. `MotionView.native.tsx` is the
 * Reanimated half.
 *
 * react-native-web does not forward `onTransitionEnd`, so the listener goes on
 * the DOM node. `transitionend` bubbles: a descendant's hover transition would
 * otherwise read as this view's exit finishing.
 */
export function MotionView({ onTransitionEnd, ref, style, ...props }: MotionViewProps) {
  const nodeRef = useRef<ViewRef>(null);

  useEffect(() => {
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node || !onTransitionEnd || typeof node.addEventListener !== "function") return;
    const handle = (event: Event) => {
      if (event.target === node) onTransitionEnd();
    };
    node.addEventListener("transitionend", handle);
    return () => node.removeEventListener("transitionend", handle);
  }, [onTransitionEnd]);

  return <View ref={composeRefs(nodeRef, ref)} style={style as StyleProp<ViewStyle>} {...props} />;
}
