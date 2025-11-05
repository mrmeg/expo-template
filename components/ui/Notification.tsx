import React, { useContext, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, Animated, TouchableOpacity } from "react-native";
import { globalUIStore } from "@/stores/globalUIStore";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { SansSerifText } from "./StyledText";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

/**
 * Notification
 *
 * Global animated notification component rendered in the root `_layout`.
 * Displays success, error, info, or loading messages triggered from anywhere in the app via `globalUIStore`.
 *
 * Appears near the top of the screen, respects safe area insets, and auto-dismisses after `duration`.
 *
 * Usage example:
 * globalUIStore.getState().show({
 *   type: "success",
 *   title: "Saved",
 *   messages: ["Your changes have been saved."],
 *   duration: 3000
 * });
 */
export const Notification = () => {
  const { theme, getShadowStyle } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const { alert, hide } = globalUIStore();
  const styles = createStyles(theme);

  // Store animation values in state instead of refs
  const [animationState] = React.useState({
    fadeAnim: new Animated.Value(0),
    translateY: new Animated.Value(-20),
    scale: new Animated.Value(0.95),
    rotate: new Animated.Value(0)
  });

  useEffect(() => {
    if (alert?.show) {
      // Reset animations before starting
      animationState.fadeAnim.setValue(0);
      animationState.translateY.setValue(-20);
      animationState.scale.setValue(0.95);
      animationState.rotate.setValue(0);

      Animated.parallel([
        Animated.timing(animationState.fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(animationState.translateY, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(animationState.scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(animationState.rotate, {
            toValue: 0.05,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.rotate, {
            toValue: -0.05,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(animationState.rotate, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          })
        ])
      ]).start();

      if (alert.duration) {
        const timer = setTimeout(() => {
          animateOut();
        }, alert.duration || 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [alert, hide, animationState]);

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(animationState.fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(animationState.translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animationState.scale, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => hide());
  };

  const topPosition = insets?.top ? insets.top : 20;
  const spin = animationState.rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-30deg", "30deg"]
  });

  const getIconProps = () => {
    if (alert?.loading) {
      return { name: "time", color: theme.colors["base-content"] };
    }

    switch (alert?.type) {
      case "error":
        return { name: "alert-circle", color: theme.colors.error };
      case "success":
        return { name: "checkmark-circle", color: theme.colors.success };
      case "warning":
        return { name: "warning", color: theme.colors.warning };
      case "info":
        return { name: "information-circle", color: theme.colors["base-content"] };
      default:
        return { name: "information-circle", color: theme.colors["base-content"] };
    }
  };

  const getTitle = () => {
    if (alert?.title) return alert.title;

    switch (alert?.type) {
      case "error":
        return "Error";
      case "success":
        return "Success";
      case "warning":
        return "Warning";
      case "info":
        return "";
      default:
        return "";
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topPosition,
          opacity: animationState.fadeAnim,
          transform: [
            { translateY: animationState.translateY },
            { scale: animationState.scale },
            { rotate: spin }
          ],
          display: alert?.show ? "flex" : "none"
        }
      ]}
    >
      <View style={[
        styles.alert,
        !theme.dark && { ...getShadowStyle('soft') }
      ]}>
        <View style={styles.iconContainer}>
          {alert?.loading ? (
            <ActivityIndicator size="small" color={theme.colors["base-content"]} />
          ) : (
            <Ionicons
              name={getIconProps().name as React.ComponentProps<typeof Ionicons>["name"]}
              size={spacing.iconMd}
              color={getIconProps().color}
            />
          )}
        </View>
        <View style={styles.alertContent}>
          {getTitle() && (
            <SansSerifText style={styles.alertTitle}>
              {getTitle()}
            </SansSerifText>
          )}
          <SansSerifText style={styles.alertDescription}>
            {alert?.messages?.[0] || ""}
          </SansSerifText>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          hitSlop={spacing.sm}
          onPress={animateOut}
        >
          <Ionicons name="close" size={spacing.iconSm + 4} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
    width: 240,
    maxWidth: "90%",
    alignSelf: "center",
  },
  alert: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: theme.colors["base-300"],
    backgroundColor: theme.colors["base-200"],
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: spacing.iconMd,
    height: spacing.iconMd,
    justifyContent: "center",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: "center",
  },
  alertTitle: {
    fontWeight: "bold",
    marginBottom: spacing.xs,
  },
  alertDescription: {
    opacity: 0.8,
  },
  closeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
});
