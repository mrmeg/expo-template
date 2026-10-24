import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  // The full-screen player sits on black, so its status bar is always light; `StatusBar` (the component) follows the theme.
  StatusBar,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { VideoView, useVideoPlayer, type VideoPlayer, type VideoPlayerStatus, type VideoSource } from "expo-video";
import type { ImageSource } from "expo-image";
import { palette } from "../constants/colors";
import { durations } from "../constants/motion";
import { spacing } from "../constants/spacing";
import { useMediaKeyboard } from "../hooks/useMediaKeyboard";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { withAlpha } from "../hooks/useTheme";
import { useWindowInsets } from "../hooks/useWindowInsets";
import { shouldUseNativeDriver } from "../lib/animations";
import { translateText } from "../lib/i18n";
import { mediaFrameStyle, useMediaAspectRatio, type MediaAspectRatio } from "../lib/mediaFrame";
import { formatMediaTime, mediaTimeA11y } from "../lib/mediaTime";
import { stateSurfaceProps } from "../lib/stateSurface";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import {
  enterElementFullscreen,
  exitElementFullscreen,
  getFullscreenElement,
  subscribeFullscreenChange,
} from "../lib/webFullscreen";
import { Image, type ImageRadius } from "./Image";
import { MediaControlButton } from "./MediaControlButton";
import { MediaScrubber } from "./MediaScrubber";
import { StyledText } from "./StyledText";
import { TIME_UPDATE_INTERVAL, pickCaptionTrack, usePlayback, type Playback } from "./videoPlayback";

/** How the picture fills its frame. `expo-video`'s `contentFit`: `contain` (default), `cover`, `fill`. */
export type VideoFit = "contain" | "cover" | "fill";

/**
 * Who draws the controls.
 *
 * - `"native"`: the platform's (AVKit, the Media3 player UI, the browser's).
 * - `"custom"`: the kit's themed controls, the same on every platform.
 * - `"none"`: bare playback.
 */
export type VideoControls = "native" | "custom" | "none";

