import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { palette } from "../constants/colors";
import { durations } from "../constants/motion";
import { spacing } from "../constants/spacing";
import { useFocusVisible } from "../hooks/useFocusVisible";
import type { MediaKeyboardEvent } from "../hooks/useMediaKeyboard";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useTheme, withAlpha } from "../hooks/useTheme";
import { shouldUseNativeDriver } from "../lib/animations";
import { translateText } from "../lib/i18n";
import { mediaTimeA11y } from "../lib/mediaTime";
import { createThemedStyles } from "../lib/themedStyles";
import { useAnimatedValue } from "../lib/useAnimatedValue";

export type MediaScrubberTone = "overlay" | "default";

export interface MediaScrubberProps {
  /** Current position in seconds. */
  value: number;
  /** Total length in seconds. `0`, `NaN` or `Infinity` (live) draws the track disabled. */
  duration: number;
  /** How far the media is buffered, in seconds. Drawn under the progress fill. */
  buffered?: number;
  /** A drag or tap began. Pause position updates from the player until `onScrubEnd`. */
  onScrubStart?: () => void;
  /** The thumb moved to `seconds`: once on touch-down, then on every move. */
  onScrubChange?: (seconds: number) => void;
  /**
   * The scrub finished at `seconds`: seek there. Also the result of a keyboard
   * or screen-reader adjustment, which has no start or change. Set your own
   * `value` to `seconds` here, or the thumb snaps back to the old `value`
   * until the player reports the new time.
   */
  onScrubEnd?: (seconds: number) => void;
  /** Seconds a keyboard arrow or a screen-reader increment / decrement moves. @default 5 */
  step?: number;
  /**
   * `"overlay"` draws white and translucent white, for controls over video;
   * `"default"` follows the theme, for a themed surface such as an `AudioPlayer`.
   * @default "default"
   */
  tone?: MediaScrubberTone;
  disabled?: boolean;
  /** @default translateText("media.seek", "Seek") */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 12;
const THUMB_GROWN_SCALE = 1.5;
/** Space either side of the track, so a thumb at 0 or the end (and grown) is not cut off by a parent's `overflow`. */
const TRACK_INSET = 10;
const TOUCH_HEIGHT = spacing.touchTarget;

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`). Only the fill widths and the thumb offset, which
 * depend on `value`, are inline.
 */
const styles = /*#__PURE__*/ StyleSheet.create({
  touch: {
    alignSelf: "stretch",
    height: TOUCH_HEIGHT,
    justifyContent: "center",
    borderRadius: spacing.radiusSm,
  },
  rail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: TRACK_INSET,
    right: TRACK_INSET,
    pointerEvents: "none",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (TOUCH_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  thumb: {
    position: "absolute",
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginLeft: -THUMB_SIZE / 2,
    borderRadius: THUMB_SIZE / 2,
  },
  disabled: { opacity: 0.5 },
  overlayTrack: { backgroundColor: withAlpha(palette.white, 0.3) },
  overlayBuffered: { backgroundColor: withAlpha(palette.white, 0.5) },
  overlayProgress: { backgroundColor: palette.white },
  overlayThumb: { backgroundColor: palette.white },
});

const themedStyles = /*#__PURE__*/ createThemedStyles((theme) =>
  StyleSheet.create({
    // Light: `border`, not `muted`, which is a 1.05:1 step on a card (as `Slider` does).
    track: { backgroundColor: theme.dark ? withAlpha(palette.white, 0.1) : theme.colors.border },
    buffered: { backgroundColor: withAlpha(theme.colors.mutedForeground, 0.35) },
    progress: { backgroundColor: theme.colors.accent },
    thumb: { backgroundColor: theme.colors.accent },
  }),
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isUsableDuration = (duration: number) =>
  typeof duration === "number" && Number.isFinite(duration) && duration > 0;

const toNumber = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** A fill's width as a percentage of the track. */
const percent = (seconds: number, duration: number) =>
  `${clamp(isUsableDuration(duration) ? seconds / duration : 0, 0, 1) * 100}%` as const;

/**
 * MediaScrubber
 *
 * A seek bar for media controls: a track, a buffered fill, a progress fill and
 * a thumb that grows while dragging. A tap seeks to that point; a drag moves
 * the thumb under the finger (or mouse, on web) and ignores `value` until you
 * lift, so a playing clip's position updates cannot fight the thumb.
 * `PanResponder` on a 44 pt tall touch area, with the callbacks
 * `onScrubStart` → `onScrubChange(seconds)` → `onScrubEnd(seconds)`.
 *
 * It is not `Slider`, which wraps `@expo/ui` and exposes only
 * `onValueChange`, with no sliding-start or sliding-end events.
 *
 * It is an adjustable element for assistive tech, announcing the position as
 * words ("1 minute 2 seconds of 3 minutes 45 seconds") and offering
 * increment and decrement by `step`, each reported through `onScrubEnd`. On
 * web, focus it and use ←/→ (± `step`) and Home / End. A zero, `NaN` or
 * infinite `duration` (a live stream) draws the track disabled and ignores
 * input.
 *
 * On iOS 26 the native stack's full-width back swipe wins over this
 * `PanResponder`, so a drag pops the screen: set `fullScreenGestureEnabled:
 * false` on the stack screen that shows it (the edge swipe still works).
 *
 * Subpath-only: `@mrmeg/expo-ui/components/MediaScrubber`.
 *
 * ```tsx
 * <MediaScrubber
 *   tone="overlay"
 *   value={currentTime}
 *   duration={duration}
 *   buffered={bufferedTime}
 *   onScrubStart={() => player.pause()}
 *   onScrubEnd={(seconds) => { player.currentTime = seconds; player.play(); }}
 * />
 * ```
 */
export function MediaScrubber({
  value,
  duration,
  buffered,
  onScrubStart,
  onScrubChange,
  onScrubEnd,
  step = 5,
  tone = "default",
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: MediaScrubberProps) {
  const { theme, getFocusRingStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  const { focused, onFocus: showFocusRing, onBlur: hideFocusRing } = useFocusVisible();

  const usable = isUsableDuration(duration);
  const interactive = usable && !disabled;
  const label = accessibilityLabel ?? translateText("media.seek", "Seek") ?? "Seek";

  const [dragSeconds, setDragSeconds] = useState<number | null>(null);
  const dragging = dragSeconds !== null;
  const thumbScale = useAnimatedValue(1);

  // The responder is created once, so everything it reads goes through this ref.
  // `duration` is usually 0 or NaN on the first render, before the media loads.
  const live = useRef({ value, duration, step, interactive, onScrubStart, onScrubChange, onScrubEnd });
  const trackWidth = useRef(0);
  const gesture = useRef({ startX: 0, seconds: 0 });
  useLayoutEffect(() => {
    live.current = { value, duration, step, interactive, onScrubStart, onScrubChange, onScrubEnd };
  });

  const secondsAt = useCallback((x: number) => {
    const width = trackWidth.current;
    const { duration } = live.current;
    // The duration can go unknown or live mid-drag: hold the last position instead of reporting NaN or Infinity.
    if (width <= 0 || !Number.isFinite(duration) || duration <= 0) return gesture.current.seconds;
    return clamp((x - TRACK_INSET) / width, 0, 1) * duration;
  }, []);

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => live.current.interactive && trackWidth.current > 0,
      onMoveShouldSetPanResponder: () => live.current.interactive && trackWidth.current > 0,
      // A parent `ScrollView` must not take a scrub over midway.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        // The rail and its fills ignore pointer events, so `locationX` is
        // relative to this touch area on native and on web.
        const startX = event.nativeEvent.locationX;
        const seconds = secondsAt(startX);
        gesture.current = { startX, seconds };
        setDragSeconds(seconds);
        live.current.onScrubStart?.();
        live.current.onScrubChange?.(seconds);
      },
      onPanResponderMove: (_event: GestureResponderEvent, state: PanResponderGestureState) => {
        const seconds = secondsAt(gesture.current.startX + state.dx);
        gesture.current.seconds = seconds;
        setDragSeconds(seconds);
        live.current.onScrubChange?.(seconds);
      },
      onPanResponderRelease: (_event: GestureResponderEvent, state: PanResponderGestureState) => {
        const seconds = secondsAt(gesture.current.startX + state.dx);
        setDragSeconds(null);
        live.current.onScrubEnd?.(seconds);
      },
      // The system took the touch (a call, a gesture): end where the thumb was
      // so a consumer that paused on start resumes.
      onPanResponderTerminate: () => {
        setDragSeconds(null);
        live.current.onScrubEnd?.(gesture.current.seconds);
      },
    }),
  );

  // Only a change of drag state animates: the thumb already rests at scale 1 on mount.
  const wasDragging = useRef(dragging);
  useEffect(() => {
    if (wasDragging.current === dragging) return;
    wasDragging.current = dragging;
    const toValue = dragging ? THUMB_GROWN_SCALE : 1;
    if (reduceMotion) {
      thumbScale.setValue(toValue);
      return;
    }
    const animation = Animated.timing(thumbScale, {
      toValue,
      duration: durations.fast,
      useNativeDriver: shouldUseNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [dragging, reduceMotion, thumbScale]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = Math.max(0, event.nativeEvent.layout.width - TRACK_INSET * 2);
  }, []);

  /** Seek by `delta` seconds from the current position, clamped to the clip. */
  const nudge = (delta: number | "start" | "end") => {
    if (!interactive) return;
    const next =
      delta === "start" ? 0 : delta === "end" ? duration : clamp(toNumber(value) + delta, 0, duration);
    onScrubEnd?.(next);
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const action = event.nativeEvent.actionName;
    if (action === "increment") nudge(step);
    else if (action === "decrement") nudge(-step);
  };

  const handleKeyDown = (event: MediaKeyboardEvent) => {
    if (!interactive || event.ctrlKey || event.metaKey || event.altKey) return;
    const handled =
      event.key === "ArrowRight" ? () => nudge(step)
      : event.key === "ArrowLeft" ? () => nudge(-step)
      : event.key === "Home" ? () => nudge("start")
      : event.key === "End" ? () => nudge("end")
      : undefined;
    if (!handled) return;
    // Handled here, so a surrounding `useMediaKeyboard` container skips it.
    event.preventDefault?.();
    handled();
  };

  // An unknown or live duration has no end to clamp to, but the position is still spoken.
  const position = clamp(dragSeconds ?? toNumber(value), 0, usable ? duration : Number.POSITIVE_INFINITY);
  const bufferedSeconds = clamp(toNumber(buffered), 0, usable ? duration : 0);
  const themed = themedStyles(theme);
  const overlay = tone === "overlay";

  const valueText = mediaTimeA11y(position, duration);
  const accessibilityValue = usable
    ? { min: 0, max: Math.round(duration), now: Math.round(position), text: valueText }
    : { text: valueText };
  const webProps =
    Platform.OS === "web"
      ? {
          focusable: interactive,
          onKeyDown: handleKeyDown,
          "aria-valuemin": usable ? 0 : undefined,
          "aria-valuemax": usable ? Math.round(duration) : undefined,
          "aria-valuenow": usable ? Math.round(position) : undefined,
          "aria-valuetext": valueText,
          // react-native-web does not map `accessibilityState.disabled` for the
          // slider role, so a live or broken track would read as usable.
          "aria-disabled": interactive ? undefined : true,
        }
      : null;

  return (
    <View
      {...webProps}
      // Always attached: the start and move guards read `interactive`, and a drag
      // that began while interactive must still reach release or terminate if the
      // track goes live, unknown or disabled midway, or the thumb would stay grown.
      {...responder.panHandlers}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={accessibilityValue}
      accessibilityState={{ disabled: !interactive }}
      accessibilityActions={interactive ? [{ name: "increment" }, { name: "decrement" }] : undefined}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={handleLayout}
      onFocus={showFocusRing}
      onBlur={hideFocusRing}
      style={[
        styles.touch,
        !interactive && styles.disabled,
        focused && interactive && getFocusRingStyle(),
        // Spread array styles so the View never receives a nested array (web).
        ...(Array.isArray(style) ? style : [style]),
      ]}
    >
      <View style={styles.rail}>
        <View style={[styles.track, overlay ? styles.overlayTrack : themed.track]}>
          {usable && bufferedSeconds > 0 && (
            <View
              style={[
                styles.fill,
                overlay ? styles.overlayBuffered : themed.buffered,
                { width: percent(bufferedSeconds, duration) },
              ]}
            />
          )}
          {usable && (
            <View
              style={[
                styles.fill,
                overlay ? styles.overlayProgress : themed.progress,
                { width: percent(position, duration) },
              ]}
            />
          )}
        </View>
        {usable && (
          <Animated.View
            style={[
              styles.thumb,
              overlay ? styles.overlayThumb : themed.thumb,
              { left: percent(position, duration), transform: [{ scale: thumbScale }] },
            ]}
          />
        )}
      </View>
    </View>
  );
}
