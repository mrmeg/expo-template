import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  // The viewer sits on black, so its status bar is always light; `StatusBar` (the component) follows the theme.
  StatusBar,
  StyleSheet,
  View,
  findNodeHandle,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
  type ViewStyle,
} from "react-native";
import type { ImageSource } from "expo-image";
import type { VideoSource } from "expo-video";
import { palette } from "../constants/colors";
import { durations } from "../constants/motion";
import { spacing } from "../constants/spacing";
import { useMediaKeyboard } from "../hooks/useMediaKeyboard";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { withAlpha } from "../hooks/useTheme";
import { useWindowInsets } from "../hooks/useWindowInsets";
import { shouldUseNativeDriver } from "../lib/animations";
import { translateText } from "../lib/i18n";
import {
  BACKDROP_FADE_FRACTION,
  BACKDROP_FLOOR,
  IDENTITY_TRANSFORM,
  clampScale,
  clampTransform,
  distanceBetween,
  doubleTapTransform,
  dismissDecision,
  dragIntent,
  isDoubleTap,
  isTap,
  isZoomed,
  midpointOf,
  pinchTransform,
  settleTransform,
  shouldCapturePinch,
  shouldRefuseTermination,
  stepScale,
  zoomAround,
  DOUBLE_TAP_MS,
  type PinchStart,
  type Point,
  type Size,
  type TapSample,
  type ZoomGeometry,
  type ZoomTransform,
} from "../lib/mediaZoom";
import { SUPPORTED_ORIENTATIONS } from "../lib/modalOrientations";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { enterElementFullscreen, exitElementFullscreen, getFullscreenElement } from "../lib/webFullscreen";
import { attachZoomEvents } from "../lib/webZoomEvents";
import { Icon } from "./Icon";
import { Image } from "./Image";
import { MediaControlButton } from "./MediaControlButton";
import { StyledText } from "./StyledText";
import { Video } from "./Video";
import { stateSurfaceProps } from "../lib/stateSurface";

/** One thing the viewer shows. `key` must be unique and stable: it identifies the item across re-renders and deletions. */
export type MediaViewerItem =
  | {
      type: "image";
      key: string;
      source: ImageSource | string | number;
      /** Describes the picture to assistive technology. Pass `""` for a decorative one. */
      alt: string;
      title?: string;
      /** A blurhash, thumbhash or low-resolution URL shown while the picture loads. */
      placeholder?: string;
    }
  | {
      type: "video";
      key: string;
      source: VideoSource;
      title?: string;
      /** Shown on the page until the video plays, and on the page while it is off screen. */
      poster?: ImageSource | string | number;
    };

export interface MediaViewerProps {
  /** What to page through. Build it from your whole list, so swiping spans the library. An empty list renders nothing. */
  items: MediaViewerItem[];
  visible: boolean;
  /** Close button, Esc, Android back, or a swipe down. */
  onClose(): void;
  /** The shown item, when you control it. Clamped to the list. Pair it with `onIndexChange`. */
  index?: number;
  /** The item to open on, when the viewer keeps its own position. Read once per open. @default 0 */
  initialIndex?: number;
  /** Called with the new index when the user pages, and when a change to `items` moves the shown item. */
  onIndexChange?(index: number): void;
  /** Who draws a video page's controls: the kit's (`"custom"`) or the platform's. @default "custom" */
  videoControls?: "custom" | "native";
  /** Pinch, double-tap, wheel and keyboard zoom on images. @default true */
  zoom?: boolean;
  /** Largest zoom, as a multiple of the contain-fit size. @default 4 */
  maxZoom?: number;
  /** The scale a double tap or double click zooms to. @default 2.5 */
  doubleTapZoom?: number;
  /** Drag a page down (or up) to close, on a touch screen. @default true */
  swipeToDismiss?: boolean;
  testID?: string;
}

