/**
 * Opt-in Jest mock for `expo-audio`.
 *
 * NOT registered globally: `test/setup.ts` does not mock `expo-audio`, so every
 * existing test keeps the real module. A test that renders `AudioPlayer` (or
 * anything built on it) opts in, per file, before importing it:
 *
 *   jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
 *
 * `useAudioPlayer` returns one fake player per component instance, stable
 * across re-renders. `useAudioPlayerStatus(player)` returns `player.__status`
 * and re-renders when the test calls
 * `player.emit("playbackStatusUpdate", { ...patch })` inside `act`; the patch
 * is merged over the current status. The player implements `addListener`, so
 * `useEvent` from `expo` works against it too.
 */
import { useEffect, useState } from "react";

type Listener = (payload: unknown) => void;

export interface FakeAudioStatus {
  id: string;
  currentTime: number;
  playbackState: string;
  timeControlStatus: string;
  reasonForWaitingToPlay: string;
  mute: boolean;
  duration: number;
  playing: boolean;
  loop: boolean;
  didJustFinish: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  playbackRate: number;
  shouldCorrectPitch: boolean;
  isLive: boolean;
  currentOffsetFromLive: number | null;
  error: string | null;
}

export interface FakeAudioPlayer {
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  replace: jest.Mock;
  setPlaybackRate: jest.Mock;
  remove: jest.Mock;
  source: unknown;
  muted: boolean;
  volume: number;
  loop: boolean;
  /** The status `useAudioPlayerStatus` returns. Replaced on every `playbackStatusUpdate`. */
  __status: FakeAudioStatus;
  /** Test helper: call every listener registered for `event` with `payload`. `playbackStatusUpdate` payloads merge into `__status`. */
  emit: (event: string, payload?: unknown) => void;
  addListener: (event: string, listener: Listener) => { remove: () => void };
  removeListener: (event: string, listener: Listener) => void;
  removeAllListeners: (event: string) => void;
  /** Test helper: how many listeners are registered for `event`. */
  listenerCount: (event: string) => number;
}

const initialStatus = (): FakeAudioStatus => ({
  id: "mock-audio-player",
  currentTime: 0,
  playbackState: "idle",
  timeControlStatus: "paused",
  reasonForWaitingToPlay: "",
  mute: false,
  duration: 0,
  playing: false,
  loop: false,
  didJustFinish: false,
  isBuffering: false,
  isLoaded: false,
  playbackRate: 1,
  shouldCorrectPitch: true,
  isLive: false,
  currentOffsetFromLive: null,
  error: null,
});

/** A fresh fake player. `useAudioPlayer` uses this; call it directly for a player outside a component. */
export function createAudioPlayer(source: unknown = null): FakeAudioPlayer {
  const listeners = new Map<string, Set<Listener>>();

  const player: FakeAudioPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => {}),
    replace: jest.fn(),
    setPlaybackRate: jest.fn(),
    remove: jest.fn(),
    source,
    muted: false,
    volume: 1,
    loop: false,
    __status: initialStatus(),
    emit: (event, payload) => {
      if (event === "playbackStatusUpdate") {
        player.__status = { ...player.__status, ...(payload as Partial<FakeAudioStatus>) };
        // Listeners get the merged status, as the real event carries a full one.
        payload = player.__status;
      }
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

export function useAudioPlayer(source?: unknown): FakeAudioPlayer {
  const [player] = useState(() => createAudioPlayer(source ?? null));
  return player;
}

export function useAudioPlayerStatus(player: FakeAudioPlayer): FakeAudioStatus {
  const [status, setStatus] = useState(player.__status);

  useEffect(() => {
    // Catch an update emitted between render and subscription.
    setStatus(player.__status);
    const subscription = player.addListener("playbackStatusUpdate", (next) => setStatus(next as FakeAudioStatus));
    return () => subscription.remove();
  }, [player]);

  return status;
}
