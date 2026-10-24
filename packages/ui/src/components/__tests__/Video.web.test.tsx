/**
 * Video on web: keyboard shortcuts, fullscreen of the frame, hover, and the
 * facts react-native-web's `expo-video` leaves to the `<video>` element.
 * `./forceWebPlatform` first, see that file.
 *
 * What this covers: the branches `Video` takes when `Platform.OS` is "web".
 * The DOM is not available, so the browser fullscreen calls are a mocked
 * module (`lib/webFullscreen`), and the web `VideoView`'s `<video>` is a fake
 * element exposed as `nativeRef`, as the real one does. The actual browser
 * behavior (fullscreen, hover, keyboard, the controls) is checked against the
 * built site, see the media-video PR.
 */
import "./forceWebPlatform";

import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { asPlayer, type TestPlayer } from "./videoTestTypes";
import * as webFullscreen from "../../lib/webFullscreen";
import { Video, type VideoProps } from "../Video";

interface FakeElement {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  dispatch: (type: string) => void;
}

function fakeElement(overrides: Partial<FakeElement> = {}): FakeElement {
  const listeners = new Map<string, Set<() => void>>();
  return {
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    addEventListener: jest.fn((type: string, listener: () => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    }),
    removeEventListener: jest.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch: (type: string) => [...(listeners.get(type) ?? [])].forEach((listener) => listener()),
    ...overrides,
  };
}

let mockElement: FakeElement = fakeElement();
let mockInnerHandle: { enterFullscreen: jest.Mock } | null = null;

jest.mock("expo-video", () => {
  const actual = require("@/test/mocks/expoVideo");
  const React = require("react");
  // The web `VideoView` hands out its `<video>` as `nativeRef`; the shared fake does not.
  const VideoView = React.forwardRef(function MockWebVideoView(props: Record<string, unknown>, ref: React.Ref<unknown>) {
    const inner = React.useRef(null);
    React.useImperativeHandle(ref, () => ({
      enterFullscreen: (...args: unknown[]) => (inner.current as { enterFullscreen: (...a: unknown[]) => unknown } | null)?.enterFullscreen(...args),
      exitFullscreen: (...args: unknown[]) => (inner.current as { exitFullscreen: (...a: unknown[]) => unknown } | null)?.exitFullscreen(...args),
      nativeRef: { current: mockElement },
    }), []);
    React.useEffect(() => {
      mockInnerHandle = inner.current;
    });
    return React.createElement(actual.VideoView, { ...props, ref: inner });
  });
  return { ...actual, VideoView };
});

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

jest.mock("../../lib/webFullscreen", () => ({
  supportsElementFullscreen: jest.fn(),
  getFullscreenElement: jest.fn(),
  enterElementFullscreen: jest.fn(),
  exitElementFullscreen: jest.fn(),
  subscribeFullscreenChange: jest.fn(),
}));

// react-native only reports a hover after a real mouse move on a DOM.
jest.mock("react-native/Libraries/Pressability/HoverState", () => ({ isHoverEnabled: () => true }));

// The fade is a JS-driven `Animated` loop on web: skipped here, and covered natively.
jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => true,
}));

const fullscreen = webFullscreen as jest.Mocked<typeof webFullscreen>;
let onFullscreenChange: () => void = () => {};

// A player built outside any component, for the caller-owned `player` prop. `require`, not `import`:
// this package's own typecheck has no `@/*` alias to resolve the fake's path.
const { createVideoPlayer } = require("@/test/mocks/expoVideo") as { createVideoPlayer: (source?: unknown) => TestPlayer };

const hidden = { includeHiddenElements: true } as const;
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const URI = "https://example.com/a.mp4";
const frame = () => screen.getByTestId("video", hidden);
const view = () => screen.getByTestId("video-view", hidden);
const player = () => view().props.player as TestPlayer;
const chrome = () => screen.getByTestId("video-chrome", hidden);
const shown = () => flat(chrome()).pointerEvents !== "none";

async function mount(props: Partial<VideoProps> = {}) {
  return render(<Video source={URI} controls="custom" {...props} />);
}

const emit = (event: string, payload?: unknown) =>
  act(async () => {
    player().emit(event, payload);
  });

