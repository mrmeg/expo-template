/**
 * Video: controls modes, sizing, states, scrubbing, auto-hide, fullscreen and
 * player ownership. iOS is the jest-expo default; web has its own file.
 *
 * `expo-video` is the opt-in fake (`test/mocks/expoVideo`): events are driven
 * with `player.emit(...)`, and the player a `Video` created is read off the
 * `player` prop of its `VideoView`. `expo-image` is a `View` that receives
 * every prop. `MediaScrubber` is the real one, wrapped to hand the test its
 * callbacks (its own drag handling is tested in `MediaScrubber.test.tsx`).
 */
import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { asPlayer, type TestPlayer } from "./videoTestTypes";
import { Video, type VideoProps } from "../Video";
import { pickCaptionTrack } from "../videoPlayback";
import type { MediaScrubberProps } from "../MediaScrubber";
import * as componentsBarrel from "../index";

jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

// RNTL 14 has no by-type query, so the native Modal is a tagged View that keeps its
// props and, like the real one, renders nothing while it is not visible.
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const { View } = require("react-native");
  function MockModal({ children, visible = true, ...props }: { children?: React.ReactNode; visible?: boolean }) {
    return visible ? React.createElement(View, { testID: "rn-modal", visible, ...props }, children) : null;
  }
  return { __esModule: true, default: MockModal };
});

let mockReducedMotion = false;
jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

// A phone with a notch and a home indicator.
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
jest.mock("../../hooks/useWindowInsets", () => ({
  useWindowInsets: () => mockInsets,
}));

let mockScrubberProps: MediaScrubberProps | null = null;
jest.mock("../MediaScrubber", () => {
  const actual = jest.requireActual("../MediaScrubber");
  const { createElement } = require("react");
  return {
    MediaScrubber: (props: MediaScrubberProps) => {
      mockScrubberProps = props;
      return createElement(actual.MediaScrubber, props);
    },
  };
});

// A player built outside any component, for the caller-owned `player` prop. `require`, not `import`:
// this package's own typecheck has no `@/*` alias to resolve the fake's path.
const { createVideoPlayer } = require("@/test/mocks/expoVideo") as { createVideoPlayer: (source?: unknown) => TestPlayer };

const hidden = { includeHiddenElements: true } as const;
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const URI = "https://example.com/a.mp4";
const frame = () => screen.getByTestId("video", hidden);
const view = () => screen.getByTestId("video-view", hidden);
const player = () => view().props.player as TestPlayer;
const chrome = () => screen.queryByTestId("video-chrome", hidden);
const scrubber = () => mockScrubberProps as MediaScrubberProps;
const timeText = () => {
  const children = screen.getByTestId("video-time", hidden).props.children;
  return Array.isArray(children) ? children.join("") : String(children);
};

async function mount(props: Partial<VideoProps> = {}) {
  return render(<Video source={URI} {...props} />);
}

/** Drive a player event the way the native module would. */
const emit = (event: string, payload?: unknown) =>
  act(async () => {
    player().emit(event, payload);
  });

/** Playing and past loading: the chrome shows its play controls, not the spinner. */
const startPlaying = async () => {
  player().playing = true;
  await emit("statusChange", { status: "readyToPlay" });
  await emit("playingChange", { isPlaying: true });
};

