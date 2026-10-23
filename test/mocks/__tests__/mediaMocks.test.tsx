/**
 * The opt-in `expo-video` / `expo-audio` Jest mocks (`test/mocks`). Later media
 * specs build on their shape, so it is pinned here.
 */
import fs from "fs";
import path from "path";
import React, { createRef } from "react";
import { Text } from "react-native";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import { useEvent } from "expo";
// Typed from the mock files; the `jest.mock` calls below are the opt-in a
// component test uses, and the first test proves they route the real specifiers here.
import { VideoView, useVideoPlayer } from "@/test/mocks/expoVideo";
import { useAudioPlayer, useAudioPlayerStatus } from "@/test/mocks/expoAudio";

jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));
jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));

describe("opting in", () => {
  it('jest.mock("expo-video" | "expo-audio", factory) routes the real specifiers to the mocks', () => {
    expect(require("expo-video")).toBe(require("@/test/mocks/expoVideo"));
    expect(require("expo-audio")).toBe(require("@/test/mocks/expoAudio"));
  });
});

describe("expo-video mock", () => {
  it("returns one stable player per instance and runs setup once", async () => {
    const setup = jest.fn();
    const { result, rerender } = await renderHook(() => useVideoPlayer("https://example.com/a.mp4", setup));
    const first = result.current;

    await rerender(undefined);

    expect(result.current).toBe(first);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledWith(first);
    expect(first.source).toBe("https://example.com/a.mp4");
  });

  it("gives two instances separate players", async () => {
    const a = await renderHook(() => useVideoPlayer(null));
    const b = await renderHook(() => useVideoPlayer(null));

    expect(a.result.current).not.toBe(b.result.current);
  });

  it("has the playback methods as jest.fn and mutable state", async () => {
    const { result } = await renderHook(() => useVideoPlayer(null));
    const player = result.current;

    for (const method of ["play", "pause", "replay", "seekBy", "replaceAsync"] as const) {
      player[method]();
      expect(player[method]).toHaveBeenCalledTimes(1);
    }
    await expect(player.replaceAsync("x")).resolves.toBeUndefined();

    player.currentTime = 12;
    player.duration = 60;
    player.muted = true;
    player.volume = 0.5;
    player.loop = true;
    player.playing = true;
    player.status = "readyToPlay";
    player.videoTrack = { size: { width: 1080, height: 1920 } };
    player.timeUpdateEventInterval = 0.25;
    expect(player).toEqual(
      expect.objectContaining({ currentTime: 12, duration: 60, muted: true, volume: 0.5, loop: true, playing: true }),
    );
  });

  it("emits to listeners, and addListener returns a removable subscription", async () => {
    const { result } = await renderHook(() => useVideoPlayer(null));
    const player = result.current;
    const listener = jest.fn();

    const subscription = player.addListener("playingChange", listener);
    player.emit("playingChange", { isPlaying: true });
    subscription.remove();
    player.emit("playingChange", { isPlaying: false });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ isPlaying: true });
    expect(player.listenerCount("playingChange")).toBe(0);
  });

  it("implements the rest of expo's EventEmitter surface: removeListener and removeAllListeners", async () => {
    const { result } = await renderHook(() => useVideoPlayer(null));
    const player = result.current;
    const first = jest.fn();
    const second = jest.fn();

    player.addListener("statusChange", first);
    player.addListener("statusChange", second);
    player.removeListener("statusChange", first);
    player.emit("statusChange", { status: "readyToPlay" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    player.removeAllListeners("statusChange");
    expect(player.listenerCount("statusChange")).toBe(0);
  });

  it("works with expo's useEvent", async () => {
    function Playing() {
      const player = useVideoPlayer(null);
      const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
      return (
        <>
          <Text testID="state">{String(isPlaying)}</Text>
          <VideoView player={player} testID="view" />
        </>
      );
    }
    await render(<Playing />);
    expect(screen.getByTestId("state").props.children).toBe("false");

    const player = screen.getByTestId("view").props.player;
    await act(async () => player.emit("playingChange", { isPlaying: true }));

    expect(screen.getByTestId("state").props.children).toBe("true");
  });

  it("VideoView is a View exposing the imperative methods as jest.fn", async () => {
    const ref = createRef<any>();
    await render(<VideoView ref={ref} testID="view" contentFit="cover" nativeControls={false} />);

    expect(screen.getByTestId("view").props.contentFit).toBe("cover");
    for (const method of ["enterFullscreen", "exitFullscreen", "startPictureInPicture"] as const) {
      ref.current[method]();
      expect(ref.current[method]).toHaveBeenCalledTimes(1);
    }
  });
});

describe("expo-audio mock", () => {
  it("returns one stable player with jest.fn methods and mutable state", async () => {
    const { result, rerender } = await renderHook(() => useAudioPlayer("https://example.com/a.mp3"));
    const player = result.current;
    await rerender(undefined);
    expect(result.current).toBe(player);

    for (const method of ["play", "pause", "seekTo", "replace", "setPlaybackRate"] as const) {
      player[method](1);
      expect(player[method]).toHaveBeenCalledTimes(1);
    }
    player.muted = true;
    player.volume = 0.2;
    player.loop = true;
    expect(player).toEqual(expect.objectContaining({ muted: true, volume: 0.2, loop: true }));
  });

  it("useAudioPlayerStatus returns __status and re-renders on playbackStatusUpdate", async () => {
    const { result } = await renderHook(() => {
      const player = useAudioPlayer(null);
      return { player, status: useAudioPlayerStatus(player) };
    });
    expect(result.current.status).toBe(result.current.player.__status);
    expect(result.current.status.playing).toBe(false);

    await act(async () =>
      result.current.player.emit("playbackStatusUpdate", { playing: true, currentTime: 12, duration: 225 }),
    );

    expect(result.current.status).toBe(result.current.player.__status);
    expect(result.current.status).toEqual(
      expect.objectContaining({ playing: true, currentTime: 12, duration: 225, isLoaded: false }),
    );
  });

  it("stops listening on unmount", async () => {
    const { result, unmount } = await renderHook(() => {
      const player = useAudioPlayer(null);
      useAudioPlayerStatus(player);
      return player;
    });
    expect(result.current.listenerCount("playbackStatusUpdate")).toBe(1);

    await unmount();

    expect(result.current.listenerCount("playbackStatusUpdate")).toBe(0);
  });
});

describe("opt-in only", () => {
  it("test/setup.ts does not mock the media modules globally", () => {
    // The real `expo-audio` throws without its native module, so a global mock
    // would silently change every existing test's behavior. Mock per file.
    const setup = fs.readFileSync(path.join(__dirname, "../../setup.ts"), "utf8");

    expect(setup).not.toMatch(/jest\.mock\(\s*["']expo-(video|audio)["']/);
  });
});