const startPlaying = async () => {
  player().playing = true;
  await emit("statusChange", { status: "readyToPlay" });
  await emit("playingChange", { isPlaying: true });
};

/** A web keydown: the DOM event react-native-web hands `onKeyDown`. */
const keyEvent = (key: string, extra: Record<string, unknown> = {}) => ({ key, preventDefault: jest.fn(), ...extra });
async function press(key: string, extra: Record<string, unknown> = {}) {
  const event = keyEvent(key, extra);
  await act(async () => void frame().props.onKeyDown(event));
  return event;
}

beforeEach(() => {
  mockElement = fakeElement();
  mockInnerHandle = null;
  onFullscreenChange = () => {};
  fullscreen.getFullscreenElement.mockReturnValue(null);
  fullscreen.enterElementFullscreen.mockResolvedValue(true);
  fullscreen.exitElementFullscreen.mockResolvedValue(undefined);
  fullscreen.subscribeFullscreenChange.mockImplementation((listener) => {
    onFullscreenChange = listener;
    return () => {};
  });
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Video (web) frame", () => {
  it("is a focusable group named by the title, not an accessible element that would hide its buttons", async () => {
    await mount({ title: "Product tour" });

    expect(frame().props).toEqual(expect.objectContaining({ focusable: true, role: "group", accessibilityLabel: "Product tour" }));
    expect(frame().props.accessible).toBeUndefined();
    expect(frame().props.accessibilityActions).toBeUndefined();
  });

  it("is not a keyboard target under native controls or bare playback", async () => {
    const { rerender } = await mount({ controls: "native" });
    expect(frame().props.onKeyDown).toBeUndefined();
    expect(frame().props.focusable).toBeUndefined();

    await rerender(<Video source={URI} controls="none" />);
    expect(frame().props.onKeyDown).toBeUndefined();
  });

  it("plays inline, with the video out of the way of the frame's clicks", async () => {
    await mount();

    expect(view().props.playsInline).toBe(true);
    expect(flat(view()).pointerEvents).toBe("none");
  });

  it("starts for autoPlay once it is mounted", async () => {
    await mount({ autoPlay: true, muted: true });

    expect(player().play).toHaveBeenCalledTimes(1);
    expect(player().muted).toBe(true);
  });
});