beforeEach(() => {
  mockReducedMotion = false;
  mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  mockScrubberProps = null;
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("controls", () => {
  it('"native" sets nativeControls and the platform fullscreen, and draws no chrome', async () => {
    await mount({ controls: "native" });

    expect(view().props.nativeControls).toBe(true);
    expect(view().props.fullscreenOptions).toEqual({ enable: true });
    expect(chrome()).toBeNull();
  });

  it("is native by default, and allowsFullscreen={false} removes the platform's fullscreen", async () => {
    await mount({ allowsFullscreen: false });

    expect(view().props.nativeControls).toBe(true);
    expect(view().props.fullscreenOptions).toEqual({ enable: false });
  });

  it('"none" turns the native controls off and draws no chrome', async () => {
    await mount({ controls: "none" });

    expect(view().props.nativeControls).toBe(false);
    expect(chrome()).toBeNull();
  });

  it('"custom" turns the native controls off and draws the kit chrome', async () => {
    await mount({ controls: "custom" });

    expect(view().props.nativeControls).toBe(false);
    for (const id of ["center", "play", "scrubber", "time", "mute", "fullscreen-toggle"]) {
      expect(screen.getByTestId(`video-${id}`, hidden)).toBeTruthy();
    }
    expect(screen.queryByTestId("video-captions", hidden)).toBeNull();
  });

  it("allowsFullscreen={false} leaves the fullscreen button out of the custom bar", async () => {
    await mount({ controls: "custom", allowsFullscreen: false });

    expect(screen.queryByTestId("video-fullscreen-toggle", hidden)).toBeNull();
  });

  it("passes fit and Picture in Picture through, and plays inline", async () => {
    await mount({ fit: "cover", allowsPictureInPicture: false });

    expect(view().props).toEqual(
      expect.objectContaining({ contentFit: "cover", allowsPictureInPicture: false, playsInline: true }),
    );
  });

  it("lets the platform's controls take touches, and keeps the video out of the way otherwise", async () => {
    const { rerender } = await mount({ controls: "native" });
    expect(flat(view()).pointerEvents).toBeUndefined();

    await rerender(<Video source={URI} controls="custom" />);
    expect(flat(view()).pointerEvents).toBe("none");
  });
});

describe("frame", () => {
  it("is 16:9 until the video reports its size, then takes its ratio", async () => {
    await mount({ aspectRatio: "auto" });
    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);

    await emit("videoTrackChange", { videoTrack: { size: { width: 360, height: 640 } } });

    expect(flat(frame()).aspectRatio).toBeCloseTo(9 / 16);
  });

  it("is auto by default", async () => {
    await mount();
    await emit("videoTrackChange", { videoTrack: { size: { width: 480, height: 480 } } });

    expect(flat(frame()).aspectRatio).toBeCloseTo(1);
  });

  it("keeps an explicit ratio whatever the video reports", async () => {
    await mount({ aspectRatio: "4:3" });
    await emit("videoTrackChange", { videoTrack: { size: { width: 360, height: 640 } } });

    expect(flat(frame()).aspectRatio).toBeCloseTo(4 / 3);
  });

  it("ignores a track with no picture", async () => {
    await mount();
    await emit("videoTrackChange", { videoTrack: null });
    await emit("videoTrackChange", { videoTrack: { size: { width: 0, height: 0 } } });

    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
  });

  it("caps the height through the width, and fills a positioned parent", async () => {
    const { rerender } = await mount({ aspectRatio: "9:16", maxHeight: 320 });
    expect(flat(frame())).toEqual(expect.objectContaining({ width: "100%", alignSelf: "center" }));
    expect(flat(frame()).maxWidth).toBeCloseTo(320 * (9 / 16));

    await rerender(<Video source={URI} fill />);
    expect(flat(frame())).toEqual(expect.objectContaining({ position: "absolute", top: 0, bottom: 0 }));
  });

  it("is black, clips, and takes the radius and the caller's style", async () => {
    await mount({ aspectRatio: 1, radius: "lg", style: { marginTop: 8 } });

    expect(flat(frame())).toEqual(
      expect.objectContaining({ backgroundColor: "#000000", overflow: "hidden", borderRadius: 14, marginTop: 8 }),
    );
  });

  it("reads the track the player already has when it subscribes", async () => {
    // The fake builds the player inside the component, so seed it through a caller-owned one.
    const seeded: TestPlayer = createVideoPlayer(URI);
    seeded.videoTrack = { size: { width: 1080, height: 1920 } };
    await render(<Video player={asPlayer(seeded)} aspectRatio="auto" />);

    expect(flat(frame()).aspectRatio).toBeCloseTo(9 / 16);
  });
});

describe("states", () => {
  it("shows a spinner while loading, over the poster, and removes it once ready", async () => {
    await mount({ poster: "https://example.com/p.jpg" });
    expect(screen.queryByTestId("video-loading", hidden)).toBeNull();

    await emit("statusChange", { status: "loading" });
    expect(screen.getByTestId("video-loading", hidden)).toBeTruthy();
    expect(screen.getByTestId("video-poster", hidden)).toBeTruthy();

    await emit("statusChange", { status: "readyToPlay" });
    expect(screen.queryByTestId("video-loading", hidden)).toBeNull();
  });

  it("treats idle while playing as loading, which is how the web player reports a buffering start", async () => {
    await mount();
    player().playing = true;
    await emit("playingChange", { isPlaying: true });

    expect(screen.getByTestId("video-loading", hidden)).toBeTruthy();

    await emit("statusChange", { status: "readyToPlay" });
    expect(screen.queryByTestId("video-loading", hidden)).toBeNull();
  });

  it("shows the error text and a retry button, and reports the failure", async () => {
    const onError = jest.fn();
    await mount({ title: "Intro", onError });

    await emit("statusChange", { status: "error", error: { message: "Could not decode" } });

    const error = screen.getByTestId("video-error", hidden);
    expect(within(error).getByText("Video failed to load")).toBeTruthy();
    expect(error.props.accessibilityLabel).toBe("Intro. Video failed to load");
    expect(screen.getByTestId("video-retry", hidden)).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Could not decode");
  });

  it("reports the default text when the player gives no message", async () => {
    const onError = jest.fn();
    await mount({ onError });

    await emit("statusChange", { status: "error" });

    expect(onError).toHaveBeenCalledWith("Video failed to load");
  });

  it("retry reloads the source, shows loading, and returns to the error if it fails again", async () => {
    const onError = jest.fn();
    await mount({ onError });
    await emit("statusChange", { status: "error", error: { message: "x" } });

    await fireEvent.press(screen.getByTestId("video-retry", hidden));

    expect(player().replaceAsync).toHaveBeenCalledWith(URI);
    expect(screen.queryByTestId("video-error", hidden)).toBeNull();
    expect(screen.getByTestId("video-loading", hidden)).toBeTruthy();

    await emit("statusChange", { status: "error", error: { message: "again" } });
    expect(screen.getByTestId("video-error", hidden)).toBeTruthy();
    expect(onError).toHaveBeenLastCalledWith("again");
  });

  it("returns to the error state when the reload itself throws", async () => {
    await mount();
    await emit("statusChange", { status: "error" });
    player().replaceAsync.mockRejectedValue(new Error("no network"));

    await fireEvent.press(screen.getByTestId("video-retry", hidden));
    await act(async () => {});

    expect(screen.getByTestId("video-error", hidden)).toBeTruthy();
  });

  it("leaves out the retry button for a caller's player with no source to reload", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    await render(<Video player={asPlayer(own)} />);

    await act(async () => own.emit("statusChange", { status: "error" }));

    expect(screen.getByTestId("video-error", hidden)).toBeTruthy();
    expect(screen.queryByTestId("video-retry", hidden)).toBeNull();
  });

  it("retries a caller's player with the source it was given", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    await render(<Video player={asPlayer(own)} source="https://example.com/b.mp4" />);
    await act(async () => own.emit("statusChange", { status: "error" }));

    await fireEvent.press(screen.getByTestId("video-retry", hidden));

    expect(own.replaceAsync).toHaveBeenCalledWith("https://example.com/b.mp4");
  });

  it("hides the custom chrome in the error state", async () => {
    await mount({ controls: "custom" });
    await emit("statusChange", { status: "error" });

    expect(chrome()).toBeNull();
  });

  it("forwards status, playing and end events", async () => {
    const onStatusChange = jest.fn();
    const onPlayingChange = jest.fn();
    const onEnd = jest.fn();
    await mount({ onStatusChange, onPlayingChange, onEnd });

    await emit("statusChange", { status: "readyToPlay" });
    await emit("playingChange", { isPlaying: true });
    await emit("playToEnd");

    expect(onStatusChange).toHaveBeenCalledWith("readyToPlay");
    expect(onPlayingChange).toHaveBeenCalledWith(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("shows a replay affordance in custom mode after the end, and replays", async () => {
    await mount({ controls: "custom" });
    await startPlaying();
    await emit("playToEnd");

    expect(screen.getByTestId("video-center", hidden).props.accessibilityLabel).toBe("Replay");
    await fireEvent.press(screen.getByTestId("video-center", hidden));

    expect(player().replay).toHaveBeenCalledTimes(1);
  });

  it("does not offer a replay when it loops", async () => {
    await mount({ controls: "custom", loop: true });
    await emit("playToEnd");

    expect(screen.getByTestId("video-center", hidden).props.accessibilityLabel).toBe("Play");
  });
});

describe("poster", () => {
  const POSTER = "https://example.com/p.jpg";

  it("shows until the first play, then goes away", async () => {
    await mount({ poster: POSTER, controls: "custom" });
    expect(screen.getByTestId("expo-image", hidden).props.source).toBe(POSTER);

    await startPlaying();

    expect(screen.queryByTestId("video-poster", hidden)).toBeNull();
  });

  it("is decorative and fills the frame with the video's fit", async () => {
    await mount({ poster: POSTER, fit: "cover" });

    const poster = screen.getByTestId("expo-image", hidden);
    expect(poster.props.contentFit).toBe("cover");
    expect(screen.getByTestId("video-poster-image", hidden).props.accessible).toBe(false);
  });

  it("gets a play button under native controls, which a poster would otherwise hide", async () => {
    await mount({ poster: POSTER, controls: "native" });

    await fireEvent.press(screen.getByTestId("video-poster-play", hidden));

    expect(player().play).toHaveBeenCalledTimes(1);
  });

  it("adds nothing of its own over bare playback", async () => {
    await mount({ poster: POSTER, controls: "none" });

    expect(screen.queryByTestId("video-poster-play", hidden)).toBeNull();
  });

  it("is dropped when it fails to load, instead of covering the video", async () => {
    await mount({ poster: POSTER });

    await act(async () => {
      screen.getByTestId("expo-image", hidden).props.onError({ error: "404" });
    });

    expect(screen.queryByTestId("video-poster", hidden)).toBeNull();
  });

  it("stays for an audio-only file, which has no picture to show", async () => {
    await mount({ poster: POSTER });
    await emit("sourceLoad", { duration: 5, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });
    await startPlaying();

    expect(screen.getByTestId("video-poster", hidden)).toBeTruthy();
  });
});

describe("time and scrubbing", () => {
  const ready = async (duration = 100) => {
    await mount({ controls: "custom" });
    player().duration = duration;
    await emit("statusChange", { status: "readyToPlay" });
  };

  it("sets the time update interval for custom controls only, and gives it back", async () => {
    const { unmount } = await mount({ controls: "custom" });
    expect(player().timeUpdateEventInterval).toBe(0.25);
    const created = player();

    await unmount();
    expect(created.timeUpdateEventInterval).toBe(0);

    await mount({ controls: "native" });
    expect(player().timeUpdateEventInterval).toBe(0);
  });

  it("restores a caller's own interval instead of zeroing it", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    own.timeUpdateEventInterval = 1;
    const { unmount } = await render(<Video player={asPlayer(own)} controls="custom" />);
    expect(own.timeUpdateEventInterval).toBe(0.25);

    await unmount();

    expect(own.timeUpdateEventInterval).toBe(1);
  });

  it("follows timeUpdate in the readout and the scrubber, with buffered", async () => {
    await ready(100);

    await emit("timeUpdate", { currentTime: 10, bufferedPosition: 40, currentLiveTimestamp: null, currentOffsetFromLive: null });

    expect(timeText()).toBe("0:10 / 1:40");
    expect(scrubber()).toEqual(expect.objectContaining({ value: 10, duration: 100, buffered: 40, tone: "overlay" }));
  });

  it("prints h:mm:ss for both numbers once the clip is an hour long", async () => {
    await ready(3900);

    await emit("timeUpdate", { currentTime: 10, bufferedPosition: 0 });

    expect(timeText()).toBe("0:00:10 / 1:05:00");
  });

  it("shows --:-- for a length it does not know yet", async () => {
    await ready(0);

    expect(timeText()).toBe("0:00 / --:--");
  });

  it("pauses when a scrub starts, then seeks and resumes if it was playing", async () => {
    await ready(100);
    await startPlaying();

    await act(async () => scrubber().onScrubStart?.());
    await act(async () => scrubber().onScrubEnd?.(42));

    expect(player().pause).toHaveBeenCalled();
    expect(player().currentTime).toBe(42);
    expect(player().play).toHaveBeenCalledTimes(1);
    expect(player().pause.mock.invocationCallOrder[0]).toBeLessThan(player().play.mock.invocationCallOrder[0]);
  });

  it("seeks without resuming when it was paused", async () => {
    await ready(100);

    await act(async () => scrubber().onScrubStart?.());
    await act(async () => scrubber().onScrubEnd?.(42));

    expect(player().currentTime).toBe(42);
    expect(player().play).not.toHaveBeenCalled();
  });

  it("clamps a seek to the clip", async () => {
    await ready(100);

    await act(async () => scrubber().onScrubEnd?.(250));

    expect(player().currentTime).toBe(100);
  });

  it("holds the thumb at the target while a stale update arrives, then follows again", async () => {
    await ready(100);
    await emit("timeUpdate", { currentTime: 10, bufferedPosition: 0 });

    await act(async () => scrubber().onScrubEnd?.(60));
    expect(scrubber().value).toBe(60);

    await emit("timeUpdate", { currentTime: 10.25, bufferedPosition: 0 });
    expect(scrubber().value).toBe(60);

    await emit("timeUpdate", { currentTime: 60.2, bufferedPosition: 0 });
    expect(scrubber().value).toBeCloseTo(60.2);
  });

  it("follows the player again after the settle window even if it never reached the target", async () => {
    jest.useFakeTimers();
    await ready(100);
    await act(async () => scrubber().onScrubEnd?.(60));

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await emit("timeUpdate", { currentTime: 11, bufferedPosition: 0 });

    expect(scrubber().value).toBe(11);
  });

  it("seeks from the keyboard-less screen reader increment and decrement through the frame", async () => {
    await ready(100);
    await emit("timeUpdate", { currentTime: 30, bufferedPosition: 0 });

    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    expect(player().currentTime).toBe(40);

    await emit("timeUpdate", { currentTime: 40.1, bufferedPosition: 0 });
    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));
    expect(player().currentTime).toBeCloseTo(30.1);
  });

  it("reads Live and disables the scrubber for a live stream", async () => {
    await mount({ controls: "custom" });
    player().isLive = true;
    player().duration = Number.POSITIVE_INFINITY;

    await emit("timeUpdate", { currentTime: 1234, bufferedPosition: 0 });

    expect(timeText()).toBe("Live");
    expect(scrubber()).toEqual(expect.objectContaining({ disabled: true, duration: Number.POSITIVE_INFINITY }));
  });

  it("does not seek a live stream", async () => {
    await mount({ controls: "custom" });
    player().isLive = true;
    await emit("timeUpdate", { currentTime: 5, bufferedPosition: 0 });

    await act(async () => scrubber().onScrubEnd?.(30));

    expect(player().currentTime).toBe(0);
  });

  it("keeps the controls working for a file with no picture", async () => {
    await mount({ controls: "custom" });
    await emit("sourceLoad", { duration: 5, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });

    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
    await fireEvent.press(screen.getByTestId("video-center", hidden));
    expect(player().play).toHaveBeenCalledTimes(1);
  });
});

