/**
 * AudioPlayer on iOS (the jest-expo default): controls, states, scrubbing,
 * speed, lifecycle. `expo-audio` is the opt-in fake from `test/mocks`, and
 * `expo-image` a `View` that captures its props. Web has its own file.
 *
 * The fake player is reached through a spy on `useAudioPlayer`, which the
 * component calls once per instance (the spy is restored between tests).
 */
import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as expoAudio from "@/test/mocks/expoAudio";
import { createAudioPlayer, type FakeAudioPlayer, type FakeAudioStatus } from "@/test/mocks/expoAudio";
import { rawThemeColors } from "../../constants/colors";
import { AudioPlayer, type AudioPlayerProps } from "../AudioPlayer";
import * as componentsBarrel from "../index";

jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const SOURCE = "https://example.com/a.mp3";

let useAudioPlayerSpy: jest.SpyInstance;
beforeEach(() => {
  useAudioPlayerSpy = jest.spyOn(expoAudio, "useAudioPlayer");
});

/** The player the component created. */
const created = (): FakeAudioPlayer => useAudioPlayerSpy.mock.results.at(-1)?.value as FakeAudioPlayer;

const emit = (player: FakeAudioPlayer, status: Partial<FakeAudioStatus>) =>
  act(async () => player.emit("playbackStatusUpdate", status));

async function mount(props: Partial<AudioPlayerProps> = {}) {
  const result = await render(<AudioPlayer source={SOURCE} testID="player" {...props} />);
  return { ...result, player: created() };
}

/** `playing` with a loaded 100 s file: what a player reports a moment after play. */
const PLAYING: Partial<FakeAudioStatus> = { isLoaded: true, playing: true, duration: 100 };
const LOADED: Partial<FakeAudioStatus> = { isLoaded: true, duration: 100 };

const play = () => screen.getByRole("button", { name: /^Play(?!back)/ });
const pause = () => screen.getByRole("button", { name: /^Pause/ });
const scrubber = () => screen.getByRole("adjustable");
const textOf = (testID: string) => screen.getByTestId(testID, { includeHiddenElements: true }).props.children;
const press = (button: TestInstance) => act(async () => void fireEvent.press(button));

