/**
 * useMediaKeyboard on web: shortcuts scoped to one focusable container.
 * `./forceWebPlatform` first, see that file.
 */
import "../../components/__tests__/forceWebPlatform";

import React from "react";
import { Platform, View } from "react-native";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import { useMediaKeyboard, type MediaKeyboardAction, type MediaKeyboardHandlers } from "../useMediaKeyboard";

type FakeEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
  currentTarget?: unknown;
  preventDefault: jest.Mock;
};

const keydown = (key: string, extra: Partial<FakeEvent> = {}): FakeEvent => ({
  key,
  preventDefault: jest.fn(),
  ...extra,
});

const ALL_ACTIONS: MediaKeyboardAction[] = [
  "togglePlay",
  "seekBack",
  "seekForward",
  "volumeUp",
  "volumeDown",
  "toggleMute",
  "toggleFullscreen",
  "escape",
  "previous",
  "next",
  "zoomIn",
  "zoomOut",
  "zoomReset",
];

function handlers(names: MediaKeyboardAction[] = ALL_ACTIONS) {
  const fns = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<MediaKeyboardAction, jest.Mock>;
  return fns as unknown as MediaKeyboardHandlers & Record<MediaKeyboardAction, jest.Mock>;
}

async function setup(h: MediaKeyboardHandlers) {
  const { result } = await renderHook(() => useMediaKeyboard(h));
  const props = result.current;
  return {
    props,
    send: async (event: FakeEvent) => {
      await act(async () => void props.onKeyDown?.(event));
      return event;
    },
  };
}

