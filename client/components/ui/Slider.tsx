import { palette } from "@/client/constants/colors";
import { useTheme } from "@/client/hooks/useTheme";
import { hapticLight } from "@/client/lib/haptics";
import React, { useCallback, useRef } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
  "worklet";
  const clamped = Math.min(Math.max(raw, min), max);
  const stepped = Math.round((clamped - min) / step) * step + min;
  // Avoid floating-point drift
  return Math.round(stepped * 1e6) / 1e6;
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
  const { theme } = useTheme();
  const dims = SIZES[size];

  // Track layout width captured via onLayout
  const trackWidth = useSharedValue(0);
  // Thumb position in pixels along the track
  const thumbX = useSharedValue(0);
  // Last snapped value (worklet-side) to detect step changes for haptics
  const lastSnappedValue = useSharedValue(value);

  // Keep a ref to onValueChange so the worklet always calls the latest version
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const jsOnValueChange = useCallback((v: number) => {
    onValueChangeRef.current?.(v);
  }, []);

  const jsHaptic = useCallback(() => {
    hapticLight();
  }, []);

  // Sync external value prop changes with animation
  const prevExternalValue = useRef(value);
  if (value !== prevExternalValue.current) {
    prevExternalValue.current = value;
    if (trackWidth.value > 0) {
      const ratio = (value - min) / (max - min || 1);
      thumbX.value = withTiming(ratio * trackWidth.value, { duration: 80 });
    }
    lastSnappedValue.value = value;
  }

  const onTrackLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      trackWidth.value = w;
      // Set initial thumb position without animation
      const ratio = (value - min) / (max - min || 1);
      thumbX.value = ratio * w;
    },
    [value, min, max],
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      "worklet";
      // Jump to touch position
      const x = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = x;
      const ratio = trackWidth.value > 0 ? x / trackWidth.value : 0;
      const raw = min + ratio * (max - min);
      const snapped = clampAndSnap(raw, min, max, step);
      if (snapped !== lastSnappedValue.value) {
        lastSnappedValue.value = snapped;
        runOnJS(jsHaptic)();
      }
      runOnJS(jsOnValueChange)(snapped);
    })
    .onUpdate((e) => {
      "worklet";
      const x = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = x;
      const ratio = trackWidth.value > 0 ? x / trackWidth.value : 0;
      const raw = min + ratio * (max - min);
      const snapped = clampAndSnap(raw, min, max, step);
      if (snapped !== lastSnappedValue.value) {
        lastSnappedValue.value = snapped;
        runOnJS(jsHaptic)();
      }
      runOnJS(jsOnValueChange)(snapped);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value,
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - dims.thumb / 2 }],
  }));

  const valueLabelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - 14 }],
  }));

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
            valueLabelStyle,
          ]}
          pointerEvents="none"
        >
          <StyledText
            style={{
              fontSize: 11,
              color: theme.colors.textDim,
              userSelect: "none",
            }}
          >
            {value}
          </StyledText>
        </Animated.View>
      )}

      {/* Gesture area */}
      <GestureDetector gesture={panGesture}>
        <View
          style={{
            height: dims.thumb,
            justifyContent: "center",
            ...(Platform.OS === "web" && { cursor: disabled ? "default" : ("pointer" as any) }),
          }}
          onLayout={onTrackLayout}
        >
          {/* Track background */}
          <View
            style={{
              height: dims.track,
              borderRadius: dims.track / 2,
              backgroundColor: theme.colors.muted,
              overflow: "hidden",
            }}
          >
            {/* Fill */}
            <Animated.View
              style={[
                {
                  height: dims.track,
                  borderRadius: dims.track / 2,
                  backgroundColor: theme.colors.primary,
                },
                fillStyle,
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
                backgroundColor: palette.white,
                borderWidth: 1,
                borderColor: theme.colors.border,
                ...(Platform.OS !== "web" && {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2,
                }),
              },
              thumbAnimatedStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export { Slider };
