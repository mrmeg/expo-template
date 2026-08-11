/**
 * Bounds how many live previews a gallery mounts per frame.
 *
 * The galleries render a real instance of every registry entry, which is the
 * point of the showcase and also its cost: `/components` mounts 36 live
 * components (most of `@mrmeg/expo-ui`) in one synchronous burst, and on a
 * client-side navigation that burst blanked the content pane for seconds. This
 * hook virtualizes the MOUNT SCHEDULE — card chrome renders immediately, live
 * previews stream in a few per `requestAnimationFrame` — without touching the
 * scroll window, so nothing depends on a measurement that never happens during
 * the export-time prerender (the reason FlatList/LegendList/FlashList are ruled
 * out here).
 *
 * Deferring is gated on ROUTE IDENTITY (`isClientNavigatedScreen`), which is what
 * keeps the prerender/hydration contract intact:
 *
 *  - Export-time prerender: no `window`, so always full. A direct URL load ships
 *    a gallery-complete HTML shell that reads correctly with no JS.
 *  - The client's hydration render — INCLUDING a late selective-hydration pass of
 *    this leaf — sees a pathname equal to the entry pathname, so also full.
 *    Identical trees, no React #418.
 *  - A screen reached by a client-side navigation sees a differing pathname (or
 *    the latched `hasNavigated`), so it defers. Nothing here depends on effect or
 *    commit ordering, which is exactly what the previous `hasHydratedOnce()`
 *    version got wrong: the root layout's effect fired before this leaf's
 *    `useState` initializer ran, so direct loads deferred and threw #418.
 *  - Native: `window` exists, the first screen matches the entry pathname → full;
 *    everything after a navigation defers, the same on-device win as before.
 *
 * Web routes are client-rendered off a build-time HTML shell; there is no
 * per-request server rendering. See "Enable Server Output" in
 * `docs/server-guide.md`.
 *
 * `requestAnimationFrame` rather than `requestIdleCallback` (not on native) or
 * Reanimated (banned in this template): one batch per frame keeps each frame's
 * work bounded, which is the whole fix.
 */

import { useEffect, useState } from "react";
import { usePathname } from "expo-router";

import { isClientNavigatedScreen } from "@/client/lib/clientNavigation";

/** How many previews mount immediately, and how many join per frame after. */
export interface PreviewSchedule {
  /**
   * Previews mounted in the first render. Sized to cover the fold so the
   * streaming is invisible to a visitor who doesn't scroll immediately.
   */
  initialBurst: number;
  /** Previews added per animation frame until every one is live. */
  batchSize: number;
}

/**
 * `/components`: 36 cards, 3-up on desktop and 2-up on a phone. 8 covers the
 * first rows of the leading (form) section either way, and leaves ~78% of the
 * old synchronous cost off the transition's critical path. 4 per frame finishes
 * the rest in seven frames.
 */
export const COMPONENT_PREVIEW_SCHEDULE: PreviewSchedule = {
  initialBurst: 8,
  batchSize: 4,
};

/**
 * `/blocks`: 6 full-width stages, each a whole page section — one fills the
 * fold on its own. 2 up front, then one per frame.
 */
export const BLOCK_STAGE_SCHEDULE: PreviewSchedule = {
  initialBurst: 2,
  batchSize: 1,
};

/**
 * How many of `total` previews may render live right now.
 *
 * Returns `total` unchanged — from the very first render, forever — for a screen
 * the visitor arrived on (the export-time prerender and the hydration render). For
 * a screen reached by a client-side navigation it starts at `initialBurst` and
 * grows by `batchSize` per animation frame until it reaches `total`.
 *
 * `total` may shrink and grow again as a category filter narrows the gallery;
 * the allowance already earned is kept, so re-selecting "All" resumes streaming
 * instead of restarting from the burst.
 *
 * @example
 * const live = useProgressivePreviewCount(entries.length, COMPONENT_PREVIEW_SCHEDULE);
 * entries.map((entry, index) => <Card live={index < live} … />)
 */
export function useProgressivePreviewCount(
  total: number,
  { initialBurst, batchSize }: PreviewSchedule,
): number {
  // Undefined under a bare test render with no router context (and on any host
  // that hasn't mounted one): `isClientNavigatedScreen` treats that as "not
  // navigated" → full render, which is the safe default in both cases.
  const pathname = usePathname() as string | undefined;

  // A `useState` initializer, deliberately: the choice is made once per mount and
  // is render-stable from then on. Re-reading in the render body would let a
  // screen change its own output mid-life — during hydration, precisely the
  // mismatch this hook exists to avoid.
  const [defer] = useState(() => isClientNavigatedScreen(pathname));
  const [allowed, setAllowed] = useState(initialBurst);

  // One frame per batch, re-armed by the commit it caused. Chaining inside a
  // single callback would need a ref to stay in step with the rendered count;
  // this way React's own commit is the clock and unmount cancellation is just
  // the effect cleanup.
  useEffect(() => {
    if (!defer || allowed >= total) return;

    const frame = requestAnimationFrame(() => {
      setAllowed((current) => Math.min(current + batchSize, total));
    });
    return () => cancelAnimationFrame(frame);
  }, [defer, allowed, total, batchSize]);

  // Clamped on the way out rather than in state: a narrowed gallery reports only
  // the cards it has, while the allowance already earned survives in `allowed`
  // for when the filter opens back up.
  return defer ? Math.min(allowed, total) : total;
}