describe("layout", () => {
  const widen = (width: number) =>
    act(async () => {
      frame().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 200 } } });
    });

  it("puts the scrubber in the bar's row on a wide frame, and on its own row above the buttons on a narrow one", async () => {
    await mount({ controls: "custom" });
    expect(flat(screen.getByTestId("video-scrubber", hidden)).flexGrow).toBeUndefined();

    await widen(800);
    expect(flat(screen.getByTestId("video-scrubber", hidden)).flex).toBe(1);

    await widen(300);
    expect(flat(screen.getByTestId("video-scrubber", hidden)).flex).toBeUndefined();
    for (const id of ["play", "mute", "fullscreen-toggle", "time"]) {
      expect(screen.getByTestId(`video-${id}`, hidden)).toBeTruthy();
    }
  });

  it("shrinks the center play button in a short frame and hides it in a very short one", async () => {
    await mount({ controls: "custom" });
    const center = () => screen.queryByTestId("video-center", hidden);
    const diameter = () => flat(center()!).width;

    const sizeAt = (width: number, height: number) =>
      act(async () => {
        frame().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
      });

    await sizeAt(800, 450);
    expect(diameter()).toBe(56);

    // Wide frame, single-row bar: md fits above it.
    await sizeAt(800, 200);
    expect(diameter()).toBe(40);

    // Narrow frame, two-row bar: a 189 pt phone frame has no room for it.
    await sizeAt(336, 189);
    expect(center()).toBeNull();
    expect(screen.getByTestId("video-play", hidden)).toBeTruthy();

    await sizeAt(800, 124);
    expect(center()).toBeNull();
  });

  it("clears the home indicator and the sides only inside the fullscreen modal", async () => {
    mockInsets = { top: 47, right: 44, bottom: 34, left: 44 };
    await mount({ controls: "custom" });
    const bar = () => flat(screen.getByTestId("video-bar", hidden));
    expect(bar().paddingBottom).toBe(4);
    expect(bar().paddingLeft).toBeUndefined();

    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    expect(bar()).toEqual(expect.objectContaining({ paddingBottom: 38, paddingLeft: 52, paddingRight: 52 }));
  });
});

