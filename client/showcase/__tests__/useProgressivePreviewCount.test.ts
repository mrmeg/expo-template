/**
 * `useProgressivePreviewCount` — the mount schedule behind the galleries.
 *
 * Two behaviours, and the boundary between them is the whole point:
 *
 *  1. On a screen the visitor ARRIVED on (SSR and the client's hydration render
 *     of that HTML) the hook must return `total` from its very FIRST render and
 *     never move. Anything else changes the tree React is trying to match and
 *     trips #418.
 *  2. On a screen reached by a client-side NAVIGATION it starts at the burst and
 *     grows one batch per animation frame, cancelling cleanly on unmount.
 *
 * The discriminator is route identity, so these tests drive it the way the app
 * does: `recordPathname()` (which `RootLayout` calls) seeds the entry pathname,
 * and the hook compares it against `usePathname()` — mocked to `"/"` by
 * test/setup.ts. Seeding a DIFFERENT entry pathname is therefore what simulates
 * "the visitor navigated here". `test/setup.ts` resets the module before each
 * test, so the default state is "arrived here".
 *
 * jest-expo polyfills `requestAnimationFrame` as `setTimeout(…, 0)`, so frames
 * are advanced with fake timers rather than a hand-rolled rAF stub — the timers
 * drive the real polyfill the app uses.
 */

import { act, renderHook } from "@testing-library/react-native";

import { recordPathname } from "@/client/lib/clientNavigation";

import {
  BLOCK_STAGE_SCHEDULE,
  COMPONENT_PREVIEW_SCHEDULE,
  useProgressivePreviewCount,
} from "../useProgressivePreviewCount";

const SCHEDULE = { initialBurst: 3, batchSize: 2 };

/** The pathname test/setup.ts' expo-router mock reports for every screen. */
const CURRENT_PATH = "/";

/** Puts the app in "the visitor entered somewhere else and navigated here". */
function arriveElsewhere() {
  recordPathname("/entry");
}

/** Runs the frames the rAF polyfill has queued, then the commits they cause. */
async function flushFrames(count: number) {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      jest.advanceTimersByTime(16);
    });
  }
}

/**
 * Counts frame requests and cancellations. `jest.getTimerCount()` can't be used
 * for this: the polyfill is `setTimeout`-backed and React's own scheduler keeps
 * timers of its own in the same queue.
 */
function watchFrames() {
  const request = jest.spyOn(globalThis, "requestAnimationFrame");
  const cancel = jest.spyOn(globalThis, "cancelAnimationFrame");
  return {
    get requested() {
      return request.mock.calls.length;
    },
    get cancelled() {
      return cancel.mock.calls.length;
    },
    /** Frames asked for and neither run nor cancelled. */
    get pending() {
      return request.mock.calls.length - cancel.mock.calls.length;
    },
    restore() {
      request.mockRestore();
      cancel.mockRestore();
    },
  };
}

