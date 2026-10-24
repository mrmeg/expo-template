/**
 * MediaScrubber: a seek bar drawn by the kit (not `Slider`, which has no
 * sliding-start / sliding-end events). iOS is the jest-expo default; the web
 * keyboard lives in `MediaScrubber.web.test.tsx`.
 *
 * Drags call the `PanResponder` handlers on the touch area directly, with the
 * `touchHistory` React Native's responder system would attach: Drawer's swipe
 * is not tested, so there is no precedent, and `fireEvent` would not pass the
 * `touchHistory` (or the `currentTarget`) `PanResponder` reads.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { MediaScrubber, type MediaScrubberProps } from "../MediaScrubber";
import * as componentsBarrel from "../index";

/** Track inset either side of the touch area (matches the component). */
const INSET = 10;
/** Touch area 220 wide: a 200 point track, so 1 point is 1/200 of the clip. */
const TOUCH_WIDTH = 220;
const TRACK = 200;
/** Where the touch area sits on screen, so `pageX` differs from `locationX`. */
const SCREEN_OFFSET = 50;

const scrubber = () => screen.getByRole("adjustable");
const valueOf = () => scrubber().props.accessibilityValue;

/**
 * Calls `onLayout` directly: RNTL's `fireEvent` treats an element whose
 * `onStartShouldSetResponder` returns false (the scrubber's, until it has a
 * width) as disabled and swallows every event aimed at it, `layout` included.
 */
async function layout(width = TOUCH_WIDTH) {
  await act(async () => {
    scrubber().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } } });
  });
}

type Props = Partial<MediaScrubberProps>;

async function mount(props: Props = {}) {
  const callbacks = {
    onScrubStart: jest.fn(),
    onScrubChange: jest.fn(),
    onScrubEnd: jest.fn(),
  };
  const result = await render(<MediaScrubber value={0} duration={100} {...callbacks} {...props} />);
  await layout();
  return { ...callbacks, ...result };
}

/** A responder event for a single finger at `locationX` in the touch area. */
function touch(locationX: number, previousLocationX: number, time: number) {
  const pageX = locationX + SCREEN_OFFSET;
  return {
    nativeEvent: { locationX, pageX, touches: [{ pageX }], changedTouches: [{ pageX }], timestamp: time },
    currentTarget: 1,
    persist: () => {},
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
      numberActiveTouches: 1,
      touchBank: [
        {
          touchActive: true,
          startPageX: pageX,
          startPageY: 0,
          startTimeStamp: 1,
          currentPageX: pageX,
          currentPageY: 0,
          currentTimeStamp: time,
          previousPageX: previousLocationX + SCREEN_OFFSET,
          previousPageY: 0,
          previousTimeStamp: time - 1,
        },
      ],
    },
  };
}

/** The responder callbacks of the rendered touch area, each wrapped in `act`. */
function finger() {
  const props = scrubber().props;
  let time = 1;
  let lastX = 0;
  const run = (fn: () => unknown) => act(async () => void fn());
  return {
    shouldStart: () => props.onStartShouldSetResponder(touch(0, 0, time)),
    shouldMove: () => props.onMoveShouldSetResponder(touch(0, 0, time)),
    allowsTermination: () => props.onResponderTerminationRequest(touch(0, 0, time)),
    down: (locationX: number) => {
      lastX = locationX;
      time += 1;
      return run(() => props.onResponderGrant(touch(locationX, locationX, time)));
    },
    move: (locationX: number) => {
      const previous = lastX;
      lastX = locationX;
      time += 1;
      return run(() => props.onResponderMove(touch(locationX, previous, time)));
    },
    up: () => {
      time += 1;
      return run(() => props.onResponderRelease(touch(lastX, lastX, time)));
    },
    terminate: () => {
      time += 1;
      return run(() => props.onResponderTerminate(touch(lastX, lastX, time)));
    },
  };
}

/** A touch-area x for a fraction of the track. */
const at = (fraction: number) => INSET + fraction * TRACK;

