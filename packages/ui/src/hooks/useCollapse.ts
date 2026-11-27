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

/**
 * - `closed`: nothing rendered.
 * - `measuring`: mounted at height 0 so the content can be measured.
 * - `opening`: height pinned to the measured value; the transition runs.
 * - `open`: at rest, natural layout, no pinned height.
 * - `pinned`: height pinned to the measured value for two frames, because a
 *   transition cannot start from `auto`.
 * - `closing`: height 0; the transition runs.
 */
type Stage = "closed" | "measuring" | "opening" | "open" | "pinned" | "closing";

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
 * Android and web.
 *
 * The height is pinned to a number only while it is moving. At rest the
 * content is in normal flow at its natural height, so text that reflows (a web
 * font arriving, a window resize) is never clipped, an item that is open on the
 * first render is whole in server markup, and nothing animates at mount.
 *
 * While pinned, the content is absolutely positioned inside the clip: in flow,
 * Yoga caps a child's measured height at its parent's (CSS does not), so the
 * content of a 0-tall clip measured as its padding only.
 */
export function useCollapse(open: boolean, ms: number): Collapse {
  const [stage, setStageState] = useState<Stage>(open ? "open" : "closed");
  const [measured, setMeasured] = useState<number | null>(null);
  const stageRef = useRef<Stage>(stage);

  useEffect(() => {
    const setStage = (next: Stage) => {
      stageRef.current = next;
      setStageState(next);
    };
    let first = 0;
    let second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const afterTwoFrames = (run: () => void) => {
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(run);
      });
    };
    const settleTo = (next: Stage) => {
      timer = setTimeout(() => setStage(next), ms + SETTLE_FALLBACK_MS);
    };

    const from = stageRef.current;
    if (ms <= 0) {
      setStage(open ? "open" : "closed");
    } else if (open) {
      if (from === "closed") {
        setStage("measuring");
        afterTwoFrames(() => {
          setStage("opening");
          settleTo("open");
        });
      } else if (from !== "open") {
        // Reversing a close, or a re-run mid-open: the height is already a number.
        setStage("opening");
        settleTo("open");
      }
    } else if (from === "open") {
      setStage("pinned");
      afterTwoFrames(() => {
        setStage("closing");
        settleTo("closed");
      });
    } else if (from === "measuring") {
      setStage("closed");
    } else if (from !== "closed") {
      setStage("closing");
      settleTo("closed");
    }

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (timer) clearTimeout(timer);
    };
  }, [open, ms]);

  const atRest = stage === "open";
  const target =
    stage === "opening" || stage === "pinned" ? (measured ?? 0) : 0;
  return {
    mounted: stage !== "closed",
    clipStyle: atRest
      ? { overflow: "hidden" }
      : {
        overflow: "hidden",
        height: target,
        // Declared on every non-resting stage, one render before the height
        // moves. Reanimated ignores a transition whose settings arrive in the
        // same update as the value change (a browser honours it): declaring it
        // only on `opening` / `closing` made every open and close snap on iOS
        // and Android. The same rule is what keeps the pin silent: `open` to
        // `pinned` adds the settings and the height together, so it cannot
        // animate, and on web `auto` to a number is not animatable anyway.
        transitionProperty: "height",
        transitionDuration: `${ms}ms`,
        // One curve both ways: when one item closes as another opens, two
        // different curves make the rows below bulge mid-swap.
        transitionTimingFunction: "ease-in-out",
      },
    contentStyle: atRest ? null : { position: "absolute", top: 0, left: 0, right: 0 },
    onContentLayout: (event) => setMeasured(event.nativeEvent.layout.height),
    onClipTransitionEnd: () => {
      const settled = stage === "opening" ? "open" : stage === "closing" ? "closed" : null;
      if (settled) {
        stageRef.current = settled;
        setStageState(settled);
      }
    },
  };
}