describe("useMediaKeyboard (web)", () => {
  it("returns focusable props with a key handler", async () => {
    const { props } = await setup(handlers());

    expect(props.focusable).toBe(true);
    expect(typeof props.onKeyDown).toBe("function");
  });

  it("returns nothing on native", async () => {
    const original = Platform.OS;
    Platform.OS = "ios";
    try {
      const { result } = await renderHook(() => useMediaKeyboard(handlers()));
      expect(result.current).toEqual({});
    } finally {
      Platform.OS = original;
    }
  });

  it.each<[string, MediaKeyboardAction]>([
    [" ", "togglePlay"],
    ["k", "togglePlay"],
    ["K", "togglePlay"],
    ["ArrowLeft", "seekBack"],
    ["ArrowRight", "seekForward"],
    ["ArrowUp", "volumeUp"],
    ["ArrowDown", "volumeDown"],
    ["m", "toggleMute"],
    ["f", "toggleFullscreen"],
    ["Escape", "escape"],
    ["+", "zoomIn"],
    ["=", "zoomIn"],
    ["-", "zoomOut"],
    ["0", "zoomReset"],
  ])("key %j calls %s and prevents the default", async (key, action) => {
    const h = handlers();
    const { send } = await setup(h);

    const event = await send(keydown(key));

    expect(h[action]).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    for (const other of ALL_ACTIONS.filter((name) => name !== action)) {
      expect(h[other]).not.toHaveBeenCalled();
    }
  });

  it("ignores auto-repeat for toggles, but still claims the key", async () => {
    const h = handlers();
    const { send } = await setup(h);

    for (const key of [" ", "k", "m", "f", "Escape"]) {
      const event = await send({ ...keydown(key), repeat: true });
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    }
    for (const action of ["togglePlay", "toggleMute", "toggleFullscreen", "escape"] as const) {
      expect(h[action]).not.toHaveBeenCalled();
    }
  });

  it("lets seek, volume and zoom keys repeat while held", async () => {
    const h = handlers();
    const { send } = await setup(h);

    await send({ ...keydown("ArrowRight"), repeat: true });
    await send({ ...keydown("ArrowUp"), repeat: true });
    await send({ ...keydown("+"), repeat: true });

    expect(h.seekForward).toHaveBeenCalledTimes(1);
    expect(h.volumeUp).toHaveBeenCalledTimes(1);
    expect(h.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("arrows fall back to previous / next when there is no seek handler", async () => {
    const h = handlers(["previous", "next"]);
    const { send } = await setup(h);

    await send(keydown("ArrowLeft"));
    await send(keydown("ArrowRight"));

    expect(h.previous).toHaveBeenCalledTimes(1);
    expect(h.next).toHaveBeenCalledTimes(1);
  });

  it("arrows prefer seek handlers over previous / next", async () => {
    const h = handlers(["seekBack", "seekForward", "previous", "next"]);
    const { send } = await setup(h);

    await send(keydown("ArrowLeft"));
    await send(keydown("ArrowRight"));

    expect(h.seekBack).toHaveBeenCalledTimes(1);
    expect(h.seekForward).toHaveBeenCalledTimes(1);
    expect(h.previous).not.toHaveBeenCalled();
    expect(h.next).not.toHaveBeenCalled();
  });

  it("passes a key through, unprevented, when no handler was given for it", async () => {
    const h = handlers(["togglePlay"]);
    const { send } = await setup(h);

    for (const key of ["ArrowLeft", "ArrowUp", "m", "f", "Escape", "+", "0", "a", "Enter", "Tab"]) {
      const event = await send(keydown(key));
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(h.togglePlay).not.toHaveBeenCalled();
  });

  it.each(["INPUT", "TEXTAREA", "SELECT"])("ignores events whose target is a %s", async (tagName) => {
    const h = handlers();
    const { send } = await setup(h);

    for (const key of [" ", "k", "ArrowLeft", "m", "f", "Escape", "0"]) {
      const event = await send(keydown(key, { target: { tagName } }));
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    for (const name of ALL_ACTIONS) expect(h[name]).not.toHaveBeenCalled();
  });

  it("ignores an editable target", async () => {
    const h = handlers();
    const { send } = await setup(h);

    const event = await send(keydown("k", { target: { tagName: "DIV", isContentEditable: true } }));

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(h.togglePlay).not.toHaveBeenCalled();
  });

  it("never hijacks browser chords (Cmd/Ctrl/Alt held)", async () => {
    const h = handlers();
    const { send } = await setup(h);

    for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
      for (const key of ["f", "0", "-", "=", "k", "ArrowLeft"]) {
        const event = await send(keydown(key, { [modifier]: true }));
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    }
    for (const name of ALL_ACTIONS) expect(h[name]).not.toHaveBeenCalled();
  });

  it("skips an event a child already handled (defaultPrevented)", async () => {
    const h = handlers();
    const { send } = await setup(h);

    const event = await send(keydown("ArrowRight", { defaultPrevented: true }));

    expect(h.seekForward).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("leaves Space to a button inside the container, which Space presses", async () => {
    const h = handlers();
    const { send } = await setup(h);
    const container = {};
    const button = { tagName: "BUTTON", closest: (selector: string) => (selector.includes("button") ? button : null) };

    const onButton = await send(keydown(" ", { target: button, currentTarget: container }));
    expect(onButton.preventDefault).not.toHaveBeenCalled();
    expect(h.togglePlay).not.toHaveBeenCalled();

    // `k` has no click meaning on a button, and Space on the container itself still toggles.
    await send(keydown("k", { target: button, currentTarget: container }));
    expect(h.togglePlay).toHaveBeenCalledTimes(1);
    const onContainer = await send(
      keydown(" ", { target: container, currentTarget: container }),
    );
    expect(onContainer.preventDefault).toHaveBeenCalledTimes(1);
    expect(h.togglePlay).toHaveBeenCalledTimes(2);
  });

  it("reads the latest handlers without changing the onKeyDown identity", async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await renderHook(
      ({ togglePlay }: { togglePlay: () => void }) => useMediaKeyboard({ togglePlay }),
      { initialProps: { togglePlay: first } },
    );
    const onKeyDown = result.current.onKeyDown;

    await rerender({ togglePlay: second });
    await act(async () => void result.current.onKeyDown?.(keydown("k")));

    expect(result.current.onKeyDown).toBe(onKeyDown);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("spreads onto a View, which gets the container props and only the container's keys", async () => {
    const h = handlers();
    function Surface() {
      const keyboard = useMediaKeyboard(h);
      return <View testID="surface" {...keyboard} />;
    }
    await render(<Surface />);

    const surface = screen.getByTestId("surface");
    expect(surface.props.focusable).toBe(true);
    await act(async () => void surface.props.onKeyDown(keydown("m")));
    expect(h.toggleMute).toHaveBeenCalledTimes(1);
  });
});