describe("MediaScrubber", () => {
  describe("accessibility", () => {
    it("is an adjustable element named Seek by default", async () => {
      await mount();

      expect(scrubber().props.accessibilityLabel).toBe("Seek");
      expect(scrubber().props.accessible).toBe(true);
    });

    it("takes a custom label", async () => {
      await mount({ accessibilityLabel: "Seek in episode" });

      expect(screen.getByRole("adjustable", { name: "Seek in episode" })).toBeTruthy();
    });

    it("reports min, max, now and the position in words", async () => {
      await mount({ value: 62, duration: 225 });

      expect(valueOf()).toEqual({
        min: 0,
        max: 225,
        now: 62,
        text: "1 minute 2 seconds of 3 minutes 45 seconds",
      });
    });

    it("offers increment and decrement", async () => {
      await mount({ value: 10, duration: 100 });

      expect(scrubber().props.accessibilityActions).toEqual([{ name: "increment" }, { name: "decrement" }]);
    });

    it("increment seeks ahead by the default step of 5 s through onScrubEnd", async () => {
      const { onScrubEnd, onScrubStart, onScrubChange } = await mount({ value: 10, duration: 100 });

      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });

      expect(onScrubEnd).toHaveBeenCalledTimes(1);
      expect(onScrubEnd).toHaveBeenCalledWith(15);
      // A screen-reader adjustment is one step, with no drag around it.
      expect(onScrubStart).not.toHaveBeenCalled();
      expect(onScrubChange).not.toHaveBeenCalled();
    });

    it("decrement seeks back by the default step", async () => {
      const { onScrubEnd } = await mount({ value: 10, duration: 100 });

      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });

      expect(onScrubEnd).toHaveBeenCalledWith(5);
    });

    it("moves by a custom step", async () => {
      const { onScrubEnd } = await mount({ value: 30, duration: 100, step: 10 });

      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });

      expect(onScrubEnd.mock.calls).toEqual([[40], [20]]);
    });

    it("clamps increment at the duration and decrement at zero", async () => {
      const end = await mount({ value: 98, duration: 100 });
      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
      expect(end.onScrubEnd).toHaveBeenLastCalledWith(100);
      await end.unmount();

      const start = await mount({ value: 2, duration: 100 });
      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
      expect(start.onScrubEnd).toHaveBeenLastCalledWith(0);
    });

    it("ignores an action it does not know", async () => {
      const { onScrubEnd } = await mount({ value: 10 });

      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "activate" } });

      expect(onScrubEnd).not.toHaveBeenCalled();
    });
  });

  describe("disabled track", () => {
    it.each<[string, Props]>([
      ["duration 0", { duration: 0 }],
      ["duration NaN", { duration: Number.NaN }],
      ["duration Infinity (live)", { duration: Number.POSITIVE_INFINITY }],
      ["the disabled prop", { disabled: true }],
    ])("with %s it announces disabled, offers no actions and ignores input", async (_name, props) => {
      const { onScrubEnd, onScrubStart } = await mount({ value: 10, ...props });

      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
      expect(scrubber().props.accessibilityActions).toBeUndefined();

      await fireEvent(scrubber(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
      expect(onScrubEnd).not.toHaveBeenCalled();

      expect(scrubber().props.onStartShouldSetResponder(touch(0, 0, 1))).toBe(false);
      expect(onScrubStart).not.toHaveBeenCalled();
    });

    it("an unknown duration reports only the position, and a live one says Live", async () => {
      const unknown = await mount({ value: 62, duration: 0 });
      expect(valueOf()).toEqual({ text: "1 minute 2 seconds" });
      await unknown.unmount();

      await mount({ value: 62, duration: Number.POSITIVE_INFINITY });
      expect(valueOf()).toEqual({ text: "Live" });
    });

    it("is enabled once a real duration arrives, though the responder was built at duration 0", async () => {
      const callbacks = {
        onScrubStart: jest.fn(),
        onScrubChange: jest.fn(),
        onScrubEnd: jest.fn(),
      };
      const { rerender } = await render(<MediaScrubber value={0} duration={0} {...callbacks} />);
      await rerender(<MediaScrubber value={0} duration={100} {...callbacks} />);
      await layout();

      const f = finger();
      expect(f.shouldStart()).toBe(true);
      await f.down(at(0.5));
      await f.up();

      expect(callbacks.onScrubEnd).toHaveBeenCalledTimes(1);
      expect(callbacks.onScrubEnd.mock.calls[0][0]).toBeCloseTo(50);
    });
  });

  describe("touch", () => {
    it("claims the touch only once it has a width and a usable duration", async () => {
      await render(<MediaScrubber value={0} duration={100} />);
      // No layout yet: nothing to map a touch onto.
      expect(finger().shouldStart()).toBe(false);

      await layout();
      expect(finger().shouldStart()).toBe(true);
      expect(finger().shouldMove()).toBe(true);
    });

    it("refuses to hand the touch to a parent (a ScrollView must not steal a scrub)", async () => {
      await mount();

      expect(finger().allowsTermination()).toBe(false);
    });

    it("a tap seeks to that point: start, change, end", async () => {
      const { onScrubStart, onScrubChange, onScrubEnd } = await mount({ duration: 100 });
      const f = finger();

      await f.down(at(0.25));
      await f.up();

      expect(onScrubStart).toHaveBeenCalledTimes(1);
      expect(onScrubChange).toHaveBeenCalledTimes(1);
      expect(onScrubChange.mock.calls[0][0]).toBeCloseTo(25);
      expect(onScrubEnd).toHaveBeenCalledTimes(1);
      expect(onScrubEnd.mock.calls[0][0]).toBeCloseTo(25);
    });

    it("a drag follows the finger, reporting each position and ending where it lifts", async () => {
      const { onScrubChange, onScrubEnd } = await mount({ duration: 200 });
      const f = finger();

      await f.down(at(0.1));
      await f.move(at(0.3));
      await f.move(at(0.8));
      await f.up();

      const seconds = onScrubChange.mock.calls.map(([value]) => value as number);
      expect(seconds).toHaveLength(3);
      expect(seconds[0]).toBeCloseTo(20);
      expect(seconds[1]).toBeCloseTo(60);
      expect(seconds[2]).toBeCloseTo(160);
      expect(onScrubEnd).toHaveBeenCalledTimes(1);
      expect(onScrubEnd.mock.calls[0][0]).toBeCloseTo(160);
    });

    it("clamps a drag past either end of the track", async () => {
      const { onScrubChange, onScrubEnd } = await mount({ duration: 100 });
      const f = finger();

      await f.down(at(0.5));
      await f.move(TOUCH_WIDTH + 80);
      expect(onScrubChange).toHaveBeenLastCalledWith(100);
      await f.move(-80);
      expect(onScrubChange).toHaveBeenLastCalledWith(0);
      await f.up();

      expect(onScrubEnd).toHaveBeenCalledWith(0);
    });

    it("maps the inset to the ends: a touch in the inset is 0 or the duration", async () => {
      const { onScrubChange } = await mount({ duration: 100 });
      const f = finger();

      await f.down(4);
      expect(onScrubChange).toHaveBeenLastCalledWith(0);
      await f.up();

      await f.down(TOUCH_WIDTH - 3);
      expect(onScrubChange).toHaveBeenLastCalledWith(100);
      await f.up();
    });

    it("follows the finger and ignores `value` until release", async () => {
      const callbacks = { onScrubStart: jest.fn(), onScrubChange: jest.fn(), onScrubEnd: jest.fn() };
      const { rerender } = await mount({ value: 10, duration: 100, ...callbacks });
      const f = finger();

      await f.down(at(0.6));
      expect(valueOf().now).toBe(60);

      // The player keeps reporting its own position while the thumb is held.
      await rerender(<MediaScrubber value={12} duration={100} {...callbacks} />);
      expect(valueOf().now).toBe(60);
      await rerender(<MediaScrubber value={14} duration={100} {...callbacks} />);
      expect(valueOf().now).toBe(60);

      await f.up();
      expect(valueOf().now).toBe(14);
    });

    it("reads the latest callbacks mid-gesture", async () => {
      const first = { onScrubStart: jest.fn(), onScrubChange: jest.fn(), onScrubEnd: jest.fn() };
      const second = { onScrubStart: jest.fn(), onScrubChange: jest.fn(), onScrubEnd: jest.fn() };
      const { rerender } = await mount({ duration: 100, ...first });
      const f = finger();

      await f.down(at(0.2));
      await rerender(<MediaScrubber value={0} duration={100} {...second} />);
      await f.move(at(0.4));
      await f.up();

      expect(first.onScrubChange).toHaveBeenCalledTimes(1);
      expect(second.onScrubChange).toHaveBeenCalledTimes(1);
      expect(first.onScrubEnd).not.toHaveBeenCalled();
      expect(second.onScrubEnd).toHaveBeenCalledTimes(1);
    });

    it("still ends a drag cleanly when the track goes live midway", async () => {
      const { onScrubEnd, rerender } = await mount({ duration: 100 });
      const f = finger();
      await f.down(at(0.2));
      await f.move(at(0.4));

      await rerender(<MediaScrubber value={0} duration={Number.POSITIVE_INFINITY} onScrubEnd={onScrubEnd} />);
      // The new props must still carry the release handler, or React Native has nothing to call.
      expect(scrubber().props.onResponderRelease).toBeDefined();
      await finger().up();

      expect(onScrubEnd).toHaveBeenCalledTimes(1);
      expect(onScrubEnd.mock.calls[0][0]).toBeCloseTo(40);
    });

    it("a terminated touch ends where the thumb was, so a consumer that paused resumes", async () => {
      const { onScrubEnd } = await mount({ duration: 100 });
      const f = finger();

      await f.down(at(0.1));
      await f.move(at(0.7));
      await f.terminate();

      expect(onScrubEnd).toHaveBeenCalledTimes(1);
      expect(onScrubEnd.mock.calls[0][0]).toBeCloseTo(70);
      expect(valueOf().now).toBe(0);
    });

    it("scrubs again after a gesture", async () => {
      const { onScrubEnd } = await mount({ duration: 100 });
      const f = finger();

      await f.down(at(0.2));
      await f.up();
      await f.down(at(0.9));
      await f.up();

      expect(onScrubEnd.mock.calls.map(([v]) => Math.round(v as number))).toEqual([20, 90]);
    });

    it("measures the track from the touch area's layout width", async () => {
      const { onScrubChange } = await mount({ duration: 100 });
      await layout(120);
      const f = finger();

      // Track is now 100 wide: x = inset + 50 is halfway.
      await f.down(INSET + 50);

      expect(onScrubChange.mock.calls[0][0]).toBeCloseTo(50);
    });
  });

  describe("drawing", () => {
    const styleOf = (el: { props: { style?: unknown } }) =>
      Object.assign({}, ...[el.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

    it("is at least 44 pt tall", async () => {
      await mount();

      expect(styleOf(scrubber()).height).toBeGreaterThanOrEqual(44);
    });

    it("merges a caller style, including an array", async () => {
      await mount({ style: [{ marginTop: 6 }, { marginBottom: 2 }] });

      expect(styleOf(scrubber())).toEqual(expect.objectContaining({ marginTop: 6, marginBottom: 2, height: 44 }));
    });

    it("passes testID through", async () => {
      await mount({ testID: "seek" });

      expect(screen.getByTestId("seek")).toBe(scrubber());
    });

    it("draws the overlay tone in white and the default tone from the theme", async () => {
      const colors = async (tone: "overlay" | "default") => {
        const { toJSON, unmount } = await render(<MediaScrubber value={50} duration={100} tone={tone} />);
        const json = JSON.stringify(toJSON());
        await unmount();
        return json;
      };

      const overlay = await colors("overlay");
      const themed = await colors("default");

      expect(overlay).toContain("#FFFFFF");
      expect(overlay).not.toBe(themed);
    });
  });

  it("is subpath-only: the components barrel does not export it", () => {
    expect(componentsBarrel).not.toHaveProperty("MediaScrubber");
  });
});
