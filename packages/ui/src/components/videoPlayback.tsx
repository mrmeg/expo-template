/**
 * Playback state for `Video`: one subscription to a player's events, read as
 * plain React state, plus the seek and retry commands that must stay in step
 * with it. Internal to `Video`; it imports `expo-video` types only, and the
 * barrel never reaches this file.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleTrack, VideoPlayer, VideoPlayerStatus, VideoSource } from "expo-video";

/** Seconds between `timeUpdate` events, for the scrubber and the time readout. */
export const TIME_UPDATE_INTERVAL = 0.25;

/**
 * After a seek, `timeUpdate`s that still report the old position are ignored
 * for this long, or until one lands near the target, so the thumb does not
 * snap back to where the clip was.
 */
const SEEK_SETTLE_MS = 500;
const SEEK_SETTLE_TOLERANCE = 1;

const NO_TRACKS: SubtitleTrack[] = [];

export interface PlaybackState {
  status: VideoPlayerStatus;
  playing: boolean;
  muted: boolean;
  /** Seconds. `Infinity` for a live stream, `0` while unknown. */
  duration: number;
  isLive: boolean;
  /** Seconds. Moves with `timeUpdate`, so it only advances while `timeUpdateEventInterval` is set. */
  time: number;
  /** Seconds buffered ahead on the timeline, `0` when unknown. */
  buffered: number;
  /** The clip reached its end and is not looping. Cleared by playing or seeking. */
  ended: boolean;
  /** Playback has started at least once. */
  everPlayed: boolean;
  subtitleTracks: SubtitleTrack[];
  subtitleTrack: SubtitleTrack | null;
  /** The source has no video stream (an audio-only file). */
  noVideo: boolean;
  /** The player's error message while `status` is `error` (possibly empty), otherwise `null`. */
  failure: string | null;
}

export interface PlaybackCallbacks {
  onStatusChange?: (status: VideoPlayerStatus) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnd?: () => void;
  /** An empty message means the player gave none. */
  onError?: (message: string) => void;
  /** The track's size in pixels, from `videoTrackChange` or the initial `player.videoTrack`. */
  onNaturalSize?: (width: number, height: number) => void;
}

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function durationOf(player: VideoPlayer, reported = player.duration): Pick<PlaybackState, "duration" | "isLive"> {
  const isLive = !!player.isLive || reported === Number.POSITIVE_INFINITY;
  if (isLive) return { duration: Number.POSITIVE_INFINITY, isLive: true };
  const seconds = finiteOr(reported, 0);
  return { duration: seconds > 0 ? seconds : 0, isLive: false };
}

/**
 * Everything a player reports synchronously. Fields the fake and the web
 * player lack (`availableSubtitleTracks`, `subtitleTrack`) read as empty.
 */
function readPlayer(player: VideoPlayer): Omit<PlaybackState, "ended" | "everPlayed" | "noVideo" | "failure"> {
  return {
    status: player.status ?? "idle",
    playing: !!player.playing,
    muted: !!player.muted,
    ...durationOf(player),
    time: Math.max(0, finiteOr(player.currentTime, 0)),
    buffered: Math.max(0, finiteOr(player.bufferedPosition, 0)),
    subtitleTracks: player.availableSubtitleTracks ?? NO_TRACKS,
    subtitleTrack: player.subtitleTrack ?? null,
  };
}

function initialState(player: VideoPlayer): PlaybackState {
  const read = readPlayer(player);
  return {
    ...read,
    ended: false,
    everPlayed: read.playing,
    noVideo: false,
    failure: read.status === "error" ? "" : null,
  };
}

