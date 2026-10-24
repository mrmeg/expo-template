/**
 * MediaScrubber on web: a focusable slider with ←/→ (± step) and Home / End.
 * `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { MediaScrubber } from "../MediaScrubber";

const scrubber = () => screen.getByRole("adjustable");

/** A web keydown: the DOM event react-native-web hands `onKeyDown`. */
const key = (name: string, extra: Record<string, unknown> = {}) => {
  const event = { key: name, preventDefault: jest.fn(), ...extra };
  return event;
};

async function press(event: ReturnType<typeof key>) {
  await act(async () => void scrubber().props.onKeyDown(event));
}

describe("MediaScrubber (web)", () => {
  it("is focusable and mirrors its value as aria-value props", async () => {
    await render(<MediaScrubber value={62} duration={225} />);

    expect(scrubber().props.focusable).toBe(true);
    expect(scrubber().props["aria-valuemin"]).toBe(0);
    expect(scrubber().props["aria-valuemax"]).toBe(225);
    expect(scrubber().props["aria-valuenow"]).toBe(62);
    expect(scrubber().props["aria-valuetext"]).toBe("1 minute 2 seconds of 3 minutes 45 seconds");
  });

  it("is not focusable, and sets no range, when the duration is unknown", async () => {
    await render(<MediaScrubber value={5} duration={Number.POSITIVE_INFINITY} />);

    expect(scrubber().props.focusable).toBe(false);
    expect(scrubber().props["aria-valuemax"]).toBeUndefined();
    expect(scrubber().props["aria-valuetext"]).toBe("Live");
  });

  it("ArrowRight and ArrowLeft move by the step and report onScrubEnd", async () => {
    const onScrubEnd = jest.fn();
    await render(<MediaScrubber value={30} duration={100} step={10} onScrubEnd={onScrubEnd} />);

    const right = key("ArrowRight");
    await press(right);
    const left = key("ArrowLeft");
    await press(left);

    expect(onScrubEnd.mock.calls).toEqual([[40], [20]]);
    expect(right.preventDefault).toHaveBeenCalledTimes(1);
    expect(left.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("steps 5 s by default and clamps at both ends", async () => {
    const onScrubEnd = jest.fn();
    const { rerender } = await render(<MediaScrubber value={98} duration={100} onScrubEnd={onScrubEnd} />);
    await press(key("ArrowRight"));
    expect(onScrubEnd).toHaveBeenLastCalledWith(100);

    await rerender(<MediaScrubber value={2} duration={100} onScrubEnd={onScrubEnd} />);
    await press(key("ArrowLeft"));
    expect(onScrubEnd).toHaveBeenLastCalledWith(0);
  });

  it("Home seeks to the start and End to the duration", async () => {
    const onScrubEnd = jest.fn();
    await render(<MediaScrubber value={30} duration={100} onScrubEnd={onScrubEnd} />);

    await press(key("Home"));
    await press(key("End"));

    expect(onScrubEnd.mock.calls).toEqual([[0], [100]]);
  });

  it("passes other keys, and chorded keys, through without preventing them", async () => {
    const onScrubEnd = jest.fn();
    await render(<MediaScrubber value={30} duration={100} onScrubEnd={onScrubEnd} />);

    for (const event of [
      key("a"),
      key(" "),
      key("ArrowUp"),
      key("ArrowRight", { metaKey: true }),
      key("ArrowRight", { ctrlKey: true }),
      key("ArrowLeft", { altKey: true }),
    ]) {
      await press(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(onScrubEnd).not.toHaveBeenCalled();
  });

  it("ignores keys when disabled", async () => {
    const onScrubEnd = jest.fn();
    await render(<MediaScrubber value={30} duration={100} disabled onScrubEnd={onScrubEnd} />);

    const event = key("ArrowRight");
    await press(event);

    expect(onScrubEnd).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("shows the kit's focus ring on keyboard focus only", async () => {
    await render(<MediaScrubber value={30} duration={100} />);
    // RNTL swallows events aimed at a touch responder that declines the touch,
    // which the scrubber does until it has a width: lay it out first.
    await act(async () => {
      scrubber().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } } });
    });

    const ring = () => typeof (StyleSheet.flatten(scrubber().props.style) as Record<string, unknown>).boxShadow === "string";
    expect(ring()).toBe(false);

    await fireEvent(scrubber(), "focus", { nativeEvent: { target: { matches: () => false } } });
    expect(ring()).toBe(false);

    await fireEvent(scrubber(), "focus", { nativeEvent: { target: { matches: () => true } } });
    expect(ring()).toBe(true);

    await fireEvent(scrubber(), "blur", {});
    expect(ring()).toBe(false);
  });
});