describe("AudioPlayer", () => {
  describe("compact", () => {
    it("is a row with a play button, a scrubber and the time", async () => {
      await mount({ title: "Voice note" });

      expect(play()).toBeTruthy();
      expect(scrubber()).toBeTruthy();
      expect(textOf("player-time")).toBe("--:--");
      expect(screen.queryByTestId("player-title")).toBeNull();
      expect(screen.queryByTestId("player-speed")).toBeNull();
      expect(screen.queryByTestId("player-mute")).toBeNull();
      expect(flat(screen.getByTestId("player")).flexDirection).toBe("row");
      expect(flat(screen.getByTestId("player")).minHeight).toBe(44);
    });

    it("shows the total while idle, then the elapsed time", async () => {
      const { player } = await mount();

      await emit(player, { ...LOADED, duration: 3900 });
      expect(textOf("player-time")).toBe("1:05:00");

      await emit(player, { playing: true, currentTime: 62 });
      expect(textOf("player-time")).toBe("0:01:02");
    });

    it("draws the time in the muted color, in tabular figures, and hides it from assistive tech", async () => {
      await mount();

      const time = screen.getByTestId("player-time", { includeHiddenElements: true });
      expect(flat(time).color).toBe(rawThemeColors.light.mutedForeground);
      expect(flat(time).fontVariant).toEqual(["tabular-nums"]);
      expect(time.props["aria-hidden"]).toBe(true);
    });

    it("ignores the full-only props", async () => {
      await mount({ subtitle: "Show", artwork: "https://example.com/c.jpg", showSpeed: true });

      expect(screen.queryByTestId("player-subtitle")).toBeNull();
      expect(screen.queryByTestId("expo-image", { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByTestId("player-speed")).toBeNull();
    });

    it("adds a mute button with showMute", async () => {
      const { player } = await mount({ showMute: true });

      expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
      await press(screen.getByRole("button", { name: "Mute" }));

      expect(player.muted).toBe(true);
      expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();
      await press(screen.getByRole("button", { name: "Unmute" }));
      expect(player.muted).toBe(false);
    });
  });

  describe("full", () => {
    const full = { variant: "full", title: "Episode 12", subtitle: "The Show", artwork: "https://example.com/c.jpg" } as const;

    it("has artwork, title, subtitle, scrubber, both times and speed", async () => {
      await mount(full);

      const artwork = screen.getByTestId("expo-image", { includeHiddenElements: true });
      expect(artwork.props.source).toBe("https://example.com/c.jpg");
      expect(textOf("player-title")).toBe("Episode 12");
      expect(textOf("player-subtitle")).toBe("The Show");
      expect(scrubber()).toBeTruthy();
      expect(textOf("player-elapsed")).toBe("--:--");
      expect(textOf("player-remaining")).toBe("--:--");
      expect(screen.getByRole("button", { name: "Playback speed 1×" })).toBeTruthy();
      expect(screen.queryByTestId("player-mute")).toBeNull();
    });

    it("draws the title semibold on one line, the subtitle muted on one line, and the artwork 56 pt with the md radius", async () => {
      await mount(full);

      const title = screen.getByTestId("player-title", { includeHiddenElements: true });
      expect(title.props.numberOfLines).toBe(1);
      expect(flat(title).fontFamily).toBe("Inter_600SemiBold");
      const subtitle = screen.getByTestId("player-subtitle", { includeHiddenElements: true });
      expect(subtitle.props.numberOfLines).toBe(1);
      expect(flat(subtitle).color).toBe(rawThemeColors.light.mutedForeground);
      const frame = screen.getByTestId("player-artwork", { includeHiddenElements: true });
      expect(flat(frame)).toEqual(expect.objectContaining({ width: 56, height: 56, borderRadius: 10 }));
    });

    it("counts down: elapsed on the left, -remaining on the right", async () => {
      const { player } = await mount(full);

      await emit(player, { ...LOADED, duration: 225 });
      expect(textOf("player-elapsed")).toBe("0:00");
      expect(textOf("player-remaining")).toBe("-3:45");

      await emit(player, { playing: true, currentTime: 62.4 });
      expect(textOf("player-elapsed")).toBe("1:02");
      expect(textOf("player-remaining")).toBe("-2:43");
    });

    it("leaves the speed button out with showSpeed={false}, and adds mute with showMute", async () => {
      await mount({ ...full, showSpeed: false, showMute: true });

      expect(screen.queryByTestId("player-speed")).toBeNull();
      expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
    });

    it("makes the play button the large size", async () => {
      await mount(full);

      // `IconButton` lg is 40 visible, so a 2 pt slop reaches 44.
      expect(play().props.hitSlop).toBe(2);
    });
  });

  describe("play and pause", () => {
    it("plays and pauses, and names the button after the title", async () => {
      const { player } = await mount({ title: "Episode 12" });

      expect(screen.getByRole("button", { name: "Play Episode 12" })).toBeTruthy();
      await press(play());
      expect(player.play).toHaveBeenCalledTimes(1);

      await emit(player, PLAYING);
      expect(screen.getByRole("button", { name: "Pause Episode 12" })).toBeTruthy();
      await press(pause());
      expect(player.pause).toHaveBeenCalledTimes(1);

      await emit(player, { playing: false });
      expect(screen.getByRole("button", { name: "Play Episode 12" })).toBeTruthy();
    });

    it("uses plain Play and Pause without a title", async () => {
      const { player } = await mount();

      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
      await emit(player, PLAYING);
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    });

    it("reports playing changes, and not the starting state", async () => {
      const onPlayingChange = jest.fn();
      const { player } = await mount({ onPlayingChange });
      expect(onPlayingChange).not.toHaveBeenCalled();

      await emit(player, PLAYING);
      await emit(player, { playing: false });

      expect(onPlayingChange.mock.calls).toEqual([[true], [false]]);
    });

    it("autoPlay plays once the player exists", async () => {
      const { player } = await mount({ autoPlay: true });

      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("sets loop on the player, and leaves it alone when loop is not given", async () => {
      const looped = await mount({ loop: true });
      expect(looped.player.loop).toBe(true);
      await looped.unmount();

      const own = createAudioPlayer();
      own.loop = true;
      await render(<AudioPlayer player={own as never} />);
      expect(own.loop).toBe(true);
    });
  });

  describe("loading", () => {
    it("shows a spinner labelled Loading from play until the file is loaded", async () => {
      const { player } = await mount({ title: "Episode 12" });

      await press(play());

      const spinner = screen.getByRole("button", { name: "Loading" });
      expect(spinner.props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
      expect(screen.root!.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(1);

      await emit(player, PLAYING);
      expect(screen.queryByRole("button", { name: "Loading" })).toBeNull();
      expect(screen.getByRole("button", { name: "Pause Episode 12" })).toBeTruthy();
    });

    it("stays pressable while loading: a press pauses and cancels a stalled load", async () => {
      const { player } = await mount();
      await press(play());
      expect(player.play).toHaveBeenCalledTimes(1);

      await press(screen.getByRole("button", { name: "Loading" }));

      expect(player.pause).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Loading" })).toBeNull();
      expect(play()).toBeTruthy();
    });

    it("shows the spinner while the player buffers", async () => {
      const { player } = await mount();

      await emit(player, { ...PLAYING, isBuffering: true });
      expect(screen.getByRole("button", { name: "Loading" })).toBeTruthy();

      await emit(player, { isBuffering: false });
      expect(screen.queryByRole("button", { name: "Loading" })).toBeNull();
    });

    it("shows no spinner before play, when nothing was asked for", async () => {
      await mount();

      expect(screen.queryByRole("button", { name: "Loading" })).toBeNull();
    });
  });

  describe("errors", () => {
    it("a load error disables the controls, shows Audio unavailable in place of the time, and calls onError once", async () => {
      const onError = jest.fn();
      const { player } = await mount({ onError, showMute: true });

      await emit(player, { error: "Cannot decode", isLoaded: false });
      await emit(player, { error: "Cannot decode", isLoaded: false });

      expect(screen.getByText("Audio unavailable")).toBeTruthy();
      expect(screen.queryByTestId("player-time", { includeHiddenElements: true })).toBeNull();
      expect(play().props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
      expect(screen.getByRole("button", { name: "Mute" }).props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith("Cannot decode");

      await press(play());
      expect(player.play).not.toHaveBeenCalled();
    });

    it("keeps the error after later updates that carry none (expo-audio sends it once)", async () => {
      const { player } = await mount();

      await emit(player, { error: "Cannot decode", isLoaded: false });
      await emit(player, { error: null, isLoaded: false, currentTime: 0 });

      expect(screen.getByText("Audio unavailable")).toBeTruthy();
    });

    it("shows it in the full layout too, in place of both times", async () => {
      const { player } = await mount({ variant: "full", title: "Broken", showSpeed: true });

      await emit(player, { error: "Cannot decode", isLoaded: false });

      expect(screen.getByText("Audio unavailable")).toBeTruthy();
      expect(screen.queryByTestId("player-elapsed", { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByTestId("player-remaining", { includeHiddenElements: true })).toBeNull();
      expect(screen.queryByTestId("player-speed")).toBeNull();
    });

    it("a refused play() (autoplay blocked) is reported but leaves the player usable", async () => {
      const onError = jest.fn();
      const { player } = await mount({ onError });

      await emit(player, { error: "play() failed: NotAllowedError", isLoaded: true, playing: false });

      expect(onError).toHaveBeenCalledWith("play() failed: NotAllowedError");
      expect(screen.queryByText("Audio unavailable")).toBeNull();
      expect(play().props.accessibilityState).not.toEqual(expect.objectContaining({ disabled: true }));
    });

    it("a missing source shows the unavailable state and calls onError, without creating a player", async () => {
      const onError = jest.fn();
      await render(<AudioPlayer source={null} onError={onError} testID="player" />);

      expect(screen.getByText("Audio unavailable")).toBeTruthy();
      expect(play().props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    });

    it("treats an empty string and an undefined source as missing", async () => {
      await render(<AudioPlayer source="" />);
      expect(screen.getByText("Audio unavailable")).toBeTruthy();
      expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    });

    it("picks the player up when a missing source arrives", async () => {
      const { rerender } = await render(<AudioPlayer source={null} testID="player" />);
      expect(useAudioPlayerSpy).not.toHaveBeenCalled();

      await rerender(<AudioPlayer source={SOURCE} testID="player" />);

      expect(useAudioPlayerSpy).toHaveBeenCalledWith(SOURCE, expect.anything());
      expect(screen.queryByText("Audio unavailable")).toBeNull();
    });
  });

  describe("ending", () => {
    it("calls onEnd once, and seeks to 0 before the next play", async () => {
      const onEnd = jest.fn();
      const { player } = await mount({ onEnd });
      await emit(player, { ...PLAYING, currentTime: 99.8 });

      await emit(player, { playing: false, didJustFinish: true });
      await emit(player, { currentTime: 100, didJustFinish: true });
      expect(onEnd).toHaveBeenCalledTimes(1);

      await press(play());

      expect(player.seekTo).toHaveBeenCalledWith(0);
      expect(player.play).toHaveBeenCalledTimes(1);
      expect(player.seekTo.mock.invocationCallOrder[0]).toBeLessThan(player.play.mock.invocationCallOrder[0]);
    });

    it("calls onEnd again at the next finish", async () => {
      const onEnd = jest.fn();
      const { player } = await mount({ onEnd });

      await emit(player, { ...PLAYING, didJustFinish: true });
      await emit(player, { didJustFinish: false });
      await emit(player, { didJustFinish: true });

      expect(onEnd).toHaveBeenCalledTimes(2);
    });

    it("seeks to 0 only after an end: a play after a pause continues", async () => {
      const { player } = await mount();
      await emit(player, PLAYING);
      await press(pause());
      await emit(player, { playing: false });

      await press(play());

      expect(player.seekTo).not.toHaveBeenCalled();
    });

    it("while looping, does not call onEnd and does not seek to 0 on the next play", async () => {
      const onEnd = jest.fn();
      const { player } = await mount({ onEnd, loop: true });

      await emit(player, { ...PLAYING, didJustFinish: true });
      await emit(player, { playing: false });
      await press(play());

      expect(onEnd).not.toHaveBeenCalled();
      expect(player.seekTo).not.toHaveBeenCalled();
    });
  });

  describe("scrubbing", () => {
    const INSET = 10;
    const TRACK = 200;
    const TOUCH_WIDTH = 220;
    const at = (fraction: number) => INSET + fraction * TRACK;

    /** A responder event for one finger at `locationX`, last seen at `previousX` (the scrubber's own tests explain the shape). */
    const touch = (locationX: number, previousX: number, time: number) => ({
      nativeEvent: { locationX, pageX: locationX, touches: [{ pageX: locationX }], changedTouches: [{ pageX: locationX }], timestamp: time },
      currentTarget: 1,
      persist: () => {},
      touchHistory: {
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: time,
        numberActiveTouches: 1,
        touchBank: [
          {
            touchActive: true,
            startPageX: locationX,
            startPageY: 0,
            startTimeStamp: 1,
            currentPageX: locationX,
            currentPageY: 0,
            currentTimeStamp: time,
            previousPageX: previousX,
            previousPageY: 0,
            previousTimeStamp: time - 1,
          },
        ],
      },
    });

    /** `fireEvent` would drop events on the scrubber until it has a width, so lay it out directly. */
    async function layOut() {
      await act(async () => {
        scrubber().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: TOUCH_WIDTH, height: 44 } } });
      });
    }
    let lastX = 0;
    const down = (x: number) => {
      lastX = x;
      return act(async () => void scrubber().props.onResponderGrant(touch(x, x, 2)));
    };
    const move = (x: number) => {
      const previous = lastX;
      lastX = x;
      return act(async () => void scrubber().props.onResponderMove(touch(x, previous, 3)));
    };
    const up = (x: number) => act(async () => void scrubber().props.onResponderRelease(touch(x, lastX, 4)));

    it("pauses at the start, seeks at the end, then resumes", async () => {
      const { player } = await mount({ title: "Episode 12" });
      await emit(player, { ...PLAYING, currentTime: 10 });
      await layOut();

      await down(at(0.5));
      expect(player.pause).toHaveBeenCalledTimes(1);
      expect(player.seekTo).not.toHaveBeenCalled();

      await up(at(0.5));

      expect(player.seekTo).toHaveBeenCalledTimes(1);
      expect(player.seekTo.mock.calls[0][0]).toBeCloseTo(50);
      expect(player.play).toHaveBeenCalledTimes(1);
      expect(player.seekTo.mock.invocationCallOrder[0]).toBeLessThan(player.play.mock.invocationCallOrder[0]);
    });

    it("never reports a pause across a scrub of a playing clip, even before the player says it is playing again", async () => {
      const onPlayingChange = jest.fn();
      const { player } = await mount({ onPlayingChange, title: "Episode 12" });
      await emit(player, PLAYING);
      await layOut();
      onPlayingChange.mockClear();

      await down(at(0.5));
      await emit(player, { playing: false });
      await up(at(0.5));

      // `play()` was called but the player has not reported it yet.
      expect(player.play).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Pause Episode 12" })).toBeTruthy();

      await emit(player, { playing: true });
      expect(screen.getByRole("button", { name: "Pause Episode 12" })).toBeTruthy();
      expect(onPlayingChange).not.toHaveBeenCalled();
    });

    it("gives up on a resume the player never reports after a second", async () => {
      jest.useFakeTimers();
      try {
        const onPlayingChange = jest.fn();
        const { player } = await mount({ onPlayingChange });
        await emit(player, PLAYING);
        await layOut();
        onPlayingChange.mockClear();

        await down(at(0.5));
        await emit(player, { playing: false });
        await up(at(0.5));
        expect(onPlayingChange).not.toHaveBeenCalled();

        await act(async () => void jest.advanceTimersByTime(1100));

        expect(onPlayingChange.mock.calls).toEqual([[false]]);
      } finally {
        jest.useRealTimers();
      }
    });

    it("resumes only after the seek has finished", async () => {
      const { player } = await mount();
      await emit(player, PLAYING);
      await layOut();
      let finishSeek: () => void = () => {};
      player.seekTo.mockImplementationOnce(() => new Promise<void>((resolve) => (finishSeek = resolve)));

      await down(at(0.25));
      await up(at(0.25));
      expect(player.seekTo).toHaveBeenCalledTimes(1);
      expect(player.play).not.toHaveBeenCalled();

      await act(async () => finishSeek());

      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("keeps the pause icon while a playing clip is dragged, and shows the drag position, not the current time", async () => {
      const { player } = await mount({ title: "Episode 12", variant: "full" });
      await emit(player, { ...PLAYING, currentTime: 10 });
      await layOut();

      await down(at(0.2));
      await move(at(0.7));

      expect(screen.getByRole("button", { name: "Pause Episode 12" })).toBeTruthy();
      expect(textOf("player-elapsed")).toBe("1:10");
      expect(scrubber().props.accessibilityValue).toEqual(expect.objectContaining({ now: 70 }));

      // The player reports its old position while paused for the drag: still the drag value.
      await emit(player, { currentTime: 10, playing: false });
      expect(textOf("player-elapsed")).toBe("1:10");
      await up(at(0.7));
    });

    it("holds the dropped position until the player reports one", async () => {
      const { player } = await mount({ variant: "full" });
      await emit(player, { ...LOADED, currentTime: 10 });
      await layOut();

      await down(at(0.5));
      await up(at(0.5));

      expect(textOf("player-elapsed")).toBe("0:50");
      expect(scrubber().props.accessibilityValue).toEqual(expect.objectContaining({ now: 50 }));
    });

    it("does not resume a clip that was paused", async () => {
      const { player } = await mount();
      await emit(player, LOADED);
      await layOut();

      await down(at(0.5));
      await up(at(0.5));

      expect(player.pause).not.toHaveBeenCalled();
      expect(player.seekTo).toHaveBeenCalledTimes(1);
      expect(player.play).not.toHaveBeenCalled();
    });

    it("a screen-reader or keyboard adjustment seeks without pausing or resuming", async () => {
      const { player } = await mount();
      await emit(player, { ...PLAYING, currentTime: 30 });

      await act(async () => scrubber().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));

      expect(player.pause).not.toHaveBeenCalled();
      expect(player.seekTo).toHaveBeenCalledWith(35);
      expect(player.play).not.toHaveBeenCalled();
    });

    it("a seek after the end plays from there, not from 0", async () => {
      const { player } = await mount();
      await emit(player, { ...PLAYING, didJustFinish: true });
      await emit(player, { playing: false });
      await layOut();
      await down(at(0.5));
      await up(at(0.5));
      player.seekTo.mockClear();
      player.play.mockClear();

      await press(play());

      expect(player.seekTo).not.toHaveBeenCalled();
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("the scrubber is named and spoken in words", async () => {
      const { player } = await mount();
      await emit(player, { ...LOADED, duration: 225, currentTime: 62 });

      expect(scrubber().props.accessibilityValue).toEqual({
        min: 0,
        max: 225,
        now: 62,
        text: "1 minute 2 seconds of 3 minutes 45 seconds",
      });
    });
  });

  describe("speed", () => {
    it("cycles 1, 1.25, 1.5, 2, 0.75, 1 through setPlaybackRate, keeping the pitch", async () => {
      const { player } = await mount({ variant: "full" });
      const speed = () => screen.getByTestId("player-speed");

      const seen: [number, string][] = [];
      for (let i = 0; i < 6; i += 1) {
        await press(speed());
        const call = player.setPlaybackRate.mock.calls.at(-1);
        seen.push([call[0], speed().props.accessibilityLabel]);
      }

      expect(seen.map(([rate]) => rate)).toEqual([1.25, 1.5, 2, 0.75, 1, 1.25]);
      expect(seen.map(([, label]) => label)).toEqual([
        "Playback speed 1.25×",
        "Playback speed 1.5×",
        "Playback speed 2×",
        "Playback speed 0.75×",
        "Playback speed 1×",
        "Playback speed 1.25×",
      ]);
      expect(player.setPlaybackRate.mock.calls.every((call) => call[1] === "high")).toBe(true);
    });

    it("shows the rate on the button", async () => {
      await mount({ variant: "full" });

      expect(screen.getByText("1×")).toBeTruthy();
      await press(screen.getByTestId("player-speed"));
      expect(screen.getByText("1.25×")).toBeTruthy();
    });

    it("starts from the rate the player already has", async () => {
      const own = createAudioPlayer();
      await emit(own, { playbackRate: 2 });
      await render(<AudioPlayer player={own as never} variant="full" testID="player" />);

      expect(screen.getByText("2×")).toBeTruthy();
      await press(screen.getByTestId("player-speed"));
      expect(own.setPlaybackRate).toHaveBeenCalledWith(0.75, "high");
    });
  });

  describe("live streams", () => {
    it("shows Live and disables the scrubber when the player says it is live", async () => {
      const { player } = await mount();

      await emit(player, { isLoaded: true, isLive: true, duration: 0 });

      expect(textOf("player-time")).toBe("Live");
      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
      expect(scrubber().props.accessibilityValue).toEqual({ text: "Live" });
    });

    it("does not call a loading file live: iOS reports isLive until the item is ready", async () => {
      const own = createAudioPlayer();
      own.__status = { ...own.__status, isLive: true, isLoaded: false };
      await render(<AudioPlayer player={own as never} testID="player" />);
      expect(textOf("player-time")).not.toBe("Live");

      await emit(own, { isLive: false, isLoaded: true, duration: 100 });

      expect(textOf("player-time")).toBe("1:40");
      expect(scrubber().props.accessibilityState).toEqual({ disabled: false });
    });

    it("still says Live for a loaded stream that reports isLive", async () => {
      const own = createAudioPlayer();
      own.__status = { ...own.__status, isLive: true, isLoaded: false };
      await render(<AudioPlayer player={own as never} testID="player" />);

      await emit(own, { isLive: true, isLoaded: true });

      expect(textOf("player-time")).toBe("Live");
      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
    });

    it("treats an infinite duration as live", async () => {
      const { player } = await mount({ variant: "full" });

      await emit(player, { isLoaded: true, duration: Number.POSITIVE_INFINITY });

      expect(textOf("player-elapsed")).toBe("Live");
      expect(textOf("player-remaining")).toBe("");
      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
    });

    it("calls a stream live when its duration stays 0 while it plays, and keeps saying so when paused", async () => {
      const { player } = await mount();

      await emit(player, { isLoaded: true, playing: true, duration: 0, currentTime: 0.4 });
      expect(textOf("player-time")).not.toBe("Live");

      await emit(player, { currentTime: 2 });
      expect(textOf("player-time")).toBe("Live");

      await emit(player, { playing: false });
      expect(textOf("player-time")).toBe("Live");
      expect(scrubber().props.accessibilityState).toEqual({ disabled: true });
    });

    it("does not call a file live because its duration has not arrived yet", async () => {
      const { player } = await mount();

      await emit(player, { isLoaded: true, playing: false, duration: 0 });

      expect(textOf("player-time")).toBe("--:--");
    });

    it("ignores a screen-reader increment when there is no length: nothing to seek in", async () => {
      const { player } = await mount();
      await emit(player, { isLoaded: true, isLive: true });

      await act(async () => scrubber().props.onAccessibilityAction?.({ nativeEvent: { actionName: "increment" } }));

      expect(player.seekTo).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("pauses a player it created when it unmounts", async () => {
      const { player, unmount } = await mount();

      await unmount();

      expect(player.pause).toHaveBeenCalledTimes(1);
      expect(player.listenerCount("playbackStatusUpdate")).toBe(0);
    });

    it("never pauses, replaces or releases a player the caller passed, and creates none", async () => {
      const own = createAudioPlayer();
      const { unmount } = await render(<AudioPlayer player={own as never} source="ignored.mp3" />);
      await press(play());
      expect(own.play).toHaveBeenCalledTimes(1);

      await unmount();

      expect(own.pause).not.toHaveBeenCalled();
      expect(own.replace).not.toHaveBeenCalled();
      expect(own.remove).not.toHaveBeenCalled();
      expect(own.listenerCount("playbackStatusUpdate")).toBe(0);
      expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    });

    it("a new source makes a new player and starts the state over", async () => {
      const first = await mount({ title: "One" });
      await emit(first.player, { error: "Cannot decode", isLoaded: false });
      expect(screen.getByText("Audio unavailable")).toBeTruthy();

      await first.rerender(<AudioPlayer source="https://example.com/b.mp3" title="One" testID="player" />);

      expect(screen.queryByText("Audio unavailable")).toBeNull();
      expect(screen.getByRole("button", { name: "Play One" })).toBeTruthy();
    });

    describe("lock screen", () => {
      it("publishes the title, subtitle and artwork once playing, and clears them on unmount", async () => {
        const own = Object.assign(createAudioPlayer(), {});
        const { unmount } = await render(
          <AudioPlayer
            player={own as never}
            lockScreen
            title="Episode 12"
            subtitle="The Show"
            artwork="https://example.com/c.jpg"
          />,
        );
        expect(own.setActiveForLockScreen).not.toHaveBeenCalled();

        await emit(own, PLAYING);
        expect(own.setActiveForLockScreen).toHaveBeenCalledWith(true, {
          title: "Episode 12",
          artist: "The Show",
          artworkUrl: "https://example.com/c.jpg",
        });

        await unmount();
        expect(own.setActiveForLockScreen).toHaveBeenLastCalledWith(false);
      });

      it("stays out of the lock screen by default", async () => {
        const { player, unmount } = await mount({ title: "Episode 12" });
        await emit(player, PLAYING);

        await unmount();

        expect(player.setActiveForLockScreen).not.toHaveBeenCalled();
      });

      it("reads the url from an artwork source object", async () => {
        const own = createAudioPlayer();
        await render(<AudioPlayer player={own as never} lockScreen artwork={{ uri: "https://example.com/d.jpg" }} />);

        await emit(own, PLAYING);

        expect(own.setActiveForLockScreen).toHaveBeenCalledWith(true, expect.objectContaining({ artworkUrl: "https://example.com/d.jpg" }));
      });
    });
  });

  describe("accessibility", () => {
    it("names the scrubber Seek and gives the controls a 44 pt hit area", async () => {
      await mount({ variant: "full", showMute: true });

      expect(scrubber().props.accessibilityLabel).toBe("Seek");
      expect(play().props.hitSlop).toBe(2);
      expect(screen.getByRole("button", { name: "Mute" }).props.hitSlop).toBe(8);
    });

    it("offers a magic tap on the root that toggles play on iOS", async () => {
      const { player } = await mount();

      await act(async () => screen.getByTestId("player").props.onMagicTap());

      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("sets no keyboard props off web", async () => {
      await mount();

      const root = screen.getByTestId("player");
      expect(root.props.focusable).toBeUndefined();
      expect(root.props.onKeyDown).toBeUndefined();
      expect(root.props.role).toBeUndefined();
    });
  });

  it("is subpath-only: not in the components barrel", () => {
    expect("AudioPlayer" in componentsBarrel).toBe(false);
  });
});
