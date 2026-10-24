declare module "@/test/mockTheme";

/**
 * The opt-in `expo-audio` fake (`test/mocks/expoAudio.ts`). This package's
 * tsconfig has no `@/*` alias and a `rootDir` of `packages/ui`, so the real
 * file cannot be imported for its types; this is its test-facing surface, kept
 * in step with it by hand (a mismatch fails the AudioPlayer tests).
 */
declare module "@/test/mocks/expoAudio" {
  import type { AudioStatus } from "expo-audio";

  export type FakeAudioStatus = AudioStatus;

  export interface FakeAudioPlayer {
    play: jest.Mock;
    pause: jest.Mock;
    seekTo: jest.Mock;
    replace: jest.Mock;
    setPlaybackRate: jest.Mock;
    setActiveForLockScreen: jest.Mock;
    remove: jest.Mock;
    source: unknown;
    muted: boolean;
    volume: number;
    loop: boolean;
    __status: FakeAudioStatus;
    readonly currentStatus: FakeAudioStatus;
    emit: (event: string, payload?: unknown) => void;
    addListener: (event: string, listener: (payload: unknown) => void) => { remove: () => void };
    removeListener: (event: string, listener: (payload: unknown) => void) => void;
    removeAllListeners: (event: string) => void;
    listenerCount: (event: string) => number;
  }

  export function createAudioPlayer(source?: unknown): FakeAudioPlayer;
  export function useAudioPlayer(source?: unknown): FakeAudioPlayer;
  export function useAudioPlayerStatus(player: FakeAudioPlayer): FakeAudioStatus;
}