/** Zoom commands the active page offers the keyboard. */
interface ZoomCommands {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

type ImageItem = Extract<MediaViewerItem, { type: "image" }>;
type VideoItem = Extract<MediaViewerItem, { type: "video" }>;

/** The chrome's scrim: fixed, never a theme color, because it sits over any frame. */
const SCRIM = /*#__PURE__*/ withAlpha(palette.black, 0.45);
const MUTED_TEXT = /*#__PURE__*/ withAlpha(palette.white, 0.72);
/** How many pages each side of the shown one are mounted: the rest are empty slots, so a long list stays light. */
const PAGE_WINDOW = 1;
/** Wait for scrolling to go quiet this long (ms) before reading the page on web, which has no momentum events. */
const WEB_SETTLE_MS = 120;
const DEFAULT_MAX_ZOOM = 4;
const DEFAULT_DOUBLE_TAP_ZOOM = 2.5;

/**
 * Registered at module scope so web server rendering serializes them (see
 * `docs/server-guide.md`). None depend on the theme: the viewer is black.
 */
const styles = /*#__PURE__*/ StyleSheet.create({
  // `userSelect: "none"`: on web a mouse drag that starts a text selection ends the responder's gesture
  // (react-native-web terminates it on `selectionchange`), so a pan or a drag would stop after one move.
  root: { flex: 1, outlineStyle: "none", userSelect: "none" } as unknown as ViewStyle,
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { backgroundColor: palette.black },
  boxNone: { pointerEvents: "box-none" },
  passive: { pointerEvents: "none" },
  page: { overflow: "hidden", backgroundColor: "transparent" },
  topBar: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.smd,
    paddingBottom: spacing.xs,
    backgroundColor: SCRIM,
  },
  slot: { alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
  onDark: { color: palette.white },
  counter: { color: palette.white, fontVariant: ["tabular-nums"], paddingHorizontal: spacing.xs },
  edge: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  poster: { backgroundColor: palette.black, alignItems: "center", justifyContent: "center" },
  playGlyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SCRIM,
  },
  errorFrame: {
    backgroundColor: palette.black,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: { color: MUTED_TEXT, textAlign: "center" },
  // Transparent while loading, not the theme's muted surface: this is a black viewer in both themes.
  clearSurface: { backgroundColor: "transparent" },
});

/** Web only; `scroll-snap-align` is not in React Native's style types. */
const webSnap = /*#__PURE__*/ StyleSheet.create({
  // On each page's slot: one snap point per page, even for the pages that are not mounted.
  slot: { scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle,
  zoomIn: { cursor: "zoom-in" } as unknown as ViewStyle,
  grab: { cursor: "grab" } as unknown as ViewStyle,
  grabbing: { cursor: "grabbing" } as unknown as ViewStyle,
  // Pinch and pan go to the page at rest of the browser's own handling, so the pager keeps its sideways swipe.
  touchRest: { touchAction: "pan-x" } as ViewStyle,
  touchZoomed: { touchAction: "none" } as ViewStyle,
});

function copy(key: string, fallback: string, options?: object): string {
  return translateText(key, fallback, options) ?? fallback;
}

const isWeb = () => Platform.OS === "web";

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  const whole = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(count - 1, Math.max(0, whole));
}

// ============================================================================
// Swipe to dismiss
// ============================================================================

interface DismissDrag {
  /** The page follows the finger. */
  move(dy: number): void;
  /** Released: close past the threshold or at speed, else spring back. */
  release(dy: number, vy: number): void;
  /** The touch was taken away: spring back. */
  cancel(): void;
}

/** One drag shared by every page: the list container's `translateY`, and the backdrop fading with it. */
function useDismissDrag(
  dragY: Animated.Value,
  height: number,
  reducedMotion: boolean,
  onDismiss: () => void,
): DismissDrag {
  const latest = useRef({ height, reducedMotion, onDismiss });
  latest.current = { height, reducedMotion, onDismiss };

  return useMemo<DismissDrag>(() => {
    const restore = () => {
      if (latest.current.reducedMotion) {
        dragY.setValue(0);
        return;
      }
      Animated.spring(dragY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: shouldUseNativeDriver }).start();
    };
    return {
      move: (dy) => dragY.setValue(dy),
      release: (dy, vy) => {
        if (dismissDecision(dy, vy) === "restore") {
          restore();
          return;
        }
        const { height: pageHeight, reducedMotion: reduced, onDismiss: dismiss } = latest.current;
        if (reduced) {
          dismiss();
          dragY.setValue(0);
          return;
        }
        Animated.timing(dragY, {
          toValue: (dy || vy) < 0 ? -pageHeight : pageHeight,
          duration: durations.fast,
          useNativeDriver: shouldUseNativeDriver,
        }).start(() => {
          latest.current.onDismiss();
          dragY.setValue(0);
        });
      },
      cancel: restore,
    };
  }, [dragY]);
}

// ============================================================================
// Pages
// ============================================================================

interface PageCommon {
  width: number;
  height: number;
  active: boolean;
  swipeToDismiss: boolean;
  dismiss: DismissDrag;
  reducedMotion: boolean;
  testID: string;
}

/** Accessibility for a page that is not the shown one: off screen, so out of the reading order. */
function hiddenWhenInactive(active: boolean): Record<string, unknown> | null {
  if (active) return null;
  return {
    importantForAccessibility: "no-hide-descendants",
    accessibilityElementsHidden: true,
    ...(isWeb() && { "aria-hidden": true }),
  };
}

/** What a failed picture shows: a black frame, not the muted surface, so it matches the viewer. */
function ImageError() {
  return (
    <View style={[styles.fill, styles.errorFrame]}>
      <Icon name="image-off" size={spacing.iconMd} color={palette.white} />
      <StyledText semantic="caption" selectable={false} style={styles.errorText}>
        {copy("media.imageError", "Image failed to load")}
      </StyledText>
    </View>
  );
}

/** A video page that is not the shown one: its poster (or black) and a play glyph. No player exists for it. */
function VideoPoster({ item, testID }: { item: VideoItem; testID: string }) {
  const hasPoster = item.poster !== undefined && item.poster !== null && item.poster !== "";
  return (
    <View style={[styles.fill, styles.poster]} testID={`${testID}-poster`}>
      {hasPoster ? <Image source={item.poster ?? null} alt="" fill fit="contain" transition={0} style={styles.clearSurface} /> : null}
      <View style={[styles.playGlyph, styles.passive]} testID={`${testID}-play-glyph`}>
        <Icon name="play" size={28} color={palette.white} />
      </View>
    </View>
  );
}

interface VideoPageProps extends PageCommon {
  item: VideoItem;
  videoControls: "custom" | "native";
}