/** The device's language code (`"en"`), or `undefined` where `Intl` is unavailable. */
function deviceLanguage(): string | undefined {
  try {
    const locale = typeof Intl === "undefined" ? undefined : Intl.DateTimeFormat().resolvedOptions().locale;
    return locale?.split(/[-_]/)[0]?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * The subtitle track the captions toggle turns on: the one in the device's
 * language, else the first. `null` when there are none.
 */
export function pickCaptionTrack(tracks: readonly SubtitleTrack[], language: string | undefined = deviceLanguage()): SubtitleTrack | null {
  if (tracks.length === 0) return null;
  const match = language ? tracks.find((track) => track.language?.toLowerCase().split(/[-_]/)[0] === language) : undefined;
  return match ?? tracks[0];
}

export interface Playback {
  playback: PlaybackState;
  /** A retry is in flight: the error state steps aside for the loading state. */
  retrying: boolean;
  /** Move to `seconds` (already clamped) and hold the readout there until the player catches up. */
  seekTo: (seconds: number) => void;
  /** Reload `source` after a failure. */
  retry: (source: VideoSource) => void;
  /** Turn a subtitle track on, or `null` for off. */
  setSubtitleTrack: (track: SubtitleTrack | null) => void;
  /** The web `<video>` says the file has no picture (or has one). */
  setNoVideo: (noVideo: boolean) => void;
  /** The web `<video>` raised `error`: ends a retry whose failure `statusChange` will not repeat. */
  failRetry: () => void;
}

/**
 * Subscribe to `player`. Never reads a released player: the subscription is
 * removed in the effect cleanup, which runs before the lifecycle hook that
 * owns the player releases it.
 */
export function usePlayback(player: VideoPlayer, callbacks: PlaybackCallbacks): Playback {
  const [playback, setPlayback] = useState<PlaybackState>(() => initialState(player));
  const [retrying, setRetrying] = useState(false);

  // Callbacks are read at event time, so a new closure never re-subscribes.
  const latest = useRef(callbacks);
  useEffect(() => {
    latest.current = callbacks;
  });

  const pendingSeek = useRef<{ target: number; until: number } | null>(null);
  const retryingNow = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((partial: Partial<PlaybackState>) => {
    setPlayback((previous) => ({ ...previous, ...partial }));
  }, []);

  useEffect(() => {
    const read = readPlayer(player);
    setPlayback((previous) => ({
      ...previous,
      ...read,
      everPlayed: previous.everPlayed || read.playing,
      failure: read.status === "error" ? (previous.failure ?? "") : null,
    }));

    const size = player.videoTrack?.size;
    if (size) latest.current.onNaturalSize?.(size.width, size.height);

    const subscriptions = [
      player.addListener("statusChange", ({ status, error }) => {
        retryingNow.current = false;
        setRetrying(false);
        const failure = status === "error" ? (error?.message ?? "") : null;
        patch({ status, failure, ...durationOf(player) });
        latest.current.onStatusChange?.(status);
        if (status === "error") latest.current.onError?.(failure ?? "");
      }),
      player.addListener("playingChange", ({ isPlaying }) => {
        patch(isPlaying ? { playing: true, everPlayed: true, ended: false } : { playing: false });
        latest.current.onPlayingChange?.(isPlaying);
      }),
      player.addListener("mutedChange", ({ muted }) => patch({ muted })),
      player.addListener("timeUpdate", ({ currentTime, bufferedPosition }) => {
        const pending = pendingSeek.current;
        if (pending) {
          const settled = Date.now() >= pending.until || Math.abs(currentTime - pending.target) <= SEEK_SETTLE_TOLERANCE;
          if (!settled) return;
          pendingSeek.current = null;
        }
        patch({
          time: Math.max(0, finiteOr(currentTime, 0)),
          buffered: Math.max(0, finiteOr(bufferedPosition, 0)),
          ...durationOf(player),
        });
      }),
      player.addListener("sourceLoad", ({ duration, availableSubtitleTracks, availableVideoTracks }) => {
        patch({
          ...durationOf(player, duration),
          subtitleTracks: availableSubtitleTracks ?? NO_TRACKS,
          noVideo: (availableVideoTracks?.length ?? 0) === 0,
        });
      }),
      player.addListener("videoTrackChange", ({ videoTrack }) => {
        if (!videoTrack?.size) return;
        patch({ noVideo: false });
        latest.current.onNaturalSize?.(videoTrack.size.width, videoTrack.size.height);
      }),
      player.addListener("availableSubtitleTracksChange", ({ availableSubtitleTracks }) =>
        patch({ subtitleTracks: availableSubtitleTracks ?? NO_TRACKS }),
      ),
      player.addListener("subtitleTrackChange", ({ subtitleTrack }) => patch({ subtitleTrack: subtitleTrack ?? null })),
      player.addListener("playToEnd", () => {
        patch({ ended: !player.loop });
        latest.current.onEnd?.();
      }),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [player, patch]);

  const seekTo = useCallback(
    (seconds: number) => {
      pendingSeek.current = { target: seconds, until: Date.now() + SEEK_SETTLE_MS };
      player.currentTime = seconds;
      patch({ time: seconds, ended: false });
    },
    [player, patch],
  );

  const retry = useCallback(
    (source: VideoSource) => {
      retryingNow.current = true;
      setRetrying(true);
      // `replaceAsync` may throw before it returns a promise, so start it inside one.
      void (async () => player.replaceAsync(source))().catch(() => {
        if (!mounted.current) return;
        retryingNow.current = false;
        setRetrying(false);
      });
    },
    [player],
  );

  const setSubtitleTrack = useCallback(
    (track: SubtitleTrack | null) => {
      player.subtitleTrack = track;
      patch({ subtitleTrack: track });
    },
    [player, patch],
  );

  const setNoVideo = useCallback((noVideo: boolean) => patch({ noVideo }), [patch]);

  const failRetry = useCallback(() => {
    if (!retryingNow.current) return;
    retryingNow.current = false;
    setRetrying(false);
    latest.current.onError?.("");
  }, []);

  return { playback, retrying, seekTo, retry, setSubtitleTrack, setNoVideo, failRetry };
}