describe("useProgressivePreviewCount", () => {
  describe("on the screen the visitor arrived on (SSR + hydration render)", () => {
    it("returns the full total on the first render", async () => {
      recordPathname(CURRENT_PATH);

      const { result } = await renderHook(() =>
        useProgressivePreviewCount(36, SCHEDULE),
      );

      expect(result.current).toBe(36);
    });

    it("returns the full total when no pathname has been recorded at all", async () => {
      // A bare render with no router mounted — the safe default is "render
      // everything", never "defer".
      const { result } = await renderHook(() =>
        useProgressivePreviewCount(36, SCHEDULE),
      );

      expect(result.current).toBe(36);
    });

    it("never schedules a frame, so the value can't move", async () => {
      recordPathname(CURRENT_PATH);
      jest.useFakeTimers();
      const frames = watchFrames();
      try {
        const { result } = await renderHook(() =>
          useProgressivePreviewCount(36, SCHEDULE),
        );
        expect(result.current).toBe(36);

        await flushFrames(10);

        expect(result.current).toBe(36);
        expect(frames.requested).toBe(0);
      } finally {
        frames.restore();
        jest.useRealTimers();
      }
    });

    it("stays on the full-mount path even if the app navigates away later", async () => {
      recordPathname(CURRENT_PATH);
      jest.useFakeTimers();
      try {
        const { result } = await renderHook(() =>
          useProgressivePreviewCount(12, SCHEDULE),
        );
        expect(result.current).toBe(12);

        // The visitor leaves; this mount already made its choice and must not
        // start deferring mid-life.
        recordPathname("/somewhere-else");
        await flushFrames(5);

        expect(result.current).toBe(12);
      } finally {
        jest.useRealTimers();
      }
    });

    it("renders everything on the server even after a navigation was recorded", async () => {
      // Module scope on a long-lived server process is polluted by whichever
      // request got there first, so the server render must ignore it entirely.
      // jest's environment defines `window` (as globalThis), so remove it to
      // reproduce a server render.
      arriveElsewhere();
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
      delete (globalThis as { window?: unknown }).window;
      try {
        const { result } = await renderHook(() =>
          useProgressivePreviewCount(36, SCHEDULE),
        );

        expect(result.current).toBe(36);
      } finally {
        if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
      }
    });
  });

  describe("on a screen reached by a client-side navigation", () => {
    beforeEach(() => {
      arriveElsewhere();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("starts at the initial burst", async () => {
      const { result } = await renderHook(() =>
        useProgressivePreviewCount(36, SCHEDULE),
      );

      expect(result.current).toBe(3);
    });

    it("grows one batch per frame", async () => {
      const { result } = await renderHook(() =>
        useProgressivePreviewCount(36, SCHEDULE),
      );

      await flushFrames(1);
      expect(result.current).toBe(5);

      await flushFrames(1);
      expect(result.current).toBe(7);

      await flushFrames(2);
      expect(result.current).toBe(11);
    });

    it("reaches the total and then stops scheduling", async () => {
      const frames = watchFrames();
      try {
        const { result } = await renderHook(() =>
          useProgressivePreviewCount(10, SCHEDULE),
        );

        // 3 → 5 → 7 → 9 → 10 in four frames.
        await flushFrames(4);
        expect(result.current).toBe(10);

        // No overshoot, and nothing left running once the total is reached.
        const requested = frames.requested;
        await flushFrames(5);
        expect(result.current).toBe(10);
        expect(frames.requested).toBe(requested);
        expect(frames.pending).toBe(0);
      } finally {
        frames.restore();
      }
    });

    it("never exceeds a total smaller than the burst", async () => {
      const { result } = await renderHook(() =>
        useProgressivePreviewCount(2, SCHEDULE),
      );

      await flushFrames(3);
      expect(result.current).toBe(2);
    });

    it("cancels its pending frame on unmount", async () => {
      const frames = watchFrames();
      try {
        const view = await renderHook(() => useProgressivePreviewCount(36, SCHEDULE));

        expect(frames.pending).toBe(1);
        await view.unmount();

        expect(frames.cancelled).toBe(1);
        expect(frames.pending).toBe(0);

        // And the cancelled frame really is dead: advancing time neither runs a
        // batch nor schedules a replacement.
        await flushFrames(3);
        expect(frames.requested).toBe(1);
      } finally {
        frames.restore();
      }
    });

    it("keeps the earned allowance when a filter shrinks and restores the total", async () => {
      const { result, rerender } = await renderHook(
        ({ total }: { total: number }) => useProgressivePreviewCount(total, SCHEDULE),
        { initialProps: { total: 36 } },
      );

      await flushFrames(2);
      expect(result.current).toBe(7);

      // A category chip narrows the gallery below what's already live.
      await act(async () => rerender({ total: 4 }));
      expect(result.current).toBe(4);

      // Back to "All": streaming resumes from where it was, not from the burst.
      await act(async () => rerender({ total: 36 }));
      expect(result.current).toBe(7);
      await flushFrames(1);
      expect(result.current).toBe(9);
    });
  });

  describe("after returning to the entry route", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("still defers, because the entry HTML is long gone", async () => {
      // Enter on "/", navigate away (which latches `hasNavigated`), come back.
      // The pathname matches the entry pathname again, so only the latch can
      // tell this apart from the hydration render.
      recordPathname(CURRENT_PATH);
      recordPathname("/elsewhere");

      const { result } = await renderHook(() =>
        useProgressivePreviewCount(36, SCHEDULE),
      );

      expect(result.current).toBe(3);
      await flushFrames(1);
      expect(result.current).toBe(5);
    });
  });

  describe("shipped schedules", () => {
    it("covers the components fold before the first frame", () => {
      // 36 cards, 3-up on desktop / 2-up on a phone: 8 fills the visible rows.
      expect(COMPONENT_PREVIEW_SCHEDULE.initialBurst).toBe(8);
      expect(COMPONENT_PREVIEW_SCHEDULE.batchSize).toBeGreaterThan(0);
    });

    it("keeps the blocks burst small — one stage is a whole page section", () => {
      expect(BLOCK_STAGE_SCHEDULE.initialBurst).toBe(2);
      expect(BLOCK_STAGE_SCHEDULE.batchSize).toBeGreaterThan(0);
    });

    it("finishes /components in a handful of frames", async () => {
      arriveElsewhere();
      jest.useFakeTimers();
      try {
        const { result } = await renderHook(() =>
          useProgressivePreviewCount(36, COMPONENT_PREVIEW_SCHEDULE),
        );

        const frames = Math.ceil(
          (36 - COMPONENT_PREVIEW_SCHEDULE.initialBurst) /
            COMPONENT_PREVIEW_SCHEDULE.batchSize,
        );
        expect(frames).toBeLessThanOrEqual(10);

        await flushFrames(frames);
        expect(result.current).toBe(36);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