/** Only the shown page mounts a `Video`; leaving it unmounts the player, which stops playback. */
function VideoPage({ item, active, width, height, videoControls, swipeToDismiss, dismiss, testID }: VideoPageProps) {
  const insets = useWindowInsets();
  const latest = useRef({ swipeToDismiss, dismiss });
  latest.current = { swipeToDismiss, dismiss };

  // A vertical drag that no control claimed closes the viewer. The scrubber and the buttons claim their own
  // touches first (a child wins the bubbling `onMoveShouldSet`), so seeking never drags the page.
  const [responder] = useState(() =>
    Platform.OS === "web"
      ? null
      : PanResponder.create({
          onMoveShouldSetPanResponder: (_event, gesture) =>
            latest.current.swipeToDismiss &&
            gesture.numberActiveTouches === 1 &&
            dragIntent(gesture.dx, gesture.dy) === "vertical",
          onPanResponderTerminationRequest: () => false,
          onPanResponderMove: (_event, gesture) => latest.current.dismiss.move(gesture.dy),
          onPanResponderRelease: (_event, gesture) => latest.current.dismiss.release(gesture.dy, gesture.vy),
          onPanResponderTerminate: () => latest.current.dismiss.cancel(),
        }),
  );

  return (
    <View
      style={[styles.page, { width, height }]}
      {...hiddenWhenInactive(active)}
      {...responder?.panHandlers}
      testID={`${testID}-video-page`}
    >
      {active ? (
        // The page fills the window, but `Video`'s bar sits at its bottom edge: inset it so the scrubber clears the
        // home indicator, and in landscape the notch and the rounded corners. Zero on web and in a plain window.
        <View
          style={[styles.fill, { left: insets.left, right: insets.right, bottom: insets.bottom }]}
          testID={`${testID}-video-inset`}
        >
          <Video
            source={item.source}
            controls={videoControls}
            fill
            fit="contain"
            poster={item.poster}
            allowsFullscreen={false}
            title={item.title}
            testID={`${testID}-video`}
          />
        </View>
      ) : (
        <VideoPoster item={item} testID={testID} />
      )}
    </View>
  );
}

interface TouchBankEntry {
  touchActive?: boolean;
  currentPageX: number;
  currentPageY: number;
}

interface TouchHistory {
  touchBank?: (TouchBankEntry | undefined)[];
  numberActiveTouches?: number;
}

/** The pages the active fingers are on, from the responder system's own touch history (the same on native and web). */
function activeTouches(event: GestureResponderEvent): Point[] {
  const history = (event as unknown as { touchHistory?: TouchHistory }).touchHistory;
  const points: Point[] = [];
  for (const touch of history?.touchBank ?? []) {
    if (touch?.touchActive) points.push({ x: touch.currentPageX, y: touch.currentPageY });
  }
  return points;
}

interface ImagePageProps extends PageCommon {
  item: ImageItem;
  zoom: boolean;
  maxZoom: number;
  doubleTapZoom: number;
  commands: React.RefObject<ZoomCommands | null>;
  onZoomChange(key: string, zoomed: boolean): void;
  onPinchChange(key: string, pinching: boolean): void;
  onTap(): void;
  /** Screen-reader next (`1`) and previous (`-1`). */
  onStep(direction: 1 | -1): void;
  /** Screen-reader escape. */
  onEscape(): void;
}

/**
 * An image page with zoom: the contain-fit picture in a page-sized frame,
 * transformed about its center (`mediaZoom` documents the model).
 *
 * One `PanResponder` takes the touch at its start, like a `Pressable` does:
 * a swipe the pager wants is taken away from it by the platform scroller, a
 * second finger is captured so the pager never gets a pinch, and while
 * pinching or zoomed it refuses to give the touch up. The transform lives in
 * `Animated.Value`s (transform only, so the native driver is allowed) and in
 * a plain mirror the gesture math reads.
 */
