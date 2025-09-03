import React, { useContext, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, Animated, TouchableOpacity } from "react-native";
import { globalUIStore } from "@/stores/globalUIStore";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { SansSerifText } from "./StyledText";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

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
  const { theme, themedStyles } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const { alert, hide } = globalUIStore();

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
      return { name: "time", color: theme.colors.text };
    }

    switch (alert?.type) {
    case "error":
      return { name: "alert-circle", color: theme.colors.error };
    case "success":
      return { name: "checkmark-circle", color: theme.colors.success };
    case "info":
      return { name: "information-circle", color: theme.colors.text };
    default:
      return { name: "information-circle", color: theme.colors.text };
    }
  };

  const getTitle = () => {
    if (alert?.title) return alert.title;

    switch (alert?.type) {
    case "error":
      return "Error";
    case "success":
      return "Success";
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
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.notification
        },
        !theme.dark && themedStyles.softShadow
      ]}>
        <View style={styles.iconContainer}>
          {alert?.loading ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <Ionicons
              name={getIconProps().name as React.ComponentProps<typeof Ionicons>["name"]}
              size={24}
              color={getIconProps().color}
            />
          )}
        </View>
        <View style={styles.alertContent}>
          {getTitle() && (
            <SansSerifText style={[
              styles.alertTitle,
              { color: theme.colors.text }
            ]}>
              {getTitle()}
            </SansSerifText>
          )}
          <SansSerifText style={[
            styles.alertDescription,
            { color: theme.colors.secondaryText }
          ]}>
            {alert?.messages?.[0] || ""}
          </SansSerifText>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          hitSlop={8}
          onPress={animateOut}
        >
          <Ionicons name="close" size={20} color={theme.colors.icon} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
    width: 240,
    maxWidth: "90%",
    alignSelf: "center",
  },
  alert: {
    margin: 16,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
    marginLeft: 8,
    justifyContent: "center",
  },
  alertTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  alertDescription: {},
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
