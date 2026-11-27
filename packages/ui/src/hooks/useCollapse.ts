import { useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import type { MotionStyle } from "../lib/MotionView";

/**
 * How long past the duration to wait before settling anyway. The clip's
 * transition-end event is the real signal (a timer started at render time
 * unmounted the content with 4-8 px of height still showing on web); this only
 * covers a transition that never reports.
 */
const SETTLE_FALLBACK_MS = 400;
/** How long to wait for the first layout event before opening regardless. */
const MEASURE_FALLBACK_MS = 100;

/**
 * - `closed`: nothing rendered.
 * - `measuring`: mounted at height 0 until the content reports its layout.
 * - `opening`: height is the measured value; the transition runs.
 * - `open`: at rest. Same height, transition duration 0.
 * - `waiting`: two frames with nothing changed but the duration, so a close
 *   starts in step with the open it is swapping with.
 * - `closing`: height 0; the transition runs.
 */
type Stage = "closed" | "measuring" | "opening" | "open" | "waiting" | "closing";

export interface Collapse {
  /** Render the content. `false` once a close has finished. */
  mounted: boolean;
  /** Style for the outer clipping `MotionView`. */
  clipStyle: MotionStyle;
  /** Style for the inner content view, before the caller's own styles. */
  contentStyle: ViewStyle | null;
  /** `onLayout` for the inner content view. */
  onContentLayout: (event: LayoutChangeEvent) => void;
  /** `onTransitionEnd` for the outer clipping `MotionView`. */
  onClipTransitionEnd: () => void;
}

/**
 * SPIKE. Height transition for collapsible content, the same code on iOS,
 * Android and web. What three rounds on devices settled:
 *
 * - The content is absolutely positioned inside the clip and measured there.
 *   In flow, Yoga caps a child's measured height at its parent's (CSS does
 *   not), so the content of a 0-tall clip measured as its padding only.
 * - `transitionProperty` is declared for the clip's whole life. Reanimated
 *   ignores a transition whose property is first declared in the same update
 *   as the value change (a browser honours it), and on Android adding it
 *   together with a first numeric height flashed the closed layout. Only the
 *   duration changes between rest and motion, which both engines honour in
 *   the same update as the value.
 * - At rest the duration is 0, so content that reflows (a web font arriving, a
 *   window resize) resizes the clip at once instead of being clipped while a
 *   200 ms transition catches up.
 * - Stages advance on platform events (the content's layout, the clip's
 *   transition end), with timers only as fallbacks. A timer started at render
 *   time races the UI thread: exits were cut short on Android and web.
 * - An item that is open on the first render is in normal flow until its
 *   first measurement, so server markup is whole and nothing animates at
 *   mount.
 */
export function useCollapse(open: boolean, ms: number): Collapse {
  const [stage, setStageState] = useState<Stage>(open ? "open" : "closed");
  const [measured, setMeasured] = useState<number | null>(null);
  const stageRef = useRef<Stage>(stage);

  const setStage = (next: Stage) => {
    stageRef.current = next;
    setStageState(next);
  };

  // What the caller asked for.
  useEffect(() => {
    const from = stageRef.current;
    if (ms <= 0) {
      setStage(open ? "open" : "closed");
    } else if (open) {
      if (from === "closed") setStage("measuring");
      else if (from !== "open") setStage("opening");
    } else if (from === "open") {
      setStage("waiting");
    } else if (from === "measuring") {
      setStage("closed");
    } else if (from === "opening") {
      setStage("closing");
    }
  }, [open, ms]);

  // What each stage waits for when no event moves it on.
  useEffect(() => {
    if (stage === "waiting") {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setStage("closing"));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    const fallback =
      stage === "measuring"
        ? ([MEASURE_FALLBACK_MS, "opening"] as const)
        : stage === "opening"
          ? ([ms + SETTLE_FALLBACK_MS, "open"] as const)
          : stage === "closing"
            ? ([ms + SETTLE_FALLBACK_MS, "closed"] as const)
            : null;
    if (!fallback) return;
    const timer = setTimeout(() => setStage(fallback[1]), fallback[0]);
    return () => clearTimeout(timer);
  }, [stage, ms]);

  const height =
    stage === "measuring" || stage === "closing"
      ? 0
      : stage === "opening"
        ? (measured ?? 0)
        : (measured ?? undefined);
  // In flow only while open and not yet measured (first render of an open item).
  const inFlow = measured == null && (stage === "open" || stage === "waiting");

  return {
    mounted: stage !== "closed",
    clipStyle: {
      overflow: "hidden",
      height,
      transitionProperty: "height",
      transitionDuration: stage === "open" ? "0ms" : `${ms}ms`,
      // One curve both ways: when one item closes as another opens, two
      // different curves make the rows below bulge mid-swap.
      transitionTimingFunction: "ease-in-out",
    },
    contentStyle: inFlow ? null : { position: "absolute", top: 0, left: 0, right: 0 },
    onContentLayout: (event) => {
      setMeasured(event.nativeEvent.layout.height);
      // The layout event proves the platform has the 0-tall clip on screen,
      // which counting frames cannot: under load two renders reached native
      // as one update and the open snapped.
      if (stageRef.current === "measuring") setStage("opening");
    },
    onClipTransitionEnd: () => {
      if (stageRef.current === "opening") setStage("open");
      else if (stageRef.current === "closing") setStage("closed");
    },
  };
}