function ImagePage(props: ImagePageProps) {
  const { item, active, width, height, zoom, swipeToDismiss, testID } = props;
  const latest = useRef(props);
  latest.current = props;

  const scale = useAnimatedValue(1);
  const translateX = useAnimatedValue(0);
  const translateY = useAnimatedValue(0);
  const [zoomedLocal, setZoomedLocal] = useState(false);
  const [dragging, setDragging] = useState(false);

  const controller = useState(() => {
    const transform = { current: IDENTITY_TRANSFORM as ZoomTransform };
    const natural = { current: null as Size | null };
    const animation = { current: null as Animated.CompositeAnimation | null };
    const zoomedFlag = { current: false };
    const tapTimer = { current: null as ReturnType<typeof setTimeout> | null };
    const lastTap = { current: null as TapSample | null };
    const session = {
      startTime: 0,
      pinch: null as PinchStart | null,
      pinched: false,
      pinching: false,
      dismissing: false,
      intent: undefined as "vertical" | "horizontal" | undefined,
      moved: false,
      base: { transform: IDENTITY_TRANSFORM as ZoomTransform, dx: 0, dy: 0 },
    };

    const geometry = (): ZoomGeometry => ({
      natural: natural.current,
      viewport: { width: latest.current.width, height: latest.current.height },
    });
    const options = () => ({ maxZoom: latest.current.maxZoom, geometry: geometry() });
    const centered = (point: Point): Point => ({
      x: point.x - latest.current.width / 2,
      y: point.y - latest.current.height / 2,
    });

    const reportZoom = (next: ZoomTransform) => {
      const zoomed = isZoomed(next.scale);
      if (zoomed === zoomedFlag.current) return;
      zoomedFlag.current = zoomed;
      setZoomedLocal(zoomed);
      latest.current.onZoomChange(latest.current.item.key, zoomed);
    };

    /** Show `next` now. */
    const publish = (next: ZoomTransform) => {
      transform.current = next;
      scale.setValue(next.scale);
      translateX.setValue(next.x);
      translateY.setValue(next.y);
      reportZoom(next);
    };

    const stop = () => {
      if (!animation.current) return;
      animation.current.stop();
      animation.current = null;
      // The native driver owns the values mid-flight: read where they stopped.
      scale.stopAnimation((value) => (transform.current = { ...transform.current, scale: value }));
      translateX.stopAnimation((value) => (transform.current = { ...transform.current, x: value }));
      translateY.stopAnimation((value) => (transform.current = { ...transform.current, y: value }));
    };

    /** Move to `next` with a spring, or at once under reduced motion. */
    const animateTo = (next: ZoomTransform) => {
      stop();
      if (latest.current.reducedMotion) {
        publish(next);
        return;
      }
      transform.current = next;
      reportZoom(next);
      const spring = (value: Animated.Value, toValue: number) =>
        Animated.spring(value, { toValue, tension: 90, friction: 12, useNativeDriver: shouldUseNativeDriver });
      animation.current = Animated.parallel([
        spring(scale, next.scale),
        spring(translateX, next.x),
        spring(translateY, next.y),
      ]);
      animation.current.start(({ finished }) => {
        if (finished) animation.current = null;
      });
    };

    const clearTapTimer = () => {
      if (tapTimer.current !== null) clearTimeout(tapTimer.current);
      tapTimer.current = null;
    };

    const toggleZoomAt = (focal: Point) => {
      animateTo(
        doubleTapTransform(transform.current, focal, {
          doubleTapZoom: latest.current.doubleTapZoom,
          maxZoom: latest.current.maxZoom,
          geometry: geometry(),
        }),
      );
    };

    const handleTap = (point: Point) => {
      const sample: TapSample = { time: Date.now(), x: point.x, y: point.y };
      const { zoom: zoomOn } = latest.current;
      // A browser reports a double click itself (`dblclick`), at the operating system's own interval.
      if (zoomOn && !isWeb() && isDoubleTap(lastTap.current, sample)) {
        clearTapTimer();
        lastTap.current = null;
        toggleZoomAt(centered(point));
        return;
      }
      lastTap.current = sample;
      clearTapTimer();
      const toggleChrome = () => {
        tapTimer.current = null;
        latest.current.onTap();
      };
      if (zoomOn) tapTimer.current = setTimeout(toggleChrome, DOUBLE_TAP_MS);
      else toggleChrome();
    };

    const setPinching = (pinching: boolean) => {
      if (session.pinching === pinching) return;
      session.pinching = pinching;
      latest.current.onPinchChange(latest.current.item.key, pinching);
    };

    const beginPinch = (points: Point[]) => {
      const [a, b] = points;
      session.pinch = {
        transform: transform.current,
        distance: distanceBetween(a, b),
        midpoint: centered(midpointOf(a, b)),
      };
      session.pinched = true;
      if (session.dismissing) {
        session.dismissing = false;
        latest.current.dismiss.cancel();
      }
      setPinching(true);
    };

    const endSession = () => {
      session.pinch = null;
      session.pinched = false;
      session.dismissing = false;
      session.intent = undefined;
      session.moved = false;
      setPinching(false);
      setDragging(false);
    };

    const settle = () => {
      const next = settleTransform(transform.current, options());
      if (next.scale !== transform.current.scale || next.x !== transform.current.x || next.y !== transform.current.y) {
        animateTo(next);
      }
    };

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: (event) =>
        shouldCapturePinch(activeTouches(event).length, latest.current.zoom),
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (event) =>
        shouldCapturePinch(activeTouches(event).length, latest.current.zoom),
      onPanResponderTerminationRequest: () =>
        !shouldRefuseTermination(session.pinching, transform.current.scale, session.dismissing),

      onPanResponderGrant: (event, gesture) => {
        stop();
        session.startTime = Date.now();
        session.base = { transform: transform.current, dx: gesture.dx, dy: gesture.dy };
        session.pinch = null;
        session.pinched = false;
        session.intent = undefined;
        session.moved = false;
        setDragging(true);
        const points = activeTouches(event);
        if (latest.current.zoom && points.length >= 2) beginPinch(points);
      },

      onPanResponderMove: (event, gesture) => {
        const points = activeTouches(event);
        if (latest.current.zoom && points.length >= 2) {
          session.moved = true;
          if (!session.pinch) {
            beginPinch(points);
            return;
          }
          const [a, b] = points;
          publish(
            pinchTransform(
              session.pinch,
              { distance: distanceBetween(a, b), midpoint: centered(midpointOf(a, b)) },
              options(),
            ),
          );
          return;
        }

        if (session.pinch) {
          // Down to one finger: carry on as a pan from here.
          session.pinch = null;
          session.base = { transform: transform.current, dx: gesture.dx, dy: gesture.dy };
        }

        const dx = gesture.dx - session.base.dx;
        const dy = gesture.dy - session.base.dy;
        if (Math.abs(gesture.dx) >= 4 || Math.abs(gesture.dy) >= 4) session.moved = true;

        if (isZoomed(transform.current.scale)) {
          publish(
            clampTransform(
              { scale: transform.current.scale, x: session.base.transform.x + dx, y: session.base.transform.y + dy },
              geometry(),
            ),
          );
          return;
        }
        if (!latest.current.swipeToDismiss || Platform.OS === "web" || session.pinched) return;
        session.intent = session.intent ?? dragIntent(gesture.dx, gesture.dy);
        if (session.intent === "vertical") {
          session.dismissing = true;
          latest.current.dismiss.move(gesture.dy);
        }
      },

      onPanResponderRelease: (_event, gesture: PanResponderGestureState) => {
        const elapsed = Date.now() - session.startTime;
        const wasDismissing = session.dismissing;
        const wasTap = !session.pinched && !session.moved && isTap(gesture.dx, gesture.dy, elapsed);
        const pinched = session.pinched;
        endSession();
        if (wasDismissing) {
          latest.current.dismiss.release(gesture.dy, gesture.vy);
          return;
        }
        if (pinched) {
          settle();
          return;
        }
        if (wasTap) handleTap({ x: gesture.x0, y: gesture.y0 });
      },

      onPanResponderTerminate: () => {
        const wasDismissing = session.dismissing;
        const pinched = session.pinched;
        endSession();
        if (wasDismissing) latest.current.dismiss.cancel();
        if (pinched) settle();
      },
    });

    const commands: ZoomCommands = {
      zoomIn: () => {
        const next = stepScale(transform.current.scale, 1, latest.current.maxZoom);
        animateTo(zoomAround(transform.current, next, { x: 0, y: 0 }, geometry()));
      },
      zoomOut: () => {
        const next = stepScale(transform.current.scale, -1, latest.current.maxZoom);
        animateTo(next === 1 ? IDENTITY_TRANSFORM : zoomAround(transform.current, next, { x: 0, y: 0 }, geometry()));
      },
      reset: () => animateTo(IDENTITY_TRANSFORM),
    };

    return {
      responder,
      commands,
      natural,
      transform,
      /** Back to rest, without animation: a page that is no longer shown, or a viewport that changed. */
      rest: () => {
        stop();
        clearTapTimer();
        lastTap.current = null;
        publish(IDENTITY_TRANSFORM);
      },
      clearTapTimer,
      /** The picture decoded: bounds follow its real shape. */
      loaded: (size: Size) => {
        natural.current = size;
        if (isZoomed(transform.current.scale)) publish(clampTransform(transform.current, geometry()));
      },
      /**
       * A wheel with Ctrl or Cmd (a trackpad pinch): zoom around the cursor, continuously. Only the shown page
       * answers: a neighbor still sliding past under the cursor would otherwise be left zoomed behind its back.
       */
      wheel: (factor: number, focal: Point) => {
        if (!latest.current.active) return;
        stop();
        const next = clampScale(transform.current.scale * factor, latest.current.maxZoom);
        publish(next === 1 ? IDENTITY_TRANSFORM : zoomAround(transform.current, next, focal, geometry()));
      },
      doubleClick: (focal: Point) => {
        if (latest.current.active) toggleZoomAt(focal);
      },
    };
  })[0];

  // Only the shown page is zoomable: leaving it puts it back at rest, and a changed viewport (rotation, resize)
  // would leave the old bounds wrong, so it does too.
  useEffect(() => {
    if (!active) controller.rest();
  }, [active, controller]);
  useEffect(() => {
    controller.rest();
  }, [width, height, controller]);

  // The active page answers the keyboard.
  useEffect(() => {
    if (!active || !zoom) return;
    const mine = controller.commands;
    props.commands.current = mine;
    return () => {
      if (props.commands.current === mine) props.commands.current = null;
    };
    // `props.commands` is a stable ref object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, zoom, controller]);

  useEffect(() => () => controller.clearTapTimer(), [controller]);

  const attachWebZoom = useCallback(
    (node: unknown) =>
      attachZoomEvents(node, { onWheelZoom: controller.wheel, onDoubleClick: controller.doubleClick }),
    [controller],
  );

  const nativeAccessibility = Platform.OS !== "web";
  const described = item.alt.trim() !== "";
  const accessibilityActions = nativeAccessibility
    ? [
        { name: "increment", label: copy("media.next", "Next") },
        { name: "decrement", label: copy("media.previous", "Previous") },
        { name: "escape", label: copy("media.close", "Close") },
      ]
    : undefined;

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case "increment":
        latest.current.onStep(1);
        break;
      case "decrement":
        latest.current.onStep(-1);
        break;
      case "escape":
        latest.current.onEscape();
        break;
    }
  };

  const webCursor = zoom ? (zoomedLocal ? (dragging ? webSnap.grabbing : webSnap.grab) : webSnap.zoomIn) : null;
  const webTouch = zoom ? (zoomedLocal ? webSnap.touchZoomed : webSnap.touchRest) : null;

  return (
    <View
      ref={zoom && isWeb() ? attachWebZoom : undefined}
      style={[styles.page, { width, height }, webCursor, webTouch]}
      {...hiddenWhenInactive(active)}
      {...controller.responder.panHandlers}
      {...(nativeAccessibility
        ? {
            accessible: true,
            accessibilityRole: "image" as const,
            accessibilityLabel: described ? item.alt : undefined,
            accessibilityActions,
            onAccessibilityAction: handleAccessibilityAction,
          }
        : null)}
      testID={`${testID}-image-page`}
    >
      <Animated.View
        {...stateSurfaceProps()}
        style={[
          styles.fill,
          { transform: [{ translateX }, { translateY }, { scale }] },
        ]}
        testID={`${testID}-zoom`}
      >
        <Image
          source={item.source}
          alt={nativeAccessibility ? "" : item.alt}
          fill
          fit="contain"
          placeholder={item.placeholder}
          recyclingKey={item.key}
          fallback={<ImageError />}
          style={styles.clearSurface}
          onLoad={controller.loaded}
          testID={`${testID}-image`}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// The viewer
// ============================================================================

/**
 * MediaViewer
 *
 * A full-screen lightbox for a list of images and videos, on iOS, Android and
 * web. Import it from `@mrmeg/expo-ui/components/MediaViewer`; it is not in the
 * barrel, and needs the optional `expo-image` and `expo-video` peers.
 *
 * Build `items` from your whole list, so swiping spans the library, and open
 * it at the tapped one:
 *
 * ```tsx
 * const [open, setOpen] = useState<number | null>(null);
 * const items = media.map((m) =>
 *   m.kind === "video"
 *     ? { type: "video", key: m.id, source: m.url, poster: m.thumbnail, title: m.name }
 *     : { type: "image", key: m.id, source: m.url, alt: m.description, title: m.name },
 * );
 * <MediaViewer items={items} visible={open !== null} initialIndex={open ?? 0} onClose={() => setOpen(null)} />
 * ```
 *
 * - **Position.** Uncontrolled by default (`initialIndex`, read once per
 *   open); pass `index` and `onIndexChange` to control it. An index past the
 *   list is clamped. When `items` changes while open, the viewer stays on the
 *   same `key` if it is still there (an item was deleted elsewhere), else it
 *   clamps, and `onIndexChange` reports the move.
 * - **Paging.** Swipe, arrow keys, or the edge buttons (always on web; on
 *   native only while a screen reader is on). Only the shown page mounts a
 *   `Video`; the others show their poster and a play glyph, so paging away
 *   stops playback.
 * - **Zoom** (images). Pinch, double-tap, `Ctrl`/`Cmd` + wheel (a trackpad
 *   pinch on Chrome, Edge and Firefox) around the cursor, double-click, and
 *   `+` `-` `0`, up to `maxZoom`. One finger or the mouse pans a zoomed image,
 *   never past its edge. Paging is off while zoomed, and a page change resets
 *   zoom. A tap toggles the chrome.
 * - **Close.** The close button, Esc (it leaves zoom first), Android back, or
 *   on a touch screen a swipe down, which fades the backdrop with the drag.
 * - **Web keys.** ←/→ page, `+`/`=`/`-`/`0` zoom, `F` full screen. A custom
 *   video that has focus keeps its own ←/→ for seeking.
 * - **Accessibility.** The close button is focused on open, each page change
 *   is announced as "title, 2 of 5", the root is a modal view, image pages
 *   carry `alt`, and on native an image page offers `increment`, `decrement`
 *   and `escape`.
 *
 * Copy goes through `translateText`: `media.close`, `media.counter` (with
 * `n` and `total`), `media.previous`, `media.next`, `media.imageError`.
 */
export function MediaViewer(props: MediaViewerProps) {
  const { items, visible, onClose } = props;
  const reducedMotion = useReducedMotion();
  const closeRequest = useRef<(() => void) | null>(null);

  if (items.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      statusBarTranslucent
      supportedOrientations={SUPPORTED_ORIENTATIONS}
      onRequestClose={() => (closeRequest.current ?? onClose)()}
    >
      {visible ? <ViewerBody {...props} closeRequestRef={closeRequest} /> : null}
    </Modal>
  );
}

interface ViewerBodyProps extends Omit<MediaViewerProps, "visible"> {
  /** The body tells the `Modal` what a close request (Android back, web Esc) means right now. */
  closeRequestRef: React.RefObject<(() => void) | null>;
}

function toggleKey(set: ReadonlySet<string>, key: string, on: boolean): ReadonlySet<string> {
  if (set.has(key) === on) return set;
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

function ViewerBody({
  items,
  onClose,
  index,
  initialIndex = 0,
  onIndexChange,
  videoControls = "custom",
  zoom = true,
  maxZoom = DEFAULT_MAX_ZOOM,
  doubleTapZoom = DEFAULT_DOUBLE_TAP_ZOOM,
  swipeToDismiss = true,
  testID = "media-viewer",
  closeRequestRef,
}: ViewerBodyProps) {
  const reducedMotion = useReducedMotion();
  const insets = useWindowInsets();
  const count = items.length;
  const controlled = index !== undefined;

  // --- Measurement ------------------------------------------------------------
  // The root's own layout, not the window's: it follows rotation and a resized browser window.
  const [size, setSize] = useState<Size | null>(null);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    if (!(nextWidth > 0 && nextHeight > 0)) return;
    setSize((current) =>
      current && Math.abs(current.width - nextWidth) < 0.5 && Math.abs(current.height - nextHeight) < 0.5
        ? current
        : { width: nextWidth, height: nextHeight },
    );
  }, []);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  // --- Position ---------------------------------------------------------------
  // Uncontrolled position is remembered by key as well as index, so an item deleted elsewhere
  // does not move the viewer onto its neighbor: the same key wins when it is still there.
  const [nav, setNav] = useState(() => {
    const first = clampIndex(index ?? initialIndex, count);
    return { index: first, key: items[first].key };
  });
  const keyedIndex = controlled ? -1 : items.findIndex((item) => item.key === nav.key);
  const activeIndex =
    index !== undefined ? clampIndex(index, count) : keyedIndex >= 0 ? keyedIndex : clampIndex(nav.index, count);
  const activeItem = items[activeIndex];
  if (!controlled && (nav.index !== activeIndex || nav.key !== activeItem.key)) {
    setNav({ index: activeIndex, key: activeItem.key });
  }

  const latest = useRef({ items, count, controlled, onIndexChange, onClose, width });
  latest.current = { items, count, controlled, onIndexChange, onClose, width };
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  // What the parent was last told, so a move it caused itself is not reported back to it.
  const reported = useRef(index ?? activeIndex);
  useEffect(() => {
    if (reported.current === activeIndex) return;
    reported.current = activeIndex;
    if (index === undefined || activeIndex !== index) onIndexChange?.(activeIndex);
  });

  const commitIndex = useCallback((next: number) => {
    const { count: total, items: list, controlled: isControlled, onIndexChange: notify } = latest.current;
    const clamped = clampIndex(next, total);
    if (clamped === activeRef.current) return;
    activeRef.current = clamped;
    reported.current = clamped;
    if (!isControlled) setNav({ index: clamped, key: list[clamped].key });
    notify?.(clamped);
  }, []);

  // --- Paging -----------------------------------------------------------------
  // A horizontal `ScrollView` with one slot per item and only the shown page and its neighbors mounted. Not a
  // `FlatList`: on web its window stopped following the scroll after a quick run of arrow keys, leaving the shown
  // page blank until the next scroll. Mounting by the shown index is deterministic.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  /** The page the scroller is showing, as far as the viewer knows: scrolling it, or the last programmatic scroll. */
  const pagePosition = useRef(activeIndex);
  const lastWidth = useRef<number | null>(null);
  const animateNext = useRef(false);
  /** iOS places the first layout from this; Android and web do it in the effect below. */
  const initialOffset = useRef<number | null>(null);
  if (initialOffset.current === null && width > 0) initialOffset.current = activeIndex * width;

  const goTo = useCallback(
    (next: number) => {
      animateNext.current = true;
      commitIndex(next);
    },
    [commitIndex],
  );

  // The first layout goes to the shown page. After that, a move the scroller did not make itself (a button, a
  // key, `index`, a changed `items`) scrolls it there; so does a new width (rotation), which keeps the current
  // page under the new page size.
  useEffect(() => {
    if (width <= 0) return;
    const first = lastWidth.current === null;
    const widthChanged = !first && lastWidth.current !== width;
    lastWidth.current = width;
    if (!first && !widthChanged && pagePosition.current === activeIndex) return;
    const animated = !first && animateNext.current && !reducedMotion && !widthChanged;
    animateNext.current = false;
    pagePosition.current = activeIndex;
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated });
  }, [activeIndex, width, reducedMotion]);

  const settle = useCallback(
    (offsetX: number) => {
      const pageWidth = latest.current.width;
      if (!(pageWidth > 0)) return;
      const next = clampIndex(Math.round(offsetX / pageWidth), latest.current.count);
      pagePosition.current = next;
      commitIndex(next);
    },
    [commitIndex],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => settle(event.nativeEvent.contentOffset.x),
    [settle],
  );
  // A drag that lets go with the content at rest is not followed by momentum.
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(event.nativeEvent.velocity?.x ?? 0) > 0.01) return;
      settle(event.nativeEvent.contentOffset.x);
    },
    [settle],
  );
  // react-native-web emits no momentum events: read the page once scrolling goes quiet.
  const webTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWebScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      if (webTimer.current !== null) clearTimeout(webTimer.current);
      webTimer.current = setTimeout(() => {
        webTimer.current = null;
        settle(offsetX);
      }, WEB_SETTLE_MS);
    },
    [settle],
  );
  useEffect(
    () => () => {
      if (webTimer.current !== null) clearTimeout(webTimer.current);
    },
    [],
  );

  // --- Zoom, pinch and drag state ------------------------------------------------
  const [zoomedKeys, setZoomedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [pinchingKeys, setPinchingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const handleZoomChange = useCallback(
    (key: string, zoomed: boolean) => setZoomedKeys((current) => toggleKey(current, key, zoomed)),
    [],
  );
  const handlePinchChange = useCallback(
    (key: string, pinching: boolean) => setPinchingKeys((current) => toggleKey(current, key, pinching)),
    [],
  );
  const zoomed = zoomedKeys.has(activeItem.key);
  const pinching = pinchingKeys.has(activeItem.key);
  const zoomedRef = useRef(zoomed);
  zoomedRef.current = zoomed;
  const commands = useRef<ZoomCommands | null>(null);

  const dragY = useAnimatedValue(0);
  const dismiss = useDismissDrag(dragY, height, reducedMotion, onClose);
  const fadeRange = Math.max(height * BACKDROP_FADE_FRACTION, 1);
  const backdropOpacity = useMemo(
    () =>
      dragY.interpolate({
        inputRange: [-fadeRange, 0, fadeRange],
        outputRange: [BACKDROP_FLOOR, 1, BACKDROP_FLOOR],
        extrapolate: "clamp",
      }),
    [dragY, fadeRange],
  );

  // --- Chrome -----------------------------------------------------------------
  const [chromeVisible, setChromeVisible] = useState(true);
  const toggleChrome = useCallback(() => setChromeVisible((visible) => !visible), []);
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    // react-native-web reports a screen reader as always on, which would pin the chrome open.
    if (isWeb()) return;
    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (!cancelled) setScreenReader(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  // A video page keeps its top bar (and the video its own controls); a screen reader keeps everything.
  const chromeShown = chromeVisible || activeItem.type === "video" || screenReader;
  const chromeOpacity = useAnimatedValue(1);
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

  // --- Closing ----------------------------------------------------------------
  // react-native-web's `Modal` closes on the document's Esc `keyup`, so Esc has exactly one path on web:
  // here. It leaves zoom first and closes the second time. Android back closes at once.
  closeRequestRef.current = isWeb()
    ? () => {
        if (zoomedRef.current) commands.current?.reset();
        else onClose();
      }
    : onClose;
  useEffect(
    () => () => {
      closeRequestRef.current = null;
    },
    [closeRequestRef],
  );

  // --- Keyboard (web) ---------------------------------------------------------
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const toggleFullscreen = useCallback(() => {
    const node = rootRef.current;
    if (getFullscreenElement() === node) void exitElementFullscreen();
    else void enterElementFullscreen(node);
  }, []);
  useEffect(() => {
    if (!isWeb()) return;
    const node = rootRef.current;
    return () => {
      // The viewer going away must not leave the browser fullscreen on nothing.
      if (node && getFullscreenElement() === node) void exitElementFullscreen();
    };
  }, []);

  const keyboard = useMediaKeyboard({
    previous: count > 1 ? () => goTo(activeRef.current - 1) : undefined,
    next: count > 1 ? () => goTo(activeRef.current + 1) : undefined,
    zoomIn: zoom ? () => commands.current?.zoomIn() : undefined,
    zoomOut: zoom ? () => commands.current?.zoomOut() : undefined,
    zoomReset: zoom ? () => commands.current?.reset() : undefined,
    toggleFullscreen: isWeb() ? toggleFullscreen : undefined,
  });

  // --- Accessibility ------------------------------------------------------------
  const closeRef = useRef<unknown>(null);
  useEffect(() => {
    if (isWeb()) {
      (closeRef.current as { focus?: () => void } | null)?.focus?.();
      return;
    }
    const timer = setTimeout(() => {
      const handle = findNodeHandle(closeRef.current as Parameters<typeof findNodeHandle>[0]);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const counter = copy("media.counter", `${activeIndex + 1} of ${count}`, { n: activeIndex + 1, total: count });
  const announcement = activeItem.title ? `${activeItem.title}, ${counter}` : counter;
  const announced = useRef(activeIndex);
  useEffect(() => {
    if (announced.current === activeIndex) return;
    announced.current = activeIndex;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [activeIndex, announcement]);

  const handleStep = useCallback((direction: 1 | -1) => goTo(activeRef.current + direction), [goTo]);
  const handleEscape = useCallback(() => latest.current.onClose(), []);

  // --- Pages ------------------------------------------------------------------
  const renderPage = (item: MediaViewerItem, pageIndex: number) => {
    const common = {
      width,
      height,
      active: pageIndex === activeIndex,
      swipeToDismiss,
      dismiss,
      reducedMotion,
      testID,
    };
    return item.type === "image" ? (
      <ImagePage
        {...common}
        item={item}
        zoom={zoom}
        maxZoom={maxZoom}
        doubleTapZoom={doubleTapZoom}
        commands={commands}
        onZoomChange={handleZoomChange}
        onPinchChange={handlePinchChange}
        onTap={toggleChrome}
        onStep={handleStep}
        onEscape={handleEscape}
      />
    ) : (
      <VideoPage {...common} item={item} videoControls={videoControls} />
    );
  };

  const webScroll = isWeb();
  const showArrows = count > 1 && (isWeb() || screenReader);
  const hiddenWhenChromeHidden = chromeShown
    ? null
    : ({ importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true } as const);
  // Spread so the ref reaches the button's `Pressable` (React 19 passes `ref` as a prop; the button forwards its rest props).
  const closeRefProps = { ref: closeRef } as unknown as object;

  return (
    <View
      ref={rootRef}
      style={styles.root}
      onLayout={handleLayout}
      accessibilityViewIsModal
      onAccessibilityEscape={handleEscape}
      {...keyboard}
      testID={testID}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View {...stateSurfaceProps()} style={[styles.fill, styles.backdrop, styles.passive, { opacity: backdropOpacity }]} />

      {size ? (
        <Animated.View {...stateSurfaceProps()} style={[styles.fill, { transform: [{ translateY: dragY }] }]}>
          <ScrollView
            ref={scrollRef}
            testID={`${testID}-list`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            overScrollMode="never"
            contentOffset={{ x: initialOffset.current ?? 0, y: 0 }}
            scrollEnabled={!zoomed && !pinching}
            {...(webScroll
              ? { scrollEventThrottle: 16, onScroll: handleWebScroll }
              : { onMomentumScrollEnd: handleMomentumEnd, onScrollEndDrag: handleScrollEndDrag })}
          >
            {items.map((item, pageIndex) => (
              <View
                key={item.key}
                style={[{ width, height }, isWeb() && webSnap.slot]}
                testID={`${testID}-slot-${pageIndex}`}
              >
                {Math.abs(pageIndex - activeIndex) <= PAGE_WINDOW ? renderPage(item, pageIndex) : null}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      <Animated.View
        {...stateSurfaceProps()}
        {...hiddenWhenChromeHidden}
        style={[styles.fill, chromeShown ? styles.boxNone : styles.passive, { opacity: chromeOpacity }]}
        testID={`${testID}-chrome`}
      >
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + spacing.xs, paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm },
          ]}
          testID={`${testID}-top-bar`}
        >
          <View style={styles.slot}>
            <MediaControlButton
              {...closeRefProps}
              icon="x"
              accessibilityLabel={copy("media.close", "Close")}
              onPress={onClose}
              testID={`${testID}-close`}
            />
          </View>
          <View style={styles.grow}>
            {activeItem.title ? (
              <StyledText semantic="label" numberOfLines={1} selectable={false} style={styles.onDark} testID={`${testID}-title`}>
                {activeItem.title}
              </StyledText>
            ) : null}
          </View>
          {count > 1 ? (
            <StyledText semantic="caption" selectable={false} style={styles.counter} testID={`${testID}-counter`}>
              {counter}
            </StyledText>
          ) : null}
        </View>

        {showArrows && activeIndex > 0 ? (
          <View style={[styles.edge, styles.boxNone, { left: insets.left + spacing.sm }]}>
            <MediaControlButton
              icon="chevron-left"
              accessibilityLabel={copy("media.previous", "Previous")}
              onPress={() => goTo(activeIndex - 1)}
              testID={`${testID}-previous`}
            />
          </View>
        ) : null}
        {showArrows && activeIndex < count - 1 ? (
          <View style={[styles.edge, styles.boxNone, { right: insets.right + spacing.sm }]}>
            <MediaControlButton
              icon="chevron-right"
              accessibilityLabel={copy("media.next", "Next")}
              onPress={() => goTo(activeIndex + 1)}
              testID={`${testID}-next`}
            />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
