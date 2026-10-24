import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image as NativeImage,
  Platform,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useAudioPlayer, type AudioPlayer as ExpoAudioPlayer, type AudioSource, type AudioStatus } from "expo-audio";
import type { ImageSource } from "expo-image";
import { spacing } from "../constants/spacing";
import { useFocusVisible } from "../hooks/useFocusVisible";
import { useHydrated } from "../hooks/useHydrated";
import { useMediaKeyboard, type MediaKeyboardProps } from "../hooks/useMediaKeyboard";
import { useTheme } from "../hooks/useTheme";
import { translateText } from "../lib/i18n";
import { formatMediaTime } from "../lib/mediaTime";
import { createThemedStyles } from "../lib/themedStyles";
import { verticalSlopFor } from "../lib/webHitTarget";
import { Button, buttonHeights, type ButtonSize } from "./Button";
import { IconButton } from "./IconButton";
import { Image } from "./Image";
import { MediaScrubber } from "./MediaScrubber";
import { StyledText } from "./StyledText";

export interface AudioPlayerProps {
  /**
   * What to play: a URL, a `require()`d asset, or an `expo-audio` source object
   * (`{ uri, headers }`). Ignored when `player` is given. A missing source
   * (`null`, `undefined`, `""`) shows the unavailable state and calls `onError`.
   */
  source?: AudioSource | string | number | null;
  /**
   * Bring your own `useAudioPlayer()`. The component then never pauses, releases
   * or replaces it, and does not create a second one.
   */
  player?: ExpoAudioPlayer;
  /** `compact` is one row (voice notes, attachments); `full` adds artwork, title, times and speed. @default "compact" */
  variant?: "compact" | "full";
  /** Shown in `full`; in both variants it names the controls for assistive tech ("Play {title}"). */
  title?: string;
  /** `full` only, under the title. */
  subtitle?: string;
  /** `full` only: a 56 pt picture beside the title. A `require()`d asset, a URL or an `expo-image` source. */
  artwork?: ImageSource | string | number;
  /** `full` only. A button that cycles 1×, 1.25×, 1.5×, 2×, 0.75×. @default true */
  showSpeed?: boolean;
  /** A mute button. The M key mutes either way. @default false */
  showMute?: boolean;
  /** Start playing as soon as the player exists. Browsers block it before a user gesture; the refusal goes to `onError`. @default false */
  autoPlay?: boolean;
  /** Loop. Leave it out to keep the player's own setting. */
  loop?: boolean;
  /**
   * While playing, publish `title`, `subtitle` and `artwork` to the lock screen
   * (`setActiveForLockScreen`), and clear them on unmount. The app owns the
   * audio session: lock-screen controls need `interruptionMode: "doNotMix"` in
   * `setAudioModeAsync`. @default false
   */
  lockScreen?: boolean;
  onPlayingChange?(playing: boolean): void;
  /** Playback reached the end (not called while looping). */
  onEnd?(): void;
  /** The source failed to load, was missing, or a play request was refused. Called once per message. */
  onError?(message: string): void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The speeds the button cycles through, from 1×. */
const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;
/** Seconds a keyboard arrow moves. Matches `MediaScrubber`'s own step. */
const SEEK_STEP = 5;
const ARTWORK_SIZE = 56;
/** `useAudioPlayer` options. 250 ms keeps the thumb and the time moving smoothly; the default is 500. */
const PLAYER_OPTIONS = { updateInterval: 250 } as const;
/**
 * A stream that reports no length while it plays is live. Wait this many
 * seconds of playback before deciding, so a file that is merely slow to report
 * its duration is not called live.
 */
const LIVE_PROBE_SECONDS = 1;
/**
 * After a scrub resumes playback, how long to keep drawing "playing" while the
 * native player catches up and reports `playing: true`.
 */
const RESUME_GRACE_MS = 1000;
/** Play-button size: the `Button` size, its glyph and the spinner that replaces it. */
const PLAY_SIZES = { compact: "md", full: "lg" } as const satisfies Record<string, ButtonSize>;
const PLAY_ICON_SIZES = { md: 18, lg: 22 } as const;

const IDLE_STATUS: AudioStatus = {
  id: "",
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
};

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`).
 */
const playButtonStyles = /*#__PURE__*/ StyleSheet.create({
  md: {
    width: buttonHeights.md,
    minWidth: buttonHeights.md,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: buttonHeights.md / 2,
  },
  lg: {
    width: buttonHeights.lg,
    minWidth: buttonHeights.lg,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: buttonHeights.lg / 2,
  },
});

const styles = /*#__PURE__*/ StyleSheet.create({
  root: {
    borderRadius: spacing.radiusSm,
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: spacing.touchTarget,
  },
  full: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.smd,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  scrubber: {
    flex: 1,
    minWidth: 0,
  },
  scrubberFull: {
    alignSelf: "stretch",
  },
  compactTime: {
    flexShrink: 0,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  compactMessage: {
    flexShrink: 1,
    textAlign: "right",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timeSide: {
    flex: 1,
    minWidth: 0,
    fontVariant: ["tabular-nums"],
  },
  timeEnd: {
    textAlign: "right",
  },
  timeControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  speed: {
    minWidth: spacing.xxl,
  },
});

const themedStyles = /*#__PURE__*/ createThemedStyles((theme) =>
  StyleSheet.create({
    muted: { color: theme.colors.mutedForeground },
    error: { color: theme.colors.destructive },
  }),
);

const isMissing = (source: AudioPlayerProps["source"]) => source === null || source === undefined || source === "";

function snapshotOf(player: ExpoAudioPlayer): AudioStatus {
  return player.currentStatus ?? IDLE_STATUS;
}

/** A URL for the lock screen from whatever `artwork` was given. */
function artworkUrlOf(artwork: AudioPlayerProps["artwork"]): string | undefined {
  if (typeof artwork === "string") return artwork;
  if (typeof artwork === "number") {
    try {
      return NativeImage.resolveAssetSource(artwork)?.uri;
    } catch {
      return undefined;
    }
  }
  return artwork && typeof artwork === "object" && "uri" in artwork ? artwork.uri : undefined;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const speedText = (rate: number) => `${rate}×`;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface AudioPlayerViewProps
  extends Pick<AudioPlayerProps, "variant" | "title" | "subtitle" | "artwork" | "showSpeed" | "showMute" | "style" | "testID"> {
  /** The server and the hydration pass: controls disabled, `--:--`. */
  pending?: boolean;
  /** A load error or a missing source: controls disabled, the unavailable message in place of the time. */
  unavailable?: boolean;
  playing?: boolean;
  /** Buffering, or waiting for the file after play: the play button shows a spinner. */
  loading?: boolean;
  live?: boolean;
  /** Seconds. */
  position?: number;
  /** Seconds; `0` while unknown. */
  duration?: number;
  muted?: boolean;
  rate?: number;
  keyboard?: MediaKeyboardProps;
  onTogglePlay?: () => void;
  onToggleMute?: () => void;
  onCycleSpeed?: () => void;
  onScrubStart?: () => void;
  onScrubChange?: (seconds: number) => void;
  onScrubEnd?: (seconds: number) => void;
  onMagicTap?: () => void;
}

/**
 * The player's whole layout and nothing else: no hooks into `expo-audio`, so
 * the server render, the hydration pass and the live player draw the same
 * tree and nothing shifts when the live one mounts.
 */
function AudioPlayerView({
  variant = "compact",
  title,
  subtitle,
  artwork,
  showSpeed = true,
  showMute = false,
  style,
  testID,
  pending = false,
  unavailable = false,
  playing = false,
  loading = false,
  live = false,
  position = 0,
  duration = 0,
  muted = false,
  rate = 1,
  keyboard,
  onTogglePlay,
  onToggleMute,
  onCycleSpeed,
  onScrubStart,
  onScrubChange,
  onScrubEnd,
  onMagicTap,
}: AudioPlayerViewProps) {
  const { theme, getFocusRingStyle } = useTheme();
  const themed = themedStyles(theme);
  const focus = useFocusVisible();
  const full = variant === "full";
  const disabled = pending || unavailable;
  const known = !live && Number.isFinite(duration) && duration > 0;
  const idle = !playing && position <= 0;

  // ----- Readout ------------------------------------------------------------
  const unavailableText = translateText("media.audioError", "Audio unavailable") ?? "Audio unavailable";
  const unknown = formatMediaTime(Number.NaN);
  const reference = known ? duration : undefined;
  const elapsed = live
    ? formatMediaTime(Number.POSITIVE_INFINITY)
    : !known && position <= 0
      ? unknown
      : formatMediaTime(position, reference);
  // The compact row shows the total until playback starts, then the position.
  const compactTime = live ? elapsed : known && idle ? formatMediaTime(duration, duration) : elapsed;
  // Counted down from the whole seconds already played, so elapsed + remaining is the total.
  const remaining = live ? "" : known ? `-${formatMediaTime(Math.max(0, duration - Math.floor(position)), duration)}` : unknown;

  // ----- Labels -------------------------------------------------------------
  const playLabel = title
    ? (translateText("media.playTitle", `Play ${title}`, { title }) ?? `Play ${title}`)
    : (translateText("media.play", "Play") ?? "Play");
  const pauseLabel = title
    ? (translateText("media.pauseTitle", `Pause ${title}`, { title }) ?? `Pause ${title}`)
    : (translateText("media.pause", "Pause") ?? "Pause");
  const loadingLabel = translateText("media.loading", "Loading") ?? "Loading";
  const muteLabel = muted
    ? (translateText("media.unmute", "Unmute") ?? "Unmute")
    : (translateText("media.mute", "Mute") ?? "Mute");
  const speedLabel =
    translateText("media.playbackSpeed", `Playback speed ${speedText(rate)}`, { rate: speedText(rate) }) ??
    `Playback speed ${speedText(rate)}`;

  const id = (part: string) => (testID ? `${testID}-${part}` : undefined);

  // `IconButton loading` would block presses, and a stalled load needs the press
  // that cancels it. So this is the same button (circle, ghost, 44 pt hit area)
  // with a spinner in place of the glyph and `aria-busy`, never `loading`.
  const playSize = full ? PLAY_SIZES.full : PLAY_SIZES.compact;
  const play = (
    <Button
      preset="ghost"
      size={playSize}
      style={playButtonStyles[playSize]}
      hitSlop={verticalSlopFor(buttonHeights[playSize])}
      disabled={disabled}
      aria-busy={loading}
      accessibilityLabel={loading ? loadingLabel : playing ? pauseLabel : playLabel}
      onPress={onTogglePlay}
      testID={id("play")}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.text} />
      ) : (
        <Button.Icon name={playing ? "pause" : "play"} size={PLAY_ICON_SIZES[playSize]} />
      )}
    </Button>
  );

  const scrubber = (
    <MediaScrubber
      tone="default"
      value={position}
      duration={live ? Number.POSITIVE_INFINITY : known ? duration : 0}
      disabled={disabled}
      onScrubStart={onScrubStart}
      onScrubChange={onScrubChange}
      onScrubEnd={onScrubEnd}
      step={SEEK_STEP}
      style={full ? styles.scrubberFull : styles.scrubber}
      testID={id("scrubber")}
    />
  );

  const mute = showMute ? (
    <IconButton
      icon={muted ? "volume-x" : "volume-2"}
      preset="ghost"
      shape="circle"
      size="sm"
      disabled={disabled}
      accessibilityLabel={muteLabel}
      accessibilityState={{ selected: muted }}
      onPress={onToggleMute}
      testID={id("mute")}
    />
  ) : null;

  // The numbers are hidden from assistive tech: the scrubber announces the
  // position in words ("1 minute 2 seconds of 3 minutes"), which `1:02` is not.
  const time = (text: string, extra: StyleProp<TextStyle>, part: string) => (
    <StyledText
      semantic="caption"
      aria-hidden
      numberOfLines={1}
      style={StyleSheet.flatten([themed.muted, extra])}
      testID={id(part)}
    >
      {text}
    </StyledText>
  );
  const message = (extra: StyleProp<TextStyle>, part: string) => (
    <StyledText
      semantic="caption"
      accessibilityRole="alert"
      numberOfLines={1}
      style={StyleSheet.flatten([themed.error, extra])}
      testID={id(part)}
    >
      {unavailableText}
    </StyledText>
  );

  // ----- Root ---------------------------------------------------------------
  const onFocus = (event: NativeSyntheticEvent<TargetedEvent>) => {
    // Focus inside the player (a button, the scrubber) bubbles here; each draws its own ring.
    const raw = event as unknown as { target?: unknown; currentTarget?: unknown };
    if (raw.target !== undefined && raw.currentTarget !== undefined && raw.target !== raw.currentTarget) return;
    focus.onFocus(event);
  };
  const rootProps = {
    ...keyboard,
    ...(Platform.OS === "web"
      ? { role: "group" as const, "aria-label": title ?? (translateText("media.audioPlayer", "Audio player") ?? "Audio player") }
      : null),
    ...(Platform.OS === "ios" && onMagicTap ? { onMagicTap } : null),
  };

  return (
    <View
      {...rootProps}
      onFocus={keyboard?.focusable ? onFocus : undefined}
      onBlur={keyboard?.focusable ? focus.onBlur : undefined}
      testID={testID}
      style={[
        styles.root,
        full ? styles.full : styles.compact,
        focus.focused && getFocusRingStyle(),
        // Spread array styles so the View never receives a nested array (web).
        ...(Array.isArray(style) ? style : [style]),
      ]}
    >
      {full ? (
        <>
          <View style={styles.header}>
            {artwork ? <Image source={artwork} alt="" radius="md" style={styles.artwork} testID={id("artwork")} /> : null}
            <View style={styles.headerText}>
              {title ? (
                <StyledText fontWeight="semibold" numberOfLines={1} testID={id("title")}>
                  {title}
                </StyledText>
              ) : null}
              {subtitle ? (
                <StyledText semantic="caption" numberOfLines={1} style={themed.muted} testID={id("subtitle")}>
                  {subtitle}
                </StyledText>
              ) : null}
            </View>
            {play}
          </View>
          {scrubber}
          <View style={styles.timeRow}>
            {unavailable ? message(styles.timeSide, "message") : time(elapsed, styles.timeSide, "elapsed")}
            {unavailable ? null : (
              <View style={styles.timeControls}>
                {showSpeed ? (
                  <Button
                    preset="ghost"
                    size="sm"
                    text={speedText(rate)}
                    style={styles.speed}
                    disabled={disabled}
                    accessibilityLabel={speedLabel}
                    onPress={onCycleSpeed}
                    testID={id("speed")}
                  />
                ) : null}
                {mute}
              </View>
            )}
            {unavailable ? null : time(remaining, [styles.timeSide, styles.timeEnd], "remaining")}
          </View>
        </>
      ) : (
        <>
          {play}
          {scrubber}
          {unavailable ? message(styles.compactMessage, "message") : time(compactTime, styles.compactTime, "time")}
          {mute}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Live player
// ---------------------------------------------------------------------------

type LiveOptions = Omit<AudioPlayerProps, "source" | "player">;

interface AudioPlayerLiveProps extends LiveOptions {
  player: ExpoAudioPlayer;
  /** The component created `player` (and so pauses it on unmount). */
  owned: boolean;
}

/** Where a scrub started, so the end can resume what it paused. `seconds` follows the thumb. */
interface Scrub {
  seconds: number;
  resume: boolean;
}

/**
 * Everything that touches a player. Mounts only where a player can exist: on
 * native at once, on web after hydration, or whenever the caller passed one.
 */
function AudioPlayerLive({
  player,
  owned,
  variant,
  title,
  subtitle,
  artwork,
  showSpeed,
  showMute,
  autoPlay = false,
  loop,
  lockScreen = false,
  onPlayingChange,
  onEnd,
  onError,
  style,
  testID,
}: AudioPlayerLiveProps) {
  const [status, setStatus] = useState<AudioStatus>(() => snapshotOf(player));
  const [failed, setFailed] = useState(false);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const [muted, setMuted] = useState(status.mute);
  const [rate, setRate] = useState(status.playbackRate > 0 ? status.playbackRate : 1);
  // Latched only for the "duration stays 0 while playing" guess; every other
  // way of being live is read from the current status (see Derived).
  const [stalled, setStalled] = useState(false);
  // A scrub resumed playback and the player has not yet said `playing: true`.
  const [resuming, setResuming] = useState(false);

  // The callbacks are read through a ref so the player subscription below does
  // not resubscribe, and a caller's inline functions never go stale.
  const callbacks = useRef({ onPlayingChange, onEnd, onError });
  // `scrub` is state for drawing; the handlers decide from this ref, because a tap's start and end can run before a render between them.
  const scrubbing = useRef<Scrub | null>(null);
  const mounted = useRef(true);
  const needsRestart = useRef(false);
  const lastError = useRef<string | null>(null);
  useLayoutEffect(() => {
    callbacks.current = { onPlayingChange, onEnd, onError };
  });

  // ----- Status -------------------------------------------------------------
  // This subscribes in a layout effect rather than through `useAudioPlayerStatus`,
  // whose `useEvent` subscribes in a passive effect: a player starts loading when
  // it is created, so its first updates can fire in the gap and be missed. The
  // earlier subscription narrows that gap, and the snapshot read catches up on
  // the state that changed before it (loaded, duration, playing). It cannot
  // recover an error: `currentStatus` reports `error` as null on web, iOS and
  // Android, so an error arrives only through the event.
  useLayoutEffect(() => {
    setStatus(snapshotOf(player));
    const subscription = player.addListener("playbackStatusUpdate", (next: AudioStatus) => {
      setStatus(next);
      if (next.error) {
        // A load error clears `isLoaded`; a refused `play()` (autoplay blocked) leaves it set, and only reverts to paused.
        if (!next.isLoaded) setFailed(true);
        if (lastError.current !== next.error) {
          lastError.current = next.error;
          callbacks.current.onError?.(next.error);
        }
      } else if (next.isLoaded && next.duration > 0) {
        setFailed(false);
        lastError.current = null;
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Pause what this component created; a player the caller passed is theirs.
  useEffect(
    () => () => {
      if (!owned) return;
      try {
        player.pause();
      } catch {
        // Already released.
      }
    },
    [owned, player],
  );

  // ----- Derived ------------------------------------------------------------
  const duration = status.duration;
  const probed = status.isLoaded && status.playing && duration === 0 && status.currentTime >= LIVE_PROBE_SECONDS;
  // Latched: pausing such a stream must not turn it back into an unknown length.
  if (probed && !stalled) setStalled(true);
  // A length that arrives after all means it was a slow file, not a stream.
  if (stalled && status.isLoaded && !status.isLive && Number.isFinite(duration) && duration > 0) setStalled(false);
  // iOS builds `isLive` from an item duration that is indefinite until the item
  // is ready, so `isLive` means nothing before `isLoaded`.
  const live = (status.isLoaded && status.isLive) || duration === Number.POSITIVE_INFINITY || stalled;
  const known = !live && Number.isFinite(duration) && duration > 0;
  const looping = loop ?? status.loop;

  const playing = scrub ? scrub.resume : resuming || status.playing;
  const position = scrub ? scrub.seconds : status.currentTime;
  const loading = !failed && (status.isBuffering || (wantsPlay && !status.isLoaded));

  // ----- Playback -----------------------------------------------------------
  /** Seek, swallowing a refusal: a failed seek must not break a gesture handler. */
  const seek = (seconds: number) => {
    // The thumb stays where it was dropped until the player reports the position.
    setStatus((previous) => ({ ...previous, currentTime: seconds }));
    return Promise.resolve(player.seekTo(seconds)).catch(() => {});
  };

  const play = () => {
    if (failed) return;
    if (needsRestart.current && !looping) {
      needsRestart.current = false;
      void seek(0);
    }
    setWantsPlay(true);
    player.play();
  };

  const pause = () => {
    setWantsPlay(false);
    setResuming(false);
    player.pause();
  };

  const togglePlay = () => (playing || loading ? pause() : play());

  const seekBy = (delta: number) => {
    if (!known || failed) return;
    needsRestart.current = false;
    void seek(clamp(status.currentTime + delta, 0, duration));
  };

  const toggleMute = () => {
    const next = !muted;
    player.muted = next;
    setMuted(next);
  };

  const cycleSpeed = () => {
    const current = SPEEDS.indexOf(rate as (typeof SPEEDS)[number]);
    const next = SPEEDS[(current === -1 ? 0 : current + 1) % SPEEDS.length];
    // `high` keeps the pitch on web, where the default is a chipmunk voice; native ignores it where it has no such setting.
    player.setPlaybackRate(next, "high");
    setRate(next);
  };

  const scrubStart = () => {
    const resume = status.playing;
    scrubbing.current = { seconds: status.currentTime, resume };
    setScrub(scrubbing.current);
    setResuming(false);
    if (resume) player.pause();
  };

  const scrubChange = (seconds: number) => {
    if (!scrubbing.current) return;
    scrubbing.current = { ...scrubbing.current, seconds };
    setScrub(scrubbing.current);
  };

  const scrubEnd = async (seconds: number) => {
    // A keyboard or screen-reader adjustment has no start, so nothing was paused.
    const resume = scrubbing.current?.resume ?? false;
    needsRestart.current = false;
    if (scrubbing.current) {
      scrubbing.current = { seconds, resume };
      setScrub(scrubbing.current);
    }
    await seek(seconds);
    if (resume && mounted.current) {
      player.play();
      // Native reports `playing: true` a moment later; until then the clip still counts as playing.
      setResuming(true);
    }
    scrubbing.current = null;
    if (mounted.current) setScrub(null);
  };

  // ----- Effects ------------------------------------------------------------
  useEffect(() => {
    if (!resuming) return;
    if (status.playing) {
      setResuming(false);
      return;
    }
    const timer = setTimeout(() => setResuming(false), RESUME_GRACE_MS);
    return () => clearTimeout(timer);
  }, [resuming, status.playing]);

  useEffect(() => {
    if (loop !== undefined) player.loop = loop;
  }, [player, loop]);

  const autoPlayed = useRef(false);
  useEffect(() => {
    if (!autoPlay || autoPlayed.current) return;
    autoPlayed.current = true;
    play();
    // Once, when the player first exists.
  }, []);

  useEffect(() => {
    setMuted(status.mute);
  }, [status.mute]);

  const lastPlaying = useRef(playing);
  useEffect(() => {
    if (lastPlaying.current === playing) return;
    lastPlaying.current = playing;
    callbacks.current.onPlayingChange?.(playing);
  }, [playing]);

  // `didJustFinish` is `media.ended` on web and stays true on every later
  // update, so only its rising edge is the end.
  const lastFinished = useRef(status.didJustFinish);
  useEffect(() => {
    const edge = status.didJustFinish && !lastFinished.current;
    lastFinished.current = status.didJustFinish;
    if (!edge) return;
    setWantsPlay(false);
    needsRestart.current = !looping;
    if (!looping) callbacks.current.onEnd?.();
  }, [status.didJustFinish]);

  const artworkUrl = lockScreen ? artworkUrlOf(artwork) : undefined;
  useEffect(() => {
    if (!lockScreen || !status.playing) return;
    try {
      player.setActiveForLockScreen(true, { title, artist: subtitle, artworkUrl });
    } catch {
      // No lock screen here (or the player is gone).
    }
  }, [lockScreen, status.playing, player, title, subtitle, artworkUrl]);

  useEffect(
    () => () => {
      if (!lockScreen) return;
      try {
        player.setActiveForLockScreen(false);
      } catch {
        // Already released.
      }
    },
    [lockScreen, player],
  );

  // ----- Keyboard (web) -----------------------------------------------------
  const usable = !failed;
  const keyboard = useMediaKeyboard({
    togglePlay: usable ? togglePlay : undefined,
    seekBack: usable && known ? () => seekBy(-SEEK_STEP) : undefined,
    seekForward: usable && known ? () => seekBy(SEEK_STEP) : undefined,
    toggleMute: usable ? toggleMute : undefined,
  });

  return (
    <AudioPlayerView
      variant={variant}
      title={title}
      subtitle={subtitle}
      artwork={artwork}
      showSpeed={showSpeed}
      showMute={showMute}
      style={style}
      testID={testID}
      unavailable={failed}
      playing={playing}
      loading={loading}
      live={live}
      position={position}
      duration={known ? duration : 0}
      muted={muted}
      rate={rate}
      keyboard={keyboard}
      onTogglePlay={togglePlay}
      onToggleMute={toggleMute}
      onCycleSpeed={cycleSpeed}
      onScrubStart={scrubStart}
      onScrubChange={scrubChange}
      onScrubEnd={scrubEnd}
      onMagicTap={usable ? togglePlay : undefined}
    />
  );
}

interface OwnedAudioPlayerProps extends LiveOptions {
  source: AudioPlayerProps["source"];
}

/** The branch that creates the player: `useAudioPlayer` lives here so it runs only when a player may exist. */
function OwnedAudioPlayer({ source, ...rest }: OwnedAudioPlayerProps) {
  const player = useAudioPlayer(source as AudioSource, PLAYER_OPTIONS);
  // A new source is a new player; start the live state over with it.
  return <AudioPlayerLive key={JSON.stringify(source)} player={player} owned {...rest} />;
}

// ---------------------------------------------------------------------------
// AudioPlayer
// ---------------------------------------------------------------------------

/**
 * AudioPlayer
 *
 * A themed, flat audio player on `expo-audio` with the same controls on iOS,
 * Android and web: play and pause, a scrubber, the time, and in `variant="full"`
 * artwork, a title, `-remaining` and a speed button. It draws no container;
 * put it in a `Card` or an `Item` row when you want one.
 *
 * `expo-audio`'s web player builds an `HTMLAudioElement` when it is created,
 * which a server cannot do. The component therefore renders a static shell (the
 * same layout, a disabled play button and `--:--`) on the server and through
 * the hydration pass, and creates the player once it is hydrated. On native, and
 * whenever you pass `player`, it mounts at once.
 *
 * A live stream (a duration that is never known) shows `Live` and disables the
 * scrubber. A file that fails to load, or no `source`, disables the controls and
 * shows "Audio unavailable". On web, focus the player for Space or K (play and
 * pause), ←/→ (5 s) and M (mute).
 *
 * The component does not call `setAudioModeAsync`: that is process-wide. See
 * `LLM_USAGE.md` for the silent switch, background playback and the lock screen.
 *
 * Subpath-only, and needs the optional `expo-audio` and `expo-image` peers:
 * `@mrmeg/expo-ui/components/AudioPlayer`.
 *
 * ```tsx
 * <AudioPlayer source={note.url} />
 * <AudioPlayer variant="full" source={episode.url} title={episode.title} subtitle={show.name} artwork={show.cover} />
 * ```
 */
export function AudioPlayer({ source, player, ...rest }: AudioPlayerProps) {
  const hydrated = useHydrated();
  const missing = player === undefined && isMissing(source);
  const onError = rest.onError;
  const { variant, title, subtitle, artwork, showSpeed, showMute, style, testID } = rest;
  const layout = { variant, title, subtitle, artwork, showSpeed, showMute, style, testID };

  // A missing source never creates a player, so the error is reported here.
  useEffect(() => {
    if (missing) onError?.(translateText("media.audioError", "Audio unavailable") ?? "Audio unavailable");
    // `onError` is a caller's function; the report is once per transition into "missing".
  }, [missing]);

  if (player !== undefined) return <AudioPlayerLive key={player.id} player={player} owned={false} {...rest} />;
  if (missing) return <AudioPlayerView {...layout} unavailable />;
  if (!hydrated) return <AudioPlayerView {...layout} pending />;
  return <OwnedAudioPlayer source={source} {...rest} />;
}
