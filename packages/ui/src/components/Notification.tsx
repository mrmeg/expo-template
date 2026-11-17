import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import type { PanResponderGestureState } from "react-native";
import { useStore } from "zustand";
import { Button, buttonHeights } from "./Button";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { useTheme } from "../hooks/useTheme";
import { useReducedMotion } from "../hooks/useReduceMotion";
import { useShape } from "../hooks/useShape";
import { useWindowInsets } from "../hooks/useWindowInsets";
import { spacing } from "../constants/spacing";
import { durations } from "../constants/motion";
import { StyledText } from "./StyledText";
import type { Theme } from "../constants/colors";
import { translateText } from "../lib/i18n";
import { createThemedStyles } from "../lib/themedStyles";
import { useAnimatedValue } from "../lib/useAnimatedValue";
import { shouldUseNativeDriver } from "../lib/animations";
import { globalUIStore, selectNotificationOffset } from "../state/globalUIStore";
import type { GlobalNotificationType } from "../state/globalUIStore";

const timingIn = { duration: durations.fast, easing: Easing.out(Easing.quad), useNativeDriver: shouldUseNativeDriver };
const timingOut = { duration: durations.instant, easing: Easing.in(Easing.quad), useNativeDriver: shouldUseNativeDriver };

/** Height of the toast's first row: the `sm` Button the action and close use. */
const ROW_HEIGHT = buttonHeights.sm;
/** `label` line height (see StyledText); centers the title in `ROW_HEIGHT`. */
const TITLE_LINE_HEIGHT = 21;
const STATUS_ICON_SIZE = 20;

/** A drag toward the toast's own edge dismisses past this distance or speed. */
const SWIPE_START_DISTANCE = 6;
const SWIPE_DISMISS_DISTANCE = 24;
const SWIPE_DISMISS_VELOCITY = 0.5;

const STATUS_ICONS: Record<GlobalNotificationType, IconName> = {
  error: "circle-exclamation-point",
  success: "circle-check-big",
  warning: "triangle-exclamation-point",
  info: "info",
};

/**
 * Run an action's handler, then dismiss, even when the handler throws. A
 * module-level function because the React Compiler can't compile a
 * `try`/`finally` and would otherwise skip the whole component.
 */
function runThenDismiss(run: () => void, dismiss: () => void): void {
  try {
    run();
  } finally {
    dismiss();
  }
}

/** The title shown when a notification has neither a title nor a message. */
function fallbackTitle(type: GlobalNotificationType | undefined, loading: boolean | undefined) {
  if (loading) return translateText("notification.loading", "Loading");

  switch (type) {
  case "error":
    return translateText("notification.error", "Error");
  case "success":
    return translateText("notification.success", "Success");
  case "warning":
    return translateText("notification.warning", "Warning");
  case "info":
  default:
    return translateText("notification.info", "Info");
  }
}

type GestureState = {
  isBottom: boolean;
  dismiss: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
};

/**
 * Swipe a toast toward its own edge to dismiss it (up for a top banner, down
 * for a bottom toast), moving `dragY` with the finger. Native only, like
 * `Drawer`: web has the close button. Returns the handlers to spread on the
 * toast, or nothing on web.
 *
 * The responder is created once, so it reads the current position and
 * callbacks through a ref (the `MediaScrubber` pattern). That keeps the React
 * Compiler off this hook, which is why it is not inlined in `Notification`.
 */
function useSwipeToDismiss(dragY: Animated.Value, state: GestureState) {
  const live = useRef(state);
  useEffect(() => {
    live.current = state;
  });

  const [responder] = useState(() => {
    if (Platform.OS === "web") return null;

    /** Distance dragged toward the edge; 0 or less means away from it. */
    const towardEdge = (gesture: PanResponderGestureState) =>
      live.current.isBottom ? gesture.dy : -gesture.dy;
    const settle = () => {
      Animated.timing(dragY, { toValue: 0, ...timingIn }).start();
      live.current.resumeTimer();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        towardEdge(gesture) > SWIPE_START_DISTANCE && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        live.current.pauseTimer();
      },
      // Measured from the move that claimed the gesture, so nothing jumps.
      onPanResponderMove: (_event, gesture) => {
        const distance = Math.max(0, towardEdge(gesture));
        dragY.setValue(live.current.isBottom ? distance : -distance);
      },
      onPanResponderRelease: (_event, gesture) => {
        const velocity = live.current.isBottom ? gesture.vy : -gesture.vy;
        if (towardEdge(gesture) > SWIPE_DISMISS_DISTANCE || velocity > SWIPE_DISMISS_VELOCITY) {
          live.current.dismiss();
        } else {
          settle();
        }
      },
      onPanResponderTerminate: settle,
    });
  });

  return responder?.panHandlers;
}

