/**
 * Opt-in Jest mock for `expo-video`.
 *
 * NOT registered globally: `test/setup.ts` does not mock `expo-video`, so every
 * existing test keeps the real module. A test that renders a media component
 * opts in, per file, before importing it:
 *
 *   jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));
 *
 * `useVideoPlayer` returns one fake player per component instance, stable
 * across re-renders, and calls `setup(player)` once, as the real hook does.
 * The player is a plain object with mutable fields and `jest.fn()` methods; it
 * implements `addListener`, so `useEvent` / `useEventListener` from `expo`
 * work against it. Drive state from a test with `player.emit(event, payload)`
 * inside `act`, and read the player a component created from the `player` prop
 * of the rendered `VideoView`.
 *
 * `VideoView` is a plain `View` that receives every prop (`player`,
 * `contentFit`, `nativeControls`, ...) and exposes `enterFullscreen`,
 * `exitFullscreen`, `startPictureInPicture` and `stopPictureInPicture` as
 * `jest.fn()` through its ref.
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";

type Listener = (payload: unknown) => void;

export interface FakeVideoPlayer {
  play: jest.Mock;
  pause: jest.Mock;
  replay: jest.Mock;
  seekBy: jest.Mock;
  replaceAsync: jest.Mock;
  release: jest.Mock;
  source: unknown;
  currentTime: number;
  duration: number;
  bufferedPosition: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  playing: boolean;
  isLive: boolean;
  playbackRate: number;
  status: "idle" | "loading" | "readyToPlay" | "error";
  videoTrack: { size: { width: number; height: number } } | null;
  timeUpdateEventInterval: number;
  /** Test helper: call every listener registered for `event` with `payload`. */
  emit: (event: string, payload?: unknown) => void;
  addListener: (event: string, listener: Listener) => { remove: () => void };
  removeListener: (event: string, listener: Listener) => void;
  removeAllListeners: (event: string) => void;
  /** Test helper: how many listeners are registered for `event`. */
  listenerCount: (event: string) => number;
}

/** A fresh fake player. `useVideoPlayer` uses this; call it directly for a player outside a component. */
export function createVideoPlayer(source: unknown = null): FakeVideoPlayer {
  const listeners = new Map<string, Set<Listener>>();

  const player: FakeVideoPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    replay: jest.fn(),
    seekBy: jest.fn(),
    replaceAsync: jest.fn(async () => {}),
    release: jest.fn(),
    source,
    currentTime: 0,
    duration: 0,
    bufferedPosition: 0,
    muted: false,
    volume: 1,
    loop: false,
    playing: false,
    isLive: false,
    playbackRate: 1,
    status: "idle",
    videoTrack: null,
    timeUpdateEventInterval: 0,
    emit: (event, payload) => {
      // Copy first: a listener may remove itself while it runs.
      [...(listeners.get(event) ?? [])].forEach((listener) => listener(payload));
    },
    addListener: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
      return { remove: () => void set.delete(listener) };
    },
    removeListener: (event, listener) => void listeners.get(event)?.delete(listener),
    removeAllListeners: (event) => void listeners.delete(event),
    listenerCount: (event) => listeners.get(event)?.size ?? 0,
  };

  return player;
}

export function useVideoPlayer(source: unknown, setup?: (player: FakeVideoPlayer) => void): FakeVideoPlayer {
  const [player] = useState(() => {
    const created = createVideoPlayer(source);
    setup?.(created);
    return created;
  });
  return player;
}

export interface FakeVideoViewHandle {
  enterFullscreen: jest.Mock;
  exitFullscreen: jest.Mock;
  startPictureInPicture: jest.Mock;
  stopPictureInPicture: jest.Mock;
}

export const VideoView = forwardRef<FakeVideoViewHandle, Record<string, unknown> & { children?: React.ReactNode }>(
  function MockVideoView(props, ref) {
    const handle = useRef<FakeVideoViewHandle>({
      enterFullscreen: jest.fn(),
      exitFullscreen: jest.fn(),
      startPictureInPicture: jest.fn(),
      stopPictureInPicture: jest.fn(),
    });
    useImperativeHandle(ref, () => handle.current, []);
    return React.createElement(View, props);
  },
);