describe("first frame", () => {
  it("is a picture: a file thought to have none draws it after all", async () => {
    await mount({ poster: "https://example.com/p.jpg" });
    await emit("sourceLoad", { duration: 5, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });
    await startPlaying();
    expect(screen.getByTestId("video-poster", hidden)).toBeTruthy();

    await act(async () => view().props.onFirstFrameRender());

    expect(screen.queryByTestId("video-poster", hidden)).toBeNull();
  });
});

describe("controls behavior", () => {
  it("play and pause follow the player, and the label says what a press does", async () => {
    await mount({ controls: "custom" });
    expect(screen.getByTestId("video-play", hidden).props.accessibilityLabel).toBe("Play");

    await fireEvent.press(screen.getByTestId("video-play", hidden));
    expect(player().play).toHaveBeenCalledTimes(1);

    await startPlaying();
    expect(screen.getByTestId("video-play", hidden).props.accessibilityLabel).toBe("Pause");
    await fireEvent.press(screen.getByTestId("video-center", hidden));
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("toggles mute, and shows the state on the button", async () => {
    await mount({ controls: "custom" });

    await fireEvent.press(screen.getByTestId("video-mute", hidden));
    expect(player().muted).toBe(true);
    await emit("mutedChange", { muted: true });

    const mute = screen.getByTestId("video-mute", hidden);
    expect(mute.props.accessibilityLabel).toBe("Unmute");
    expect(mute.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.getByTestId("icon-volume-x", hidden)).toBeTruthy();
  });

  it("offers captions only once the video has subtitle tracks, and toggles them", async () => {
    const french = { language: "fr", label: "Francais" };
    await mount({ controls: "custom" });
    expect(screen.queryByTestId("video-captions", hidden)).toBeNull();

    await emit("availableSubtitleTracksChange", { availableSubtitleTracks: [french] });
    expect(screen.getByTestId("video-captions", hidden).props.accessibilityLabel).toBe("Turn captions on");

    await fireEvent.press(screen.getByTestId("video-captions", hidden));
    expect(player().subtitleTrack).toBe(french);
    const on = screen.getByTestId("video-captions", hidden);
    expect(on.props.accessibilityLabel).toBe("Turn captions off");
    expect(on.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));

    await fireEvent.press(screen.getByTestId("video-captions", hidden));
    expect(player().subtitleTrack).toBeNull();
  });

  it("learns about subtitle tracks from the source load too", async () => {
    await mount({ controls: "custom" });

    await emit("sourceLoad", {
      duration: 60,
      availableVideoTracks: [{}],
      availableSubtitleTracks: [{ language: "en", label: "English" }],
      availableAudioTracks: [],
    });

    expect(screen.getByTestId("video-captions", hidden)).toBeTruthy();
  });

  it("follows a subtitle track that something else turned on", async () => {
    const english = { language: "en", label: "English" };
    await mount({ controls: "custom" });
    await emit("availableSubtitleTracksChange", { availableSubtitleTracks: [english] });

    await emit("subtitleTrackChange", { subtitleTrack: english });

    expect(screen.getByTestId("video-captions", hidden).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it("picks the device-language track, else the first", () => {
    const tracks = [
      { language: "fr", label: "Francais" },
      { language: "pt-BR", label: "Portugues" },
      { language: "en-US", label: "English" },
    ];

    expect(pickCaptionTrack(tracks, "en")).toBe(tracks[2]);
    expect(pickCaptionTrack(tracks, "pt")).toBe(tracks[1]);
    expect(pickCaptionTrack(tracks, "de")).toBe(tracks[0]);
    expect(pickCaptionTrack(tracks, "")).toBe(tracks[0]);
    expect(pickCaptionTrack([], "en")).toBeNull();
  });
});

describe("chrome visibility", () => {
  const shown = () => flat(chrome() as TestInstance).pointerEvents !== "none";

  it("is up on mount and while paused, however long it waits", async () => {
    jest.useFakeTimers();
    await mount({ controls: "custom" });

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(shown()).toBe(true);
  });

  it("hides 3 s after the last interaction while playing, and hides itself from screen readers", async () => {
    jest.useFakeTimers();
    await mount({ controls: "custom" });
    await startPlaying();

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(shown()).toBe(true);
    expect(chrome()?.props.importantForAccessibility).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(shown()).toBe(false);
    expect(chrome()?.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(chrome()?.props.accessibilityElementsHidden).toBe(true);
  });

  it("restarts the 3 s whenever the frame is touched", async () => {
    jest.useFakeTimers();
    await mount({ controls: "custom" });
    await startPlaying();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await fireEvent.press(screen.getByTestId("video-surface", hidden));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(shown()).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shown()).toBe(false);
  });

  it("comes back on a tap of the frame", async () => {
    jest.useFakeTimers();
    await mount({ controls: "custom" });
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(shown()).toBe(false);

    await fireEvent.press(screen.getByTestId("video-surface", hidden));

    expect(shown()).toBe(true);
  });

  it("comes back when playback pauses", async () => {
    jest.useFakeTimers();
    await mount({ controls: "custom" });
    await startPlaying();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    player().playing = false;
    await emit("playingChange", { isPlaying: false });

    expect(shown()).toBe(true);
  });

  it("never hides under a screen reader", async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await mount({ controls: "custom" });
    await act(async () => {});
    await startPlaying();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(shown()).toBe(true);
  });

  it("starts hiding when the screen reader is turned off", async () => {
    jest.useFakeTimers();
    let changed: (enabled: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_: string, handler: (enabled: boolean) => void) => {
      changed = handler;
      return { remove: jest.fn() };
    }) as never);
    await mount({ controls: "custom" });
    await act(async () => {});
    await startPlaying();

    await act(async () => changed(false));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(shown()).toBe(false);
  });

  it("skips the fade under reduced motion, and still hides", async () => {
    jest.useFakeTimers();
    mockReducedMotion = true;
    await mount({ controls: "custom" });
    await startPlaying();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(shown()).toBe(false);
    expect(flat(chrome() as TestInstance).opacity).toBe(0);
  });
});

describe("fullscreen (native)", () => {
  it("opens a Modal with the same player and chrome, and takes the video out of the frame", async () => {
    await mount({ controls: "custom" });
    const created = player();
    expect(screen.queryByTestId("video-fullscreen", hidden)).toBeNull();

    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    const modal = screen.getByTestId("video-fullscreen", hidden);
    expect(screen.getAllByTestId("video-view", hidden)).toHaveLength(1);
    expect(within(modal).getByTestId("video-view", hidden).props.player).toBe(created);
    expect(within(modal).getByTestId("video-chrome", hidden)).toBeTruthy();
    expect(within(frame()).queryByTestId("video-view", hidden)).toBeNull();
    expect(screen.getByTestId("icon-minimize", hidden)).toBeTruthy();
  });

  it("is a full-bleed black modal that lets the video rotate", async () => {
    await mount({ controls: "custom" });
    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    const modal = screen.getByTestId("rn-modal", hidden);
    expect(modal.props).toEqual(
      expect.objectContaining({
        visible: true,
        presentationStyle: "fullScreen",
        statusBarTranslucent: true,
        supportedOrientations: ["portrait", "landscape"],
      }),
    );
    expect(flat(screen.getByTestId("video-fullscreen", hidden)).backgroundColor).toBe("#000000");
  });

  it("closes on the minimize button, and puts the video back", async () => {
    await mount({ controls: "custom" });
    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    expect(screen.queryByTestId("video-fullscreen", hidden)).toBeNull();
    expect(within(frame()).getByTestId("video-view", hidden)).toBeTruthy();
    expect(screen.getAllByTestId("video-view", hidden)).toHaveLength(1);
  });

  it("closes on the Android back button", async () => {
    await mount({ controls: "custom" });
    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    await act(async () => screen.getByTestId("rn-modal", hidden).props.onRequestClose());

    expect(screen.queryByTestId("video-fullscreen", hidden)).toBeNull();
  });

  it("keeps playing across the switch", async () => {
    await mount({ controls: "custom" });
    await startPlaying();

    await fireEvent.press(screen.getByTestId("video-fullscreen-toggle", hidden));

    expect(player().pause).not.toHaveBeenCalled();
    expect(screen.getByTestId("video-play", hidden).props.accessibilityLabel).toBe("Pause");
  });

  it("leaves the platform's own fullscreen to native controls, with no Modal", async () => {
    await mount({ controls: "native" });

    expect(screen.queryByTestId("rn-modal", hidden)).toBeNull();
  });
});

describe("accessibility", () => {
  it("makes the custom frame one element named by the title, with the position as its value", async () => {
    await mount({ controls: "custom", title: "Product tour" });
    player().duration = 100;
    await emit("statusChange", { status: "readyToPlay" });
    await emit("timeUpdate", { currentTime: 62, bufferedPosition: 0 });

    expect(frame().props).toEqual(
      expect.objectContaining({
        accessible: true,
        accessibilityLabel: "Product tour",
        accessibilityValue: { text: "1 minute 2 seconds of 1 minute 40 seconds" },
      }),
    );
  });

  it("names the frame Video when nothing else does, and takes the title over accessibilityLabel", async () => {
    const { rerender } = await mount({ controls: "custom" });
    expect(frame().props.accessibilityLabel).toBe("Video");

    await rerender(<Video source={URI} controls="custom" accessibilityLabel="Product tour video" />);
    expect(frame().props.accessibilityLabel).toBe("Product tour video");

    await rerender(<Video source={URI} controls="custom" title="Tour" accessibilityLabel="Product tour video" />);
    expect(frame().props.accessibilityLabel).toBe("Tour");
  });

  it("offers activate, magicTap, increment and decrement, plus the controls it hides on iOS", async () => {
    await mount({ controls: "custom" });
    await emit("availableSubtitleTracksChange", { availableSubtitleTracks: [{ language: "en", label: "English" }] });

    const names = (frame().props.accessibilityActions as { name: string }[]).map((action) => action.name);

    expect(names).toEqual(["activate", "magicTap", "increment", "decrement", "toggleMute", "toggleCaptions", "toggleFullscreen"]);
  });

  it("plays and pauses on activate and magicTap", async () => {
    await mount({ controls: "custom" });

    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(player().play).toHaveBeenCalledTimes(1);

    await startPlaying();
    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "magicTap" } }));
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("mutes and opens fullscreen through actions too", async () => {
    await mount({ controls: "custom" });

    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "toggleMute" } }));
    expect(player().muted).toBe(true);

    await act(async () => frame().props.onAccessibilityAction({ nativeEvent: { actionName: "toggleFullscreen" } }));
    expect(screen.getByTestId("video-fullscreen", hidden)).toBeTruthy();
  });

  it("does not wrap native controls in an accessible element, which would hide them", async () => {
    await mount({ controls: "native", title: "Tour" });

    expect(frame().props.accessible).toBeUndefined();
    expect(view().props.accessibilityLabel).toBe("Tour");
  });

  it("names bare playback, so it is not an unlabeled hole", async () => {
    await mount({ controls: "none", title: "Loop" });

    expect(frame().props).toEqual(expect.objectContaining({ accessible: true, accessibilityLabel: "Loop" }));
  });

  it("labels every control", async () => {
    await mount({ controls: "custom" });

    expect(screen.getByTestId("video-center", hidden).props.accessibilityLabel).toBe("Play");
    expect(screen.getByTestId("video-mute", hidden).props.accessibilityLabel).toBe("Mute");
    expect(screen.getByTestId("video-fullscreen-toggle", hidden).props.accessibilityLabel).toBe("Enter full screen");
    expect(screen.getByTestId("video-scrubber", hidden).props.accessibilityLabel).toBe("Seek");
  });
});

