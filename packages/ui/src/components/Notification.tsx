import React, { useMemo, useCallback, useContext, useEffect, useRef } from "react";
import { StyleSheet, View, ActivityIndicator, Pressable, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useReducedMotion,
  Easing,
} from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { fontFamilies } from "../constants/fonts";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";
import { StyledText } from "./StyledText";
import type { Theme } from "../constants/colors";
import { translateText } from "../lib/i18n";
import { globalUIStore } from "../state/globalUIStore";

/**
 * Notification
 *
 * Global animated notification component rendered in the root `_layout`.
 * Supports top (banner) and bottom (toast) positions.
 *
 * Usage:
 * ```ts
 * // Top notification (default)
 * globalUIStore.getState().show({
 *   type: "success",
 *   title: "Saved",
 *   messages: ["Your changes have been saved."],
 *   duration: 3000,
 * });
 *
 * // Bottom toast
 * globalUIStore.getState().show({
 *   type: "info",
 *   title: "Copied to clipboard",
 *   duration: 2000,
 *   position: "bottom",
 * });
 * ```
 */
export const Notification = () => {
  const { theme, getShadowStyle } = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useContext(SafeAreaInsetsContext);
  const { alert, hide } = globalUIStore();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const position = alert?.position ?? "top";
  const isBottom = position === "bottom";

  // Just opacity + translateY — no scale (scale = bouncy feel)
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  const wasVisibleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideNotification = useCallback(() => {
    hide();
  }, [hide]);

  const timingIn = { duration: 150, easing: Easing.out(Easing.quad) };
  const timingOut = { duration: 100, easing: Easing.in(Easing.quad) };

  const animateOut = useCallback(() => {
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 0 });
      hideNotification();
      return;
    }

    const slideTarget = isBottom ? 8 : -8;
    opacity.value = withTiming(0, timingOut);
    translateY.value = withTiming(slideTarget, timingOut, (finished) => {
      if (finished) runOnJS(hideNotification)();
    });
  }, [reduceMotion, isBottom, opacity, translateY, hideNotification]);

  useEffect(() => {
    const isNowVisible = alert?.show ?? false;
    const wasVisible = wasVisibleRef.current;

    if (isNowVisible && !wasVisible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const slideFrom = isBottom ? 8 : -8;

      if (reduceMotion) {
        opacity.value = withTiming(1, { duration: 0 });
        translateY.value = withTiming(0, { duration: 0 });
      } else {
        opacity.value = 0;
        translateY.value = slideFrom;

        opacity.value = withTiming(1, timingIn);
        translateY.value = withTiming(0, timingIn);
      }
    }

    wasVisibleRef.current = isNowVisible;

    if (isNowVisible && !wasVisible && alert?.duration) {
      timerRef.current = setTimeout(() => {
        animateOut();
      }, alert.duration);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [alert, reduceMotion, isBottom, opacity, translateY, animateOut]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const topPosition = insets?.top ? insets.top : 20;
  const bottomPosition = insets?.bottom ? insets.bottom : 20;

  const getIconProps = (): { icon: IconName; color: string; bgColor: string } => {
    switch (alert?.type) {
    case "error":
      return {
        icon: "alert-circle",
        color: theme.colors.destructive,
        bgColor: theme.colors.destructive + "15",
      };
    case "success":
      return {
        icon: "check-circle",
        color: theme.colors.success,
        bgColor: theme.colors.success + "15",
      };
    case "warning":
      return {
        icon: "alert-triangle",
        color: theme.colors.warning,
        bgColor: theme.colors.warning + "15",
      };
    case "info":
    default:
      return {
        icon: "info",
        color: theme.colors.accent,
        bgColor: theme.colors.accent + "15",
      };
    }
  };

  const getTitle = (message?: string) => {
    if (alert?.title?.trim()) return alert.title;

    if (alert?.loading) {
      return translateText("notification.loading", "Loading");
    }

    switch (alert?.type) {
    case "error":
      return translateText("notification.error", "Error");
    case "success":
      return translateText("notification.success", "Success");
    case "warning":
      return translateText("notification.warning", "Warning");
    case "info":
      return message ? "" : translateText("notification.info", "Info");
    default:
      return "";
    }
  };

  const { icon, color: iconColor, bgColor: iconBgColor } = getIconProps();
  const message = alert?.messages?.find((item) => item.trim().length > 0);
  const title = getTitle(message);
  const hasMessage = !!message;

  if (!alert?.show) {
    return null;
  }

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents={alert?.show ? "auto" : "none"}
      style={[
        styles.container,
        isBottom
          ? { bottom: bottomPosition }
          : { top: topPosition },
        animatedContainerStyle,
        !alert?.show && { opacity: 0 },
      ]}
    >
      <View style={[
        styles.alert,
        isBottom && styles.alertBottom,
        getShadowStyle("base"),
      ]}>
        {/* Colored icon badge */}
        <View style={[styles.iconBadge, { backgroundColor: iconBgColor }]}>
          {alert?.loading ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <Icon name={icon} size={18} color={iconColor} />
          )}
        </View>

        {/* Text content */}
        <View style={styles.alertContent}>
          {!!title && (
            <StyledText
              selectable={false}
              style={[styles.alertTitle, { color: theme.colors.foreground }]}
              numberOfLines={1}
            >
              {title}
            </StyledText>
          )}
          {hasMessage && (
            <StyledText
              selectable={false}
              style={[styles.alertDescription, { color: theme.colors.mutedForeground }]}
              numberOfLines={2}
            >
              {message}
            </StyledText>
          )}
        </View>

        {/* Close button */}
        <Pressable
          style={styles.closeButton}
          hitSlop={spacing.sm}
          onPress={animateOut}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
        >
          <Icon name="x" size={16} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    alignItems: "center",
  },
  alert: {
    width: "100%",
    maxWidth: 420,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xl + spacing.sm,
    borderRadius: spacing.radiusLg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  alertBottom: {
    borderRadius: spacing.radiusXl,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: spacing.radiusMd,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  alertTitle: {
    fontFamily: fontFamilies.sansSerif.regular,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
  alertDescription: {
    fontFamily: fontFamilies.sansSerif.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: spacing.radiusSm,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" && { cursor: "pointer" as any }),
  },
});