describe("Video (web) keyboard", () => {
  it("Space and K play and pause, and are kept from scrolling the page", async () => {
    await mount();

    const space = await press(" ");
    expect(player().play).toHaveBeenCalledTimes(1);
    expect(space.preventDefault).toHaveBeenCalled();

    await startPlaying();
    await press("k");
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("replays after the end", async () => {
    await mount();
    await emit("playToEnd");

    await press(" ");

    expect(player().replay).toHaveBeenCalledTimes(1);
  });

  it("← and → seek 5 s, clamped to the clip", async () => {
    jest.useFakeTimers();
    await mount();
    player().duration = 60;
    await emit("statusChange", { status: "readyToPlay" });
    // Each step waits out the settle window that holds the readout at the last seek.
    const settle = () =>
      act(async () => {
        jest.advanceTimersByTime(600);
      });
    await emit("timeUpdate", { currentTime: 30, bufferedPosition: 0 });

    await press("ArrowRight");
    expect(player().currentTime).toBe(35);

    await settle();
    await emit("timeUpdate", { currentTime: 35.1, bufferedPosition: 0 });
    await press("ArrowLeft");
    expect(player().currentTime).toBeCloseTo(30.1);

    await settle();
    await emit("timeUpdate", { currentTime: 3, bufferedPosition: 0 });
    await press("ArrowLeft");
    expect(player().currentTime).toBe(0);

    await settle();
    await emit("timeUpdate", { currentTime: 58, bufferedPosition: 0 });
    await press("ArrowRight");
    expect(player().currentTime).toBe(60);
  });

  it("↑ and ↓ change the volume by 0.1 within 0 to 1, and ↑ unmutes", async () => {
    await mount();
    player().volume = 0.5;

    await press("ArrowUp");
    expect(player().volume).toBeCloseTo(0.6);
    await press("ArrowDown");
    await press("ArrowDown");
    expect(player().volume).toBeCloseTo(0.4);

    player().volume = 0.95;
    await press("ArrowUp");
    expect(player().volume).toBe(1);

    player().volume = 0.02;
    await press("ArrowDown");
    expect(player().volume).toBe(0);

    player().muted = true;
    await press("ArrowUp");
    expect(player().muted).toBe(false);
  });

  it("M toggles mute", async () => {
    await mount();

    await press("m");
    expect(player().muted).toBe(true);
    await press("M");
    expect(player().muted).toBe(false);
  });

  it("F makes the frame itself fullscreen, so the custom chrome stays", async () => {
    await mount();

    const event = await press("f");

    expect(fullscreen.enterElementFullscreen).toHaveBeenCalledTimes(1);
    expect(fullscreen.enterElementFullscreen).toHaveBeenCalledWith(expect.anything());
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockInnerHandle?.enterFullscreen).not.toHaveBeenCalled();
  });

  it("F falls back to the video's own fullscreen where an element cannot go fullscreen (iPhone Safari)", async () => {
    fullscreen.enterElementFullscreen.mockResolvedValue(false);
    await mount();

    await press("F");
    await act(async () => {});

    expect(mockInnerHandle?.enterFullscreen).toHaveBeenCalledTimes(1);
  });

  it("F does nothing when fullscreen is not allowed", async () => {
    await mount({ allowsFullscreen: false });

    const event = await press("f");

    expect(fullscreen.enterElementFullscreen).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("tracks the browser's fullscreen state: the button says minimize, and F and Esc leave", async () => {
    await mount();
    await press("f");
    const node = fullscreen.enterElementFullscreen.mock.calls[0][0];

    fullscreen.getFullscreenElement.mockReturnValue(node);
    await act(async () => onFullscreenChange());
    expect(screen.getByTestId("icon-minimize", hidden)).toBeTruthy();
    expect(screen.getByTestId("video-fullscreen-toggle", hidden).props.accessibilityLabel).toBe("Exit full screen");

    await press("Escape");
    expect(fullscreen.exitElementFullscreen).toHaveBeenCalledTimes(1);

    await press("f");
    expect(fullscreen.exitElementFullscreen).toHaveBeenCalledTimes(2);

    fullscreen.getFullscreenElement.mockReturnValue(null);
    await act(async () => onFullscreenChange());
    expect(screen.getByTestId("icon-maximize", hidden)).toBeTruthy();
  });

  it("ignores another element's fullscreen", async () => {
    await mount();

    fullscreen.getFullscreenElement.mockReturnValue({ some: "other element" });
    await act(async () => onFullscreenChange());

    expect(screen.getByTestId("icon-maximize", hidden)).toBeTruthy();
  });

  it("leaves Escape to the page when nothing is fullscreen", async () => {
    await mount();

    const event = await press("Escape");

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(fullscreen.exitElementFullscreen).not.toHaveBeenCalled();
  });

  it("clicking the fullscreen button does the same as F", async () => {
    await mount();

    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    expect(fullscreen.enterElementFullscreen).toHaveBeenCalledTimes(1);
  });

  it("passes other keys, and chorded keys, through untouched", async () => {
    await mount();

    for (const event of [await press("a"), await press("m", { metaKey: true }), await press("ArrowRight", { ctrlKey: true }), await press("f", { altKey: true })]) {
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(player().play).not.toHaveBeenCalled();
    expect(player().muted).toBe(false);
    expect(fullscreen.enterElementFullscreen).not.toHaveBeenCalled();
  });

  it("leaves Space to a button inside the frame, which Space presses", async () => {
    await mount();
    const button = { tagName: "BUTTON", closest: () => ({}) };

    const event = await press(" ", { target: button, currentTarget: {} });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(player().play).not.toHaveBeenCalled();
  });

  it("brings the chrome back", async () => {
    jest.useFakeTimers();
    await mount();
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(shown()).toBe(false);

    await press("ArrowRight");

    expect(shown()).toBe(true);
  });
});

describe("Video (web) chrome", () => {
  it("shows on hover and hides 3 s after the pointer leaves", async () => {
    jest.useFakeTimers();
    await mount();
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(shown()).toBe(false);

    const surface = screen.getByTestId("video-surface", hidden);
    await act(async () => surface.props.onMouseEnter({}));
    expect(shown()).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(shown()).toBe(true);

    await act(async () => surface.props.onMouseLeave({}));
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(shown()).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(shown()).toBe(false);
  });

  it("hides on its own: react-native-web's always-true screen reader flag is not consulted", async () => {
    jest.useFakeTimers();
    await mount();
    await startPlaying();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(AccessibilityInfo.isScreenReaderEnabled).not.toHaveBeenCalled();
    expect(shown()).toBe(false);
  });

  it("does not hide the chrome from assistive technology on web, where its buttons stay tabbable", async () => {
    jest.useFakeTimers();
    await mount();
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(shown()).toBe(false);
    expect(chrome().props["aria-hidden"]).toBeUndefined();
  });

  it("comes back when focus lands inside the frame", async () => {
    jest.useFakeTimers();
    await mount();
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await act(async () => frame().props.onFocus({}));

    expect(shown()).toBe(true);
  });
});

describe("Video (web) natural size", () => {
  it("takes the ratio from the <video> once its metadata loads", async () => {
    mockElement = fakeElement();
    await mount({ aspectRatio: "auto" });
    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);

    mockElement.videoWidth = 1080;
    mockElement.videoHeight = 1920;
    await act(async () => mockElement.dispatch("loadedmetadata"));

    expect(flat(frame()).aspectRatio).toBeCloseTo(9 / 16);
  });

  it("reads a <video> whose metadata is already there", async () => {
    mockElement = fakeElement({ videoWidth: 480, videoHeight: 480, readyState: 1 });
    await mount({ aspectRatio: "auto" });

    expect(flat(frame()).aspectRatio).toBeCloseTo(1);
  });

  it("keeps an explicit ratio", async () => {
    mockElement = fakeElement({ videoWidth: 480, videoHeight: 480, readyState: 1 });
    await mount({ aspectRatio: "4:3" });

    expect(flat(frame()).aspectRatio).toBeCloseTo(4 / 3);
  });

  it("keeps the fallback ratio and the poster for a file with no picture", async () => {
    mockElement = fakeElement({ videoWidth: 0, videoHeight: 0, readyState: 1 });
    await mount({ poster: "https://example.com/p.jpg" });
    await startPlaying();

    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
    expect(screen.getByTestId("video-poster", hidden)).toBeTruthy();
  });

  it("does not take the browser's first-frame event as proof of a picture: it fires for audio too", async () => {
    mockElement = fakeElement({ videoWidth: 0, videoHeight: 0, readyState: 1 });
    await mount({ poster: "https://example.com/p.jpg" });
    await startPlaying();

    await act(async () => view().props.onFirstFrameRender());

    expect(screen.getByTestId("video-poster", hidden)).toBeTruthy();
  });

  it("stops listening when it unmounts", async () => {
    const { unmount } = await mount();
    const element = mockElement;
    expect(element.addEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));

    await unmount();

    expect(element.removeEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
    expect(element.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
  });
});

describe("Video (web) retry", () => {
  it("returns to the error when the browser fails again, though the player repeats no status", async () => {
    const onError = jest.fn();
    await mount({ onError });
    await emit("statusChange", { status: "error", error: { message: "first" } });
    expect(onError).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("video-retry", hidden));
    expect(player().replaceAsync).toHaveBeenCalledWith(URI);
    expect(screen.getByTestId("video-loading", hidden)).toBeTruthy();

    // The web player is still `error`, so it emits nothing: the <video> element's own event ends the retry.
    await act(async () => mockElement.dispatch("error"));

    expect(screen.getByTestId("video-error", hidden)).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith("Video failed to load");
  });

  it("does not report a failure the player already reported", async () => {
    const onError = jest.fn();
    await mount({ onError });

    await act(async () => mockElement.dispatch("error"));
    expect(onError).not.toHaveBeenCalled();

    await emit("statusChange", { status: "error" });
    await act(async () => mockElement.dispatch("error"));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("Video (web) player", () => {
  it("does not set the time update interval during render, which would start a timer on the server", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    const intervals: number[] = [];
    Object.defineProperty(own, "timeUpdateEventInterval", {
      get: () => intervals[intervals.length - 1] ?? 0,
      set: (value: number) => void intervals.push(value),
    });

    const { unmount } = await render(<Video player={asPlayer(own)} controls="custom" />);
    expect(intervals).toEqual([0.25]);

    await unmount();
    expect(intervals).toEqual([0.25, 0]);
  });
});