export interface VideoProps {
  /**
   * What to play: a URL, a `require()`d asset, or an `expo-video` source object
   * (`{ uri, headers, contentType }`). Ignored when `player` is given, except
   * that Retry reloads it. A new value replaces the source in place.
   */
  source?: VideoSource;
  /**
   * Your own `useVideoPlayer()` result, for programmatic control. `Video`
   * never releases it, and only pauses it on unmount. `loop` and `muted` are not
   * applied to it: set them on the player. Pass `source` as well to enable
   * Retry in the error state.
   */
  player?: VideoPlayer;
  /** Who draws the controls. @default "native" */
  controls?: VideoControls;
  /** How the picture fills the frame. @default "contain" */
  fit?: VideoFit;
  /**
   * The frame's shape. A number, `"16:9"` or `{ width, height }` makes the
   * frame as wide as its parent at that ratio. `"auto"` draws at 16:9 until the
   * video reports its size, then moves to its ratio once. Prefer an explicit
   * ratio when you know it.
   * @default "auto"
   */
  aspectRatio?: MediaAspectRatio | "auto";
  /** Largest frame width, in points. */
  maxWidth?: number;
  /** Largest frame height, in points, enforced through the width so the frame stays centered. */
  maxHeight?: number;
  /** Absolutely fill the positioned parent. Wins over `aspectRatio`. */
  fill?: boolean;
  /** Corner radius, from the `spacing.radius*` scale. @default "none" */
  radius?: ImageRadius;
  /** Shown until playback first starts, then removed. A URL, a `require()`d image or an `expo-image` source. */
  poster?: ImageSource | string | number;
  /** Start playing on mount. On web the browser only allows it with `muted`. @default false */
  autoPlay?: boolean;
  /** Replay from the start at the end. Initial value, applied to the player `Video` creates. */
  loop?: boolean;
  /** Start muted. Initial value, applied to the player `Video` creates. */
  muted?: boolean;
  /** Show a full-screen control (`"custom"`) or the platform's (`"native"`). @default true */
  allowsFullscreen?: boolean;
  /** Allow Picture in Picture. Native needs the `expo-video` config plugin's `supportsPictureInPicture`. @default true */
  allowsPictureInPicture?: boolean;
  /** Names the video for assistive technology, and the error state. Wins over `accessibilityLabel`. */
  title?: string;
  /** Names the video when there is no `title`. @default "Video" */
  accessibilityLabel?: string;
  onStatusChange?: (status: VideoPlayerStatus) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Playback reached the end (called on every pass when looping). */
  onEnd?: () => void;
  /** Loading or playback failed. The message is the player's, or the default error text. */
  onError?: (message: string) => void;
  /** Layout of the frame: margins, width, height, flex. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FALLBACK_RATIO = 16 / 9;
const HIDE_DELAY_MS = 3000;
const KEY_SEEK_SECONDS = 5;
const ACCESSIBILITY_SEEK_SECONDS = 10;
const VOLUME_STEP = 0.1;
/** A frame narrower than this puts the scrubber on its own row above the buttons. */
const COMPACT_WIDTH = 420;
/** Below this frame height the center play button drops to `md`, so it clears the bar. */
const SHORT_HEIGHT = 240;
/**
 * Below this frame height the center button hides; the bar's own play button
 * remains. A compact (narrow) frame stacks the bar in two rows, so it needs
 * more room above the bar.
 */
const TINY_HEIGHT = 140;
const TINY_HEIGHT_COMPACT = 216;

/** The bar's scrim: fixed, never a theme color, because it sits over any frame. */
const SCRIM = /*#__PURE__*/ withAlpha(palette.black, 0.45);
const MUTED_TEXT = /*#__PURE__*/ withAlpha(palette.white, 0.72);

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`). None depend on the theme: the frame is black.
 */
const geometry = /*#__PURE__*/ StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: palette.black },
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  centered: { alignItems: "center", justifyContent: "center" },
  // The layer is there to place children; touches go to them, and past them to what is underneath.
  boxNone: { pointerEvents: "box-none" },
  passive: { pointerEvents: "none" },
  fullscreenRoot: { flex: 1, backgroundColor: palette.black },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: SCRIM, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.smd },
  buttons: { flexDirection: "row", alignItems: "center", gap: spacing.smd },
  grow: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  time: { color: palette.white, fontVariant: ["tabular-nums"] },
  error: { backgroundColor: palette.black, gap: spacing.smd, padding: spacing.md },
  errorText: { color: MUTED_TEXT, textAlign: "center" },
});

/** `VideoView` draws a `<video>` on web and takes the style as a plain object there, so this is not a registered sheet. */
const VIDEO_FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" } as const;
/** The same, for the modes whose frame handles every touch itself: the `<video>` must not take a click. */
const VIDEO_FILL_PASSIVE = { ...VIDEO_FILL, pointerEvents: "none" } as const;

const radiusStyles = /*#__PURE__*/ StyleSheet.create({
  none: { borderRadius: spacing.radiusNone },
  xs: { borderRadius: spacing.radiusXs },
  sm: { borderRadius: spacing.radiusSm },
  md: { borderRadius: spacing.radiusMd },
  lg: { borderRadius: spacing.radiusLg },
  xl: { borderRadius: spacing.radiusXl },
  "2xl": { borderRadius: spacing.radius2xl },
  full: { borderRadius: spacing.radiusFull },
});

/** Copy for the controls and states, each through `translateText` so an app can translate it. */
function copy(key: string, fallback: string): string {
  return translateText(key, fallback) ?? fallback;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** What `VideoSurface` draws and calls: all state lives in `VideoStage`, so the inline frame and the fullscreen `Modal` share it. */
interface Stage {
  id: string;
  player: VideoPlayer;
  controls: VideoControls;
  fit: VideoFit;
  allowsFullscreen: boolean;
  allowsPictureInPicture: boolean;
  label: string;
  poster?: ImageSource | string | number;
  posterVisible: boolean;
  onPosterError: () => void;
  playback: Playback["playback"];
  waiting: boolean;
  failed: boolean;
  errorLabel: string;
  canRetry: boolean;
  retry: () => void;
  chromeShown: boolean;
  chromeOpacity: Animated.Value;
  bump: () => void;
  setHovered: (hovered: boolean) => void;
  compact: boolean;
  /** Center play button size for the frame height; `null` hides it in a very short frame. */
  centerSize: "md" | "lg" | null;
  fullscreen: boolean;
  viewRef: React.RefObject<VideoView | null>;
  onFirstFrame: () => void;
  onVideoFullscreenChange: (entered: boolean) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleCaptions: () => void;
  toggleFullscreen: () => void;
  scrubStart: () => void;
  scrubEnd: (seconds: number) => void;
}

/**
 * Video
 *
 * A video that sizes from its own aspect ratio, built on `expo-video` (an
 * optional peer: `npx expo install expo-video`). Import it from
 * `@mrmeg/expo-ui/components/Video`; it is not in the barrel.
 *
 * Pick who draws the controls with `controls`:
 *
 * - `"native"` (default): the platform's controls. Fullscreen and Picture in
 *   Picture are the platform's too.
 * - `"custom"`: themed controls that look the same on iOS, Android and web: a
 *   center play button, and a bar with play, a scrubber, the time, mute,
 *   captions (when the video has subtitle tracks) and fullscreen. They fade
 *   3 s after the last interaction while playing, come back on hover, focus
 *   and tap, and never hide under a screen reader. On web they respond to
 *   Space/K, ←/→, ↑/↓, M, F and Esc while the frame is focused.
 * - `"none"`: bare playback, for a muted loop or your own controls (pass a
 *   `player`).
 *
 * The frame is black and sized like `Image`: `aspectRatio` (a number,
 * `"16:9"`, `{ width, height }`) fills the parent's width at that ratio, capped
 * by `maxWidth` / `maxHeight` and centered; `"auto"` (the default) starts at
 * 16:9 and moves to the video's own ratio once it is known; `fill` fills a
 * positioned parent.
 *
 * ```tsx
 * <Video source={clip.url} controls="custom" aspectRatio={{ width: clip.width, height: clip.height }} poster={clip.poster} />
 * <Video source={{ uri }} controls="none" aspectRatio="9:16" maxHeight={480} autoPlay muted loop />
 * <Video player={player} controls="custom" aspectRatio="16:9" />
 * ```
 *
 * Pausing when the screen loses focus is the app's job: the kit has no router,
 * so use `useIsFocused()` from expo-router with your own `player`.
 */
export function Video(props: VideoProps) {
  return props.player ? <VideoStage {...props} player={props.player} /> : <VideoWithOwnPlayer {...props} />;
}

/** Owns the player, so a `Video` handed its own never creates a second one. */
function VideoWithOwnPlayer(props: VideoProps) {
  const { source, loop, muted } = props;
  // `loop` and `muted` are initial values: expo-video runs this once per player.
  const player = useVideoPlayer(source ?? null, (created) => {
    created.loop = !!loop;
    created.muted = !!muted;
  });
  return <VideoStage {...props} player={player} />;
}

function VideoStage({
  player,
  source,
  controls = "native",
  fit = "contain",
  aspectRatio = "auto",
  maxWidth,
  maxHeight,
  fill,
  radius = "none",
  poster,
  autoPlay = false,
  allowsFullscreen = true,
  allowsPictureInPicture = true,
  title,
  accessibilityLabel,
  onStatusChange,
  onPlayingChange,
  onEnd,
  onError,
  style,
  testID = "video",
}: VideoProps & { player: VideoPlayer }) {
  const custom = controls === "custom";
  const reducedMotion = useReducedMotion();
  const { ratio, reportNaturalSize } = useMediaAspectRatio(aspectRatio, FALLBACK_RATIO);

  const errorFallback = copy("media.videoError", "Video failed to load");
  const handleError = useCallback((message: string) => onError?.(message || errorFallback), [onError, errorFallback]);

  const { playback, retrying, seekTo, retry, setSubtitleTrack, setNoVideo, failRetry } = usePlayback(player, {
    onStatusChange,
    onPlayingChange,
    onEnd,
    onError: handleError,
    onNaturalSize: reportNaturalSize,
  });

  const frameRef = useRef<React.ComponentRef<typeof View>>(null);
  const viewRef = useRef<VideoView>(null);

  // --- Player setup that must not run during render ---------------------------
  // `timeUpdateEventInterval` starts a timer on web, and render also runs on the
  // server, which has no teardown: set it here instead of in the player's setup.
  useEffect(() => {
    if (!custom) return;
    const previous = player.timeUpdateEventInterval;
    player.timeUpdateEventInterval = TIME_UPDATE_INTERVAL;
    return () => {
      player.timeUpdateEventInterval = previous;
    };
  }, [player, custom]);

  // `play()` on web does nothing until a `<video>` is mounted, so autoplay starts
  // here, after the `VideoView`'s own mount effect, not in the player's setup.
  useEffect(() => {
    if (autoPlay) player.play();
  }, [player, autoPlay]);

  // Pause on unmount. The lifecycle hook keeps its player alive through effect
  // cleanups, so this is safe; a caller-owned player is only paused, never released.
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // A player the caller already released.
      }
    };
  }, [player]);

  // --- Web: what expo-video's web player does not report ----------------------
  // It emits no `videoTrackChange` or `sourceLoad`, so the natural size comes from
  // the `<video>` itself (post-rotation, as the browser draws it).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = viewRef.current?.nativeRef?.current as HTMLVideoElement | null | undefined;
    if (!element || typeof element.addEventListener !== "function") return;

    const measure = () => {
      if (element.videoWidth > 0 && element.videoHeight > 0) {
        setNoVideo(false);
        reportNaturalSize(element.videoWidth, element.videoHeight);
      } else if (element.readyState >= 1) {
        setNoVideo(true);
      }
    };
    measure();
    element.addEventListener("loadedmetadata", measure);
    element.addEventListener("error", failRetry);
    return () => {
      element.removeEventListener("loadedmetadata", measure);
      element.removeEventListener("error", failRetry);
    };
  }, [player, reportNaturalSize, setNoVideo, failRetry]);

  // --- Chrome visibility (custom controls) -------------------------------------
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [bumps, setBumps] = useState(0);
  const [screenReader, setScreenReader] = useState(false);
  const chromeOpacity = useAnimatedValue(1);

  const bump = useCallback(() => {
    setVisible(true);
    setBumps((count) => count + 1);
  }, []);

  const handleHover = useCallback(
    (isHovered: boolean) => {
      setHovered(isHovered);
      bump();
    },
    [bump],
  );

  useEffect(() => {
    // react-native-web reports a screen reader as always on, which would pin the
    // chrome open; on web focus and hover are the signals instead.
    if (!custom || Platform.OS === "web") return;
    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (!cancelled) setScreenReader(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [custom]);

  const playing = playback.playing;
  useEffect(() => {
    if (!custom || !visible || !playing || hovered || screenReader) return;
    const timer = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [custom, visible, playing, hovered, screenReader, bumps]);

  // Paused chrome stays up; so does everything while someone is pointing at it.
  const chromeShown = custom && (visible || !playing || hovered || screenReader);
  useEffect(() => {
    const toValue = chromeShown ? 1 : 0;
    if (reducedMotion) {
      chromeOpacity.setValue(toValue);
      return;
    }
    const animation = Animated.timing(chromeOpacity, { toValue, duration: durations.fast, useNativeDriver: shouldUseNativeDriver });
    animation.start();
    return () => animation.stop();
  }, [chromeShown, reducedMotion, chromeOpacity]);

  // --- Commands ---------------------------------------------------------------
  const duration = playback.duration;
  const seekClamped = useCallback(
    (seconds: number) => {
      if (!playback.isLive) seekTo(clamp(seconds, 0, duration > 0 ? duration : seconds));
    },
    [playback.isLive, duration, seekTo],
  );

  const togglePlay = useCallback(() => {
    bump();
    if (playback.ended) {
      player.replay();
      return;
    }
    if (player.playing) player.pause();
    else player.play();
  }, [bump, playback.ended, player]);

  const toggleMute = useCallback(() => {
    bump();
    player.muted = !player.muted;
  }, [bump, player]);

  const toggleCaptions = useCallback(() => {
    bump();
    setSubtitleTrack(playback.subtitleTrack ? null : pickCaptionTrack(playback.subtitleTracks));
  }, [bump, playback.subtitleTrack, playback.subtitleTracks, setSubtitleTrack]);

  const wasPlayingBeforeScrub = useRef(false);
  const scrubStart = useCallback(() => {
    bump();
    wasPlayingBeforeScrub.current = !!player.playing;
    player.pause();
  }, [bump, player]);
  const scrubEnd = useCallback(
    (seconds: number) => {
      bump();
      seekClamped(seconds);
      if (wasPlayingBeforeScrub.current) player.play();
      wasPlayingBeforeScrub.current = false;
    },
    [bump, seekClamped, player],
  );

  const seekBy = useCallback(
    (delta: number) => {
      bump();
      seekClamped(playback.time + delta);
    },
    [bump, seekClamped, playback.time],
  );

  const changeVolume = useCallback(
    (delta: number) => {
      bump();
      player.volume = clamp(finite(player.volume, 1) + delta, 0, 1);
      if (delta > 0 && player.muted) player.muted = false;
    },
    [bump, player],
  );

  // --- Fullscreen ---------------------------------------------------------------
  // Web: the frame itself goes fullscreen, so the custom chrome stays. iPhone
  // Safari cannot do that to an element, so it falls back to the `<video>`'s own
  // fullscreen, with the platform's controls. Native: a `Modal` takes the player.
  const [webFullscreen, setWebFullscreen] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    return subscribeFullscreenChange(() => setWebFullscreen(getFullscreenElement() === frameRef.current));
  }, []);

  const fullscreen = Platform.OS === "web" ? webFullscreen || videoFullscreen : nativeFullscreen;

  const toggleFullscreen = useCallback(() => {
    bump();
    if (Platform.OS !== "web") {
      setNativeFullscreen((open) => !open);
      return;
    }
    if (webFullscreen || videoFullscreen) {
      void exitElementFullscreen();
      return;
    }
    void enterElementFullscreen(frameRef.current).then((entered) => {
      if (!entered) void Promise.resolve(viewRef.current?.enterFullscreen?.()).catch(() => {});
    });
  }, [bump, webFullscreen, videoFullscreen]);

  const closeNativeFullscreen = useCallback(() => setNativeFullscreen(false), []);

  // --- Derived state ---------------------------------------------------------------
  const [posterFailed, setPosterFailed] = useState(false);
  const failed = playback.status === "error" && !retrying;
  // Web's player stays `idle` until the browser can play, so idle while playing is loading.
  const waiting =
    !failed && (retrying || playback.status === "loading" || (playback.status === "idle" && playback.playing));
  const hasPoster = poster !== undefined && poster !== null && poster !== "" && !posterFailed;
  const posterVisible = hasPoster && (!playback.everPlayed || playback.noVideo);
  const label = title ?? accessibilityLabel ?? copy("media.video", "Video");
  const retrySource = source;

  const retryNow = useCallback(() => {
    if (retrySource !== undefined && retrySource !== null) retry(retrySource);
  }, [retry, retrySource]);

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    setHeight(event.nativeEvent.layout.height);
  }, []);

  const stage: Stage = {
    id: testID,
    player,
    controls,
    fit,
    allowsFullscreen,
    allowsPictureInPicture,
    label,
    poster,
    posterVisible,
    onPosterError: () => setPosterFailed(true),
    playback,
    waiting,
    failed,
    errorLabel: title ? `${title}. ${errorFallback}` : errorFallback,
    canRetry: retrySource !== undefined && retrySource !== null,
    retry: retryNow,
    chromeShown,
    chromeOpacity,
    bump,
    setHovered: handleHover,
    compact: width > 0 && width < COMPACT_WIDTH,
    centerSize:
      height > 0 && height < (width > 0 && width < COMPACT_WIDTH ? TINY_HEIGHT_COMPACT : TINY_HEIGHT)
        ? null
        : height > 0 && height < SHORT_HEIGHT
          ? "md"
          : "lg",
    fullscreen,
    viewRef,
    // The web `<video>` raises this on `loadeddata` even for a file with no picture;
    // there the element's own `videoWidth` (see the web effect above) decides.
    onFirstFrame: () => {
      if (Platform.OS !== "web") setNoVideo(false);
    },
    onVideoFullscreenChange: setVideoFullscreen,
    togglePlay,
    toggleMute,
    toggleCaptions,
    toggleFullscreen,
    scrubStart,
    scrubEnd,
  };

  // --- Keyboard (web) and accessibility ------------------------------------------
  const keyboard = useMediaKeyboard(
    custom
      ? {
          togglePlay,
          seekBack: () => seekBy(-KEY_SEEK_SECONDS),
          seekForward: () => seekBy(KEY_SEEK_SECONDS),
          volumeUp: () => changeVolume(VOLUME_STEP),
          volumeDown: () => changeVolume(-VOLUME_STEP),
          toggleMute,
          toggleFullscreen: allowsFullscreen ? toggleFullscreen : undefined,
          // The browser leaves fullscreen on Esc itself; this covers the `<video>` fallback.
          escape: webFullscreen || videoFullscreen ? toggleFullscreen : undefined,
        }
      : {},
  );

  const hasCaptions = playback.subtitleTracks.length > 0;
  const accessibilityActions = custom
    ? [
        { name: "activate" },
        { name: "magicTap" },
        { name: "increment", label: copy("media.seekForward", "Forward 10 seconds") },
        { name: "decrement", label: copy("media.seekBack", "Back 10 seconds") },
        // Children of an accessible frame are not separate screen-reader stops on iOS, so the other controls are actions too.
        { name: "toggleMute", label: playback.muted ? copy("media.unmute", "Unmute") : copy("media.mute", "Mute") },
        ...(hasCaptions
          ? [{ name: "toggleCaptions", label: playback.subtitleTrack ? copy("media.captionsOff", "Turn captions off") : copy("media.captionsOn", "Turn captions on") }]
          : []),
        ...(allowsFullscreen
          ? [{ name: "toggleFullscreen", label: fullscreen ? copy("media.exitFullscreen", "Exit full screen") : copy("media.enterFullscreen", "Enter full screen") }]
          : []),
      ]
    : undefined;

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case "activate":
      case "magicTap":
        togglePlay();
        break;
      case "increment":
        seekBy(ACCESSIBILITY_SEEK_SECONDS);
        break;
      case "decrement":
        seekBy(-ACCESSIBILITY_SEEK_SECONDS);
        break;
      case "toggleMute":
        toggleMute();
        break;
      case "toggleCaptions":
        toggleCaptions();
        break;
      case "toggleFullscreen":
        toggleFullscreen();
        break;
    }
  };

  const frameAccessibility =
    Platform.OS === "web"
      ? custom || controls === "none"
        ? ({ role: "group", accessibilityLabel: label } as const)
        : null
      : custom
        ? {
            accessible: true,
            accessibilityLabel: label,
            accessibilityValue: { text: mediaTimeA11y(playback.time, duration) },
            accessibilityActions,
            onAccessibilityAction: handleAccessibilityAction,
          }
        : controls === "none"
          ? { accessible: true, accessibilityLabel: label }
          : null;

  const layout = fill ? mediaFrameStyle({ fill: true }) : mediaFrameStyle({ aspectRatio: ratio, maxWidth, maxHeight });
  const callerStyle = Array.isArray(style) ? style : [style];

  return (
    <>
      <View
        ref={frameRef}
        testID={testID}
        {...frameAccessibility}
        {...(custom ? keyboard : null)}
        onLayout={custom ? handleLayout : undefined}
        onFocus={custom ? bump : undefined}
        style={[geometry.frame, radiusStyles[radius] ?? radiusStyles.none, layout, ...callerStyle]}
      >
        {nativeFullscreen ? null : <VideoSurface stage={stage} />}
      </View>
      {custom && Platform.OS !== "web" ? (
        <Modal
          visible={nativeFullscreen}
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          supportedOrientations={["portrait", "landscape"]}
          onRequestClose={closeNativeFullscreen}
        >
          <View
            style={geometry.fullscreenRoot}
            testID={`${testID}-fullscreen`}
            {...frameAccessibility}
          >
            <StatusBar barStyle="light-content" />
            <VideoSurface stage={stage} insetsApply />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

interface VideoSurfaceProps {
  stage: Stage;
  /** Inside the fullscreen `Modal`: the bar clears the notch and home indicator. */
  insetsApply?: boolean;
}

/** The picture, its states and the controls: drawn inline or inside the fullscreen `Modal`, from one `Stage`. */
function VideoSurface({ stage, insetsApply = false }: VideoSurfaceProps) {
  const { id, controls, playback } = stage;
  const custom = controls === "custom";
  const insets = useWindowInsets();

  const layers = (
    <>
      <VideoView
        ref={stage.viewRef}
        testID={`${id}-view`}
        player={stage.player}
        style={controls === "native" ? VIDEO_FILL : VIDEO_FILL_PASSIVE}
        contentFit={stage.fit}
        nativeControls={controls === "native"}
        fullscreenOptions={{ enable: controls === "native" && stage.allowsFullscreen }}
        allowsPictureInPicture={stage.allowsPictureInPicture}
        playsInline
        accessibilityLabel={controls === "native" ? stage.label : undefined}
        onFirstFrameRender={stage.onFirstFrame}
        onFullscreenEnter={() => stage.onVideoFullscreenChange(true)}
        onFullscreenExit={() => stage.onVideoFullscreenChange(false)}
      />

      {stage.posterVisible && stage.poster !== undefined ? (
        <View style={[geometry.layer, geometry.boxNone]} testID={`${id}-poster`}>
          <Image
            source={stage.poster}
            alt=""
            fill
            fit={stage.fit}
            transition={0}
            onError={stage.onPosterError}
            testID={`${id}-poster-image`}
          />
          {/* A poster hides the platform's own play button, so it plays instead. */}
          {controls === "native" ? (
            <View style={[geometry.layer, geometry.centered, geometry.boxNone]}>
              <MediaControlButton
                icon="play"
                size="lg"
                accessibilityLabel={copy("media.play", "Play")}
                onPress={() => stage.player.play()}
                testID={`${id}-poster-play`}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {stage.waiting ? (
        <View style={[geometry.layer, geometry.centered, geometry.passive]} testID={`${id}-loading`}>
          <ActivityIndicator size="large" color={palette.white} accessibilityLabel={copy("media.loading", "Loading")} />
        </View>
      ) : null}

      {custom && !stage.failed ? <Chrome stage={stage} insets={insetsApply ? insets : undefined} /> : null}

      {stage.failed ? (
        <View
          style={[geometry.layer, geometry.centered, geometry.error]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={stage.errorLabel}
          testID={`${id}-error`}
        >
          <StyledText semantic="caption" selectable={false} style={geometry.errorText}>
            {copy("media.videoError", "Video failed to load")}
          </StyledText>
          {stage.canRetry ? (
            <MediaControlButton
              icon="rotate-ccw"
              accessibilityLabel={copy("media.retry", "Retry")}
              onPress={stage.retry}
              testID={`${id}-retry`}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );

  // Hover and tap need a `Pressable`; the other modes leave the platform's own
  // controls (or nothing) to take every touch.
  return custom ? (
    <Pressable
      style={geometry.layer}
      onPress={stage.bump}
      onHoverIn={() => stage.setHovered(true)}
      onHoverOut={() => stage.setHovered(false)}
      accessible={false}
      tabIndex={-1}
      testID={`${id}-surface`}
    >
      {layers}
    </Pressable>
  ) : (
    <View style={geometry.layer} testID={`${id}-surface`}>
      {layers}
    </View>
  );
}

interface ChromeProps {
  stage: Stage;
  insets?: { top: number; right: number; bottom: number; left: number };
}

/** The custom controls: a center button, and a bar of play, scrubber, time, mute, captions and fullscreen. */
function Chrome({ stage, insets }: ChromeProps) {
  const { id, playback } = stage;
  const { ended, playing, muted, isLive, duration, time, buffered, subtitleTracks, subtitleTrack } = playback;
  const shown = stage.chromeShown;

  const hiddenFromAssistiveTech = shown
    ? null
    : ({ importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true } as const);

  const playIcon = ended ? "rotate-ccw" : playing ? "pause" : "play";
  const playLabel = ended ? copy("media.replay", "Replay") : playing ? copy("media.pause", "Pause") : copy("media.play", "Play");

  const timeText = isLive
    ? formatMediaTime(Number.POSITIVE_INFINITY)
    : `${formatMediaTime(time, duration)} / ${formatMediaTime(duration > 0 ? duration : Number.NaN)}`;

  const scrubber = (
    <MediaScrubber
      tone="overlay"
      value={time}
      duration={isLive ? Number.POSITIVE_INFINITY : duration}
      buffered={buffered}
      disabled={isLive}
      onScrubStart={stage.scrubStart}
      onScrubEnd={stage.scrubEnd}
      style={stage.compact ? undefined : geometry.grow}
      testID={`${id}-scrubber`}
    />
  );

  const playButton = (
    <MediaControlButton
      size="sm"
      icon={playIcon}
      accessibilityLabel={playLabel}
      onPress={stage.togglePlay}
      testID={`${id}-play`}
    />
  );

  const timeLabel = (
    <StyledText semantic="caption" selectable={false} style={geometry.time} testID={`${id}-time`}>
      {timeText}
    </StyledText>
  );

  const buttons = (
    <View style={geometry.buttons}>
      <MediaControlButton
        size="sm"
        icon={muted ? "volume-x" : "volume-2"}
        selected={muted}
        accessibilityLabel={muted ? copy("media.unmute", "Unmute") : copy("media.mute", "Mute")}
        onPress={stage.toggleMute}
        testID={`${id}-mute`}
      />
      {subtitleTracks.length > 0 ? (
        <MediaControlButton
          size="sm"
          icon="captions"
          selected={subtitleTrack !== null}
          accessibilityLabel={subtitleTrack ? copy("media.captionsOff", "Turn captions off") : copy("media.captionsOn", "Turn captions on")}
          onPress={stage.toggleCaptions}
          testID={`${id}-captions`}
        />
      ) : null}
      {stage.allowsFullscreen ? (
        <MediaControlButton
          size="sm"
          icon={stage.fullscreen ? "minimize" : "maximize"}
          accessibilityLabel={stage.fullscreen ? copy("media.exitFullscreen", "Exit full screen") : copy("media.enterFullscreen", "Enter full screen")}
          onPress={stage.toggleFullscreen}
          testID={`${id}-fullscreen-toggle`}
        />
      ) : null}
    </View>
  );

  return (
    <Animated.View
      {...stateSurfaceProps()}
      {...hiddenFromAssistiveTech}
      style={[geometry.layer, shown ? geometry.boxNone : geometry.passive, { opacity: stage.chromeOpacity }]}
      testID={`${id}-chrome`}
    >
      {stage.waiting || (!stage.fullscreen && stage.centerSize === null) ? null : (
        <View style={[geometry.layer, geometry.centered, geometry.boxNone]}>
          <MediaControlButton
            size={stage.fullscreen ? "lg" : (stage.centerSize ?? "lg")}
            icon={playIcon}
            accessibilityLabel={playLabel}
            onPress={stage.togglePlay}
            testID={`${id}-center`}
          />
        </View>
      )}

      <View
        style={[
          geometry.bar,
          insets && { paddingBottom: insets.bottom + spacing.xs, paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm },
          !insets && { paddingBottom: spacing.xs },
        ]}
        testID={`${id}-bar`}
      >
        {stage.compact ? (
          <>
            {scrubber}
            <View style={geometry.row}>
              {playButton}
              {timeLabel}
              <View style={geometry.spacer} />
              {buttons}
            </View>
          </>
        ) : (
          <View style={geometry.row}>
            {playButton}
            {scrubber}
            {timeLabel}
            {buttons}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