describe("player lifecycle", () => {
  it("applies loop and muted to the player it creates, and starts it for autoPlay", async () => {
    await mount({ loop: true, muted: true, autoPlay: true });

    expect(player()).toEqual(expect.objectContaining({ loop: true, muted: true }));
    expect(player().play).toHaveBeenCalledTimes(1);
  });

  it("does not start by itself", async () => {
    await mount();

    expect(player().play).not.toHaveBeenCalled();
  });

  it("pauses on unmount", async () => {
    const { unmount } = await mount();
    const created = player();

    await unmount();

    expect(created.pause).toHaveBeenCalled();
  });

  it("uses a caller's player as given: no second player, never released, only paused", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    const { unmount } = await render(<Video player={asPlayer(own)} source="https://example.com/ignored.mp4" controls="custom" />);

    expect(view().props.player).toBe(own);

    await unmount();

    expect(own.pause).toHaveBeenCalled();
    expect(own.release).not.toHaveBeenCalled();
  });

  it("does not apply loop or muted to a caller's player", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    await render(<Video player={asPlayer(own)} loop muted />);

    expect(own.loop).toBe(false);
    expect(own.muted).toBe(false);
  });

  it("stops listening when it unmounts", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    const { unmount } = await render(<Video player={asPlayer(own)} controls="custom" />);
    expect(own.listenerCount("timeUpdate")).toBe(1);

    await unmount();

    for (const event of ["statusChange", "playingChange", "timeUpdate", "videoTrackChange", "sourceLoad", "playToEnd"]) {
      expect(own.listenerCount(event)).toBe(0);
    }
  });

  it("does nothing on a stale event after unmount", async () => {
    const own: TestPlayer = createVideoPlayer(URI);
    const onStatusChange = jest.fn();
    const { unmount } = await render(<Video player={asPlayer(own)} onStatusChange={onStatusChange} />);
    await unmount();

    own.emit("statusChange", { status: "error" });

    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

describe("barrel", () => {
  it("is not exported from the components barrel", () => {
    expect(Object.keys(componentsBarrel)).not.toContain("Video");
  });
});
