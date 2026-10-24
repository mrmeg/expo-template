/**
 * Types for the `Video` tests. The fake player lives at `@/test/mocks/expoVideo`,
 * which this package's own typecheck cannot resolve (it has no `@/*` alias), so
 * the part of it the tests touch is written out here.
 */
import type { VideoPlayer } from "expo-video";

export interface TestPlayer {
  play: jest.Mock;
  pause: jest.Mock;
  replay: jest.Mock;
  replaceAsync: jest.Mock;
  release: jest.Mock;
  currentTime: number;
  duration: number;
  bufferedPosition: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  playing: boolean;
  isLive: boolean;
  status: string;
  videoTrack: { size: { width: number; height: number } } | null;
  timeUpdateEventInterval: number;
  /** Absent on the fake until a test sets them: the component tolerates both. */
  subtitleTrack?: unknown;
  availableSubtitleTracks?: unknown[];
  /** Call every listener registered for `event` with `payload`. */
  emit: (event: string, payload?: unknown) => void;
  listenerCount: (event: string) => number;
}

/** A caller-owned player, as `<Video player>` takes it. */
export const asPlayer = (fake: TestPlayer) => fake as unknown as VideoPlayer;