/**
 * Notification
 *
 * Global animated notification component rendered in the root `_layout`.
 * Supports top (banner) and bottom (toast) positions. One compact row: a
 * status icon, the title, an optional message under it, an optional action.
 *
 * A notification that dismisses itself has no close button on iOS and
 * Android: swipe it toward its edge. A persistent one (`duration: 0`,
 * `notify.loading`) and every notification on web shows one.
 *
 * Usage:
 * ```ts
 * // Top notification (default)
 * notify.success("Saved", {
 *   messages: ["Your changes have been saved."],
 *   duration: 3000,
 * });
 *
 * // Bottom toast
 * notify.info("Copied to clipboard", { duration: 2000, position: "bottom" });
 * ```
 */
export const Notification = () => {
  const { theme, getShadowStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  // Window insets, not the provider context alone: a toast host above the
  // app's SafeAreaProvider (or inside a Modal) used to fall back to 20 pt and
  // sit under the Dynamic Island.
  const insets = useWindowInsets();
  // Read the store through zustand's `useStore`, not by calling
  // `globalUIStore()` directly: the React Compiler recognizes hooks by their
  // `use` prefix, so it treated that call as a plain function, cached its
  // result, and skipped the hook on the next render (React error #311).
  const { alert, hide } = useStore(globalUIStore);
  // Bars a layout registered with `useNotificationOffset` (a tab bar, a
  // floating header), measured from the window edge like the insets. Select
  // the stable record and derive the maxima here: a selector that built a new
  // object per call would never satisfy `useSyncExternalStore`'s snapshot check.
  const notificationOffsets = useStore(globalUIStore, (state) => state.notificationOffsets);
  const offset = useMemo(
    () => selectNotificationOffset({ notificationOffsets }),
    [notificationOffsets]
  );
  const styles = themedStyles(theme);
  // A raised panel like `Card`, so it follows the host app's card radius.
  const radius = useShape("card")?.borderRadius ?? spacing.radiusLg;

  // A notification with only a message shows it as the title: "Profile
  // updated" needs no "Success" above it.
  const firstMessage = alert?.messages?.find((item) => item.trim().length > 0);
  const explicitTitle = alert?.title?.trim() ? alert.title : undefined;
  const title = explicitTitle ?? firstMessage ?? fallbackTitle(alert?.type, alert?.loading);
  const message = explicitTitle ? firstMessage : undefined;

  const position = alert?.position ?? "top";
  const isBottom = position === "bottom";

  // Just opacity + translateY — no scale (scale = bouncy feel)
  const opacity = useAnimatedValue(0);
  const translateY = useAnimatedValue(0);
  // The swipe-to-dismiss drag, added to the enter/exit slide.
  const dragY = useAnimatedValue(0);

  const wasVisibleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideNotification = useCallback(() => {
    hide();
  }, [hide]);

  const clearAutoDismissTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const animateOut = useCallback(() => {
    clearAutoDismissTimer();

    if (reduceMotion) {
      opacity.setValue(0);
      hideNotification();
      return;
    }

    const slideTarget = isBottom ? 8 : -8;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        ...timingOut,
      }),
      Animated.timing(translateY, {
        toValue: slideTarget,
        ...timingOut,
      }),
    ]).start(({ finished }) => {
      if (finished) hideNotification();
    });
  }, [clearAutoDismissTimer, reduceMotion, isBottom, opacity, translateY, hideNotification]);

  const handleActionPress = useCallback(() => {
    const action = alert?.action;
    if (!action) return;

    runThenDismiss(() => action.onPress(), animateOut);
  }, [alert?.action, animateOut]);

  const duration = alert?.duration;
  const startAutoDismissTimer = useCallback(() => {
    clearAutoDismissTimer();
    if (!duration) return;
    timerRef.current = setTimeout(() => {
      animateOut();
    }, duration);
  }, [clearAutoDismissTimer, duration, animateOut]);

  const panHandlers = useSwipeToDismiss(dragY, {
    isBottom,
    dismiss: animateOut,
    pauseTimer: clearAutoDismissTimer,
    resumeTimer: startAutoDismissTimer,
  });

  // The enter animation and timer only need the latest callbacks; Effect
  // Events keep them out of the deps so the effect doesn't re-run (and restart
  // the timer) every time their identity changes.
  const onAutoDismissStart = useEffectEvent(() => {
    startAutoDismissTimer();
  });
  const onAnnounce = useEffectEvent(() => {
    // iOS has no live regions: VoiceOver only reads a toast it is told about.
    if (Platform.OS !== "ios" || !alert?.show) return;
    AccessibilityInfo.announceForAccessibility([title, message].filter(Boolean).join(". "));
  });

  useEffect(() => {
    const isNowVisible = alert?.show ?? false;
    const wasVisible = wasVisibleRef.current;

    if (isNowVisible && !wasVisible) {
      const slideFrom = isBottom ? 8 : -8;
      dragY.setValue(0);

      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
      } else {
        opacity.setValue(0);
        translateY.setValue(slideFrom);

        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            ...timingIn,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            ...timingIn,
          }),
        ]).start();
      }
    }

    wasVisibleRef.current = isNowVisible;
    if (!isNowVisible) return;

    onAnnounce();
    // Schedule on every alert change, not just hidden→visible: a notification
    // that replaces a visible one (e.g. loading → success) still needs its
    // auto-dismiss timer. The cleanup clears the previous alert's timer.
    onAutoDismissStart();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // onAnnounce and onAutoDismissStart are Effect Events — intentionally
    // omitted from deps.
  }, [alert, reduceMotion, isBottom, opacity, translateY, dragY]);

  const animatedContainerStyle = {
    opacity,
    transform: [{ translateY: Animated.add(translateY, dragY) }],
  };

  // 8 pt of air past the inset or a registered bar, whichever reaches further;
  // without either, 20 pt from the edge (as before).
  const topPosition = Math.max(insets.top, spacing.smd, offset.top) + spacing.sm;
  const bottomPosition = Math.max(insets.bottom, spacing.smd, offset.bottom) + spacing.sm;

  const type = alert?.type ?? "info";
  const isError = type === "error";
  // Status colors mean status only; info and loading stay neutral.
  const iconColor = {
    error: theme.colors.destructive,
    success: theme.colors.success,
    warning: theme.colors.warning,
    info: theme.colors.popoverForeground,
  }[type];

  const action = alert?.action;
  // Nothing else dismisses a persistent toast, and web has no swipe.
  const showClose = Platform.OS === "web" || !alert?.duration;

  if (!alert?.show) {
    return null;
  }

  return (
    <Animated.View
      testID="ui-notification"
      role={isError ? "alert" : "status"}
      accessibilityLiveRegion={isError ? "assertive" : "polite"}
      style={[
        styles.container,
        isBottom
          ? { bottom: bottomPosition }
          : { top: topPosition },
        animatedContainerStyle,
      ]}
      {...panHandlers}
    >
      <View style={[
        styles.toast,
        { borderRadius: radius },
        !showClose && !action && styles.toastTextOnly,
        getShadowStyle("elevated"),
      ]}>
        <View style={styles.status}>
          {alert.loading ? (
            <ActivityIndicator size="small" color={theme.colors.mutedForeground} />
          ) : (
            <Icon name={STATUS_ICONS[type]} size={STATUS_ICON_SIZE} color={iconColor} />
          )}
        </View>

        <View style={styles.content}>
          <StyledText
            selectable={false}
            semantic="label"
            style={{ color: theme.colors.popoverForeground }}
            numberOfLines={2}
          >
            {title}
          </StyledText>
          {!!message && (
            <StyledText
              selectable={false}
              semantic="caption"
              style={{ color: theme.colors.mutedForeground }}
              numberOfLines={3}
            >
              {message}
            </StyledText>
          )}
        </View>

        {(!!action || showClose) && (
          <View style={styles.actions}>
            {!!action && (
              <Button
                preset="secondary"
                size="sm"
                text={action.label}
                onPress={handleActionPress}
                style={styles.action}
              />
            )}
            {showClose && (
              <IconButton
                icon="x"
                size="sm"
                accessibilityLabel={translateText("notification.dismiss", "Dismiss") ?? "Dismiss"}
                onPress={animateOut}
              />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.screenPadding,
    right: spacing.screenPadding,
    // Toast sits above the overlay layer (dialogs/drawers/dropdowns top out
    // around 52); no need to escalate into the hundreds.
    zIndex: 60,
    alignItems: "center",
  },
  // The overlay surface `Popover` and `Dialog` use: `popover` on a `border`
  // hairline, in both schemes, so an app's `setColors` re-themes it.
  toast: {
    width: "100%",
    maxWidth: 420,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.smd,
    paddingRight: spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.popover,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // Without a trailing button the text gets the same inset on both sides.
  toastTextOnly: {
    paddingRight: spacing.smd,
  },
  // The icon sits on the title's line, however many lines follow.
  status: {
    alignSelf: "flex-start",
    width: STATUS_ICON_SIZE,
    height: ROW_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    paddingVertical: (ROW_HEIGHT - TITLE_LINE_HEIGHT) / 2,
    gap: spacing.xxs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  action: {
    maxWidth: 160,
  },
});

const themedStyles = /*#__PURE__*/ createThemedStyles(createStyles);
