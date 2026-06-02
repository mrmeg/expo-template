import { palette } from "../constants/colors";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../lib/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, GestureResponderEvent, PanResponder, Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { StyledText } from "./StyledText";

export type SliderSize = "sm" | "md";

const SIZES = {
  sm: { track: 4, thumb: 16 },
  md: { track: 6, thumb: 20 },
} as const;

export interface SliderProps {
  /** Current value */
  value?: number;
  /** Called when the user drags the thumb */
  onValueChange?: (value: number) => void;
  /** Minimum value @default 0 */
  min?: number;
  /** Maximum value @default 100 */
  max?: number;
  /** Step increment @default 1 */
  step?: number;
  /** Size variant @default "md" */
  size?: SliderSize;
  /** Disable interaction @default false */
  disabled?: boolean;
  /** Show value label above thumb @default false */
  showValue?: boolean;
  /** Style override for outer container */
  style?: StyleProp<ViewStyle>;
}

function clampAndSnap(raw: number, min: number, max: number, step: number): number {
  const clamped = Math.min(Math.max(raw, min), max);
  const stepped = Math.round((clamped - min) / step) * step + min;
  // Avoid floating-point drift
  return Math.round(stepped * 1e6) / 1e6;
}

function getValueRatio(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return Math.min(Math.max((value - min) / range, 0), 1);
}

function Slider({
  value = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  size = "md",
  disabled = false,
  showValue = false,
  style: styleOverride,
}: SliderProps) {
  const { theme, getShadowStyle, withAlpha } = useTheme();
  const dims = SIZES[size];
  const inactiveTrackColor = theme.dark ? withAlpha(palette.white, 0.1) : theme.colors.muted;
  const activeTrackColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.28)
      : theme.colors.mutedForeground
    : theme.colors.accent;
  const thumbBackgroundColor = theme.dark ? theme.colors.card : theme.colors.background;
  const thumbBorderColor = disabled
    ? theme.dark
      ? withAlpha(palette.white, 0.32)
      : theme.colors.mutedForeground
    : theme.colors.accent;

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const thumbX = useRef(new Animated.Value(0)).current;
  const lastSnappedValue = useRef(value);

  const updateFromPosition = useCallback(
    (rawX: number) => {
      const width = trackWidthRef.current;
      const x = Math.min(Math.max(rawX, 0), width);
      thumbX.stopAnimation();
      thumbX.setValue(x);

      const ratio = width > 0 ? x / width : 0;
      const raw = min + ratio * (max - min);
      const snapped = clampAndSnap(raw, min, max, step);
      if (snapped !== lastSnappedValue.current) {
        lastSnappedValue.current = snapped;
        hapticLight();
      }
      onValueChange?.(snapped);
    },
    [max, min, onValueChange, step, thumbX],
  );

  const handleGesture = useCallback(
    (event: GestureResponderEvent) => {
      updateFromPosition(event.nativeEvent.locationX);
    },
    [updateFromPosition],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: handleGesture,
        onPanResponderMove: handleGesture,
      }),
    [disabled, handleGesture],
  );

  useEffect(() => {
    const ratio = getValueRatio(value, min, max);
    const width = trackWidthRef.current;

    if (width > 0) {
      Animated.timing(thumbX, {
        toValue: ratio * width,
        duration: 80,
        useNativeDriver: true,
      }).start();
    }

    lastSnappedValue.current = value;
  }, [max, min, thumbX, value]);

  const onTrackLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      trackWidthRef.current = w;
      setTrackWidth(w);
      // Set initial thumb position without animation
      const ratio = getValueRatio(value, min, max);
      thumbX.stopAnimation();
      thumbX.setValue(ratio * w);
    },
    [max, min, thumbX, value],
  );

  const safeTrackWidth = Math.max(trackWidth, 1);
  const fillScale = thumbX.interpolate({
    inputRange: [0, safeTrackWidth],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const thumbTranslateX = thumbX.interpolate({
    inputRange: [0, safeTrackWidth],
    outputRange: [-dims.thumb / 2, safeTrackWidth - dims.thumb / 2],
    extrapolate: "clamp",
  });
  const labelTranslateX = thumbX.interpolate({
    inputRange: [0, safeTrackWidth],
    outputRange: [-14, safeTrackWidth - 14],
    extrapolate: "clamp",
  });

  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;

  // Accessibility action handler
  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const action = event.nativeEvent.actionName;
      let next = value;
      if (action === "increment") {
        next = Math.min(value + step, max);
      } else if (action === "decrement") {
        next = Math.max(value - step, min);
      }
      if (next !== value) {
        onValueChange?.(next);
      }
    },
    [value, step, min, max, onValueChange],
  );

  return (
    <View
      style={[{ opacity: disabled ? 0.5 : 1 }, flattenedStyle]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[
        { name: "increment", label: "Increment" },
        { name: "decrement", label: "Decrement" },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {/* Value label above thumb */}
      {showValue && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -20,
              width: 28,
              alignItems: "center",
            },
            { transform: [{ translateX: labelTranslateX }] },
            { pointerEvents: "none" },
          ]}
        >
          <StyledText
            selectable={false}
            style={{
              fontSize: 12,
              color: theme.colors.textDim,
              userSelect: "none",
            }}
          >
            {value}
          </StyledText>
        </Animated.View>
      )}

      {/* Gesture area */}
      <View
        style={{
          height: dims.thumb,
          justifyContent: "center",
          ...(Platform.OS === "web" && { cursor: disabled ? "default" : ("pointer" as any) }),
        }}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View
          style={{
            height: dims.track,
            borderRadius: dims.track / 2,
            backgroundColor: inactiveTrackColor,
            overflow: "hidden",
          }}
        >
          {/* Fill */}
          <Animated.View
            style={[
              {
                width: "100%",
                height: dims.track,
                borderRadius: dims.track / 2,
                backgroundColor: activeTrackColor,
                transformOrigin: "left",
              },
              { transform: [{ scaleX: fillScale }] },
            ]}
          />
        </View>

        {/* Thumb */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              width: dims.thumb,
              height: dims.thumb,
              borderRadius: dims.thumb / 2,
              backgroundColor: thumbBackgroundColor,
              borderWidth: 1,
              borderColor: thumbBorderColor,
              ...getShadowStyle("subtle"),
            },
            { transform: [{ translateX: thumbTranslateX }] },
          ]}
        />
      </View>
    </View>
  );
}

export { Slider };
