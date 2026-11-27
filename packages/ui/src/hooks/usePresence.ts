import { useEffect, useState } from "react";

export interface Presence {
  /** Render the subtree. Stays `true` for `exitMs` after `present` turns false. */
  mounted: boolean;
  /**
   * The subtree's resting state. `false` for the first frame after mounting
   * (so a transition has a start state to leave) and again from the moment
   * `present` turns false (so the exit transition runs while still mounted).
   */
  shown: boolean;
}

/**
 * SPIKE. Keeps a subtree mounted long enough to animate out, on every
 * platform, with no animation library: the caller styles on `shown` and a
 * `transition*` style does the rest.
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
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [present, exitMs]);

  return { mounted: mounted || present, shown: shown && present };
}
