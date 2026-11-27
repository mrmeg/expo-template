import { useEffect, useState } from "react";

/**
 * How long past `exitMs` to wait before unmounting anyway. The transition-end
 * event is the real signal; this only covers an exit that never reports (no
 * visible change to transition, or a platform that drops the event).
 */
const EXIT_FALLBACK_MS = 400;

export interface Presence {
  /** Render the subtree. Stays `true` until the exit transition has ended. */
  mounted: boolean;
  /**
   * The subtree's resting state. `false` for the first frames after mounting
   * (so a transition has a start state to leave) and again from the moment
   * `present` turns false (so the exit transition runs while still mounted).
   */
  shown: boolean;
  /** Pass to the animated `MotionView`'s `onTransitionEnd`. */
  onTransitionEnd: () => void;
}

/**
 * SPIKE. Keeps a subtree mounted long enough to animate out, on every
 * platform, with no animation library: the caller styles on `shown`, a
 * `transition*` style does the rest, and the view's own transition-end event
 * unmounts it.
 *
 * A timer alone is not enough: it starts when React renders, the transition
 * starts when the platform gets to it, and on Android the dialog was removed
 * with half its fade still to run (a 50 ms margin did not close the gap).
 *
 * A subtree that is present on the first render starts `shown`, so server
 * markup carries the final state and nothing animates during hydration.
 */
export function usePresence(present: boolean, exitMs: number): Presence {
  const [mounted, setMounted] = useState(present);
  const [shown, setShown] = useState(present);

  useEffect(() => {
    if (present) {
      setMounted(true);
      // Two frames: the first commits the start state, the second guarantees
      // the platform has laid it out before the target state replaces it.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }

    setShown(false);
    if (exitMs <= 0) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs + EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [present, exitMs]);

  return {
    mounted: mounted || present,
    shown: shown && present,
    onTransitionEnd: () => {
      if (!present) setMounted(false);
    },
  };
}
