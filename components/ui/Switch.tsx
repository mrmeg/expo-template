import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import * as SwitchPrimitives from "@rn-primitives/switch";
import { Platform, Animated } from "react-native";
import { SansSerifBoldText } from "./StyledText";
import { useEffect, useRef } from "react";

const DEFAULT_HIT_SLOP = 8;

interface SwitchProps extends SwitchPrimitives.RootProps {
  /**
   * Optional label to display when switch is ON (checked)
   */
  labelOn?: string;
  /**
   * Optional label to display when switch is OFF (unchecked)
   */
  labelOff?: string;
  /**
   * Custom size for the switch container
   * Default: { width: 52, height: 28 }
   */
  size?: { width: number; height: number };
  /**
   * Custom size for the thumb (sliding circle)
   * Default: 24
   */
  thumbSize?: number;
}

/**
 * Switch Component
 * A controlled switch/toggle component using @rn-primitives/switch
 * Integrates with DaisyUI theme system and supports React Native Reusables patterns
 *
 * Usage:
 * ```tsx
 * const [checked, setChecked] = useState(false);
 * <Switch checked={checked} onCheckedChange={setChecked} />
 * ```
 *
 * With labels:
 * ```tsx
 * <Switch
 *   checked={checked}
 *   onCheckedChange={setChecked}
 *   labelOn="ON"
 *   labelOff="OFF"
 * />
 * ```
 */
function Switch({
  labelOn,
  labelOff,
  size = { width: 52, height: 28 },
  thumbSize = 24,
  ...props
}: SwitchProps) {
  const { theme, getContrastingColor } = useTheme();

  // Dynamic border color with sufficient contrast against background
  const borderColor = getContrastingColor(
    theme.colors.bgPrimary,
    theme.colors.bgTertiary,
    theme.colors.neutral
  );

  // Calculate label color for ON state (when checked, background is primary)
  const labelOnColor = getContrastingColor(
    theme.colors.primary,
    theme.colors.textLight,
    theme.colors.textDark
  );

  // Calculate sizes
  const labelFontSize = size.height / 3;

  // Animation values
  const thumbPosition = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOnOpacity = useRef(new Animated.Value(props.checked ? 1 : 0)).current;
  const labelOffOpacity = useRef(new Animated.Value(props.checked ? 0 : 1)).current;

  // Animate on checked state change
  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";

    Animated.parallel([
      Animated.spring(thumbPosition, {
        toValue: props.checked ? 1 : 0,
        tension: 180,
        friction: 12,
        useNativeDriver,
      }),
      Animated.timing(labelOnOpacity, {
        toValue: props.checked ? 1 : 0,
        duration: 150,
        useNativeDriver,
      }),
      Animated.timing(labelOffOpacity, {
        toValue: props.checked ? 0 : 1,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  }, [props.checked, thumbPosition, labelOnOpacity, labelOffOpacity]);

  // Interpolate thumb position
  const animatedThumbTranslateX = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [2, size.width - thumbSize - 2],
  });

  return (
    <SwitchPrimitives.Root
      {...props}
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        borderRadius: size.height / 2,
        borderWidth: 0.75,
        borderColor: props.checked ? theme.colors.primary : borderColor,
        backgroundColor: props.checked ? theme.colors.primary : theme.colors.bgTertiary,
        justifyContent: "center",
        opacity: props.disabled ? 0.5 : 1,
        ...(Platform.OS === "web" && { cursor: "pointer" as any }),
      }}
      hitSlop={DEFAULT_HIT_SLOP}
    >
      {/* Label ON - shown when checked */}
      {labelOn && (
        <Animated.View
          style={{
            position: "absolute",
            left: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: labelOnOpacity,
          }}
          pointerEvents="none"
        >
          <SansSerifBoldText
            style={{
              fontSize: labelFontSize,
              color: labelOnColor,
              userSelect: "none",
            }}
          >
            {labelOn}
          </SansSerifBoldText>
        </Animated.View>
      )}

      {/* Thumb (sliding circle) */}
      <SwitchPrimitives.Thumb
        asChild
      >
        <Animated.View
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: theme.colors.white,
            transform: [{ translateX: animatedThumbTranslateX }],
            ...(Platform.OS !== "web" && {
              shadowColor: theme.colors.overlay,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 3,
            }),
          }}
        />
      </SwitchPrimitives.Thumb>

      {/* Label OFF - shown when unchecked */}
      {labelOff && (
        <Animated.View
          style={{
            position: "absolute",
            right: spacing.sm,
            justifyContent: "center",
            alignItems: "center",
            opacity: labelOffOpacity,
          }}
          pointerEvents="none"
        >
          <SansSerifBoldText
            style={{
              fontSize: labelFontSize,
              color: theme.colors.textPrimary,
              userSelect: "none",
            }}
          >
            {labelOff}
          </SansSerifBoldText>
        </Animated.View>
      )}
    </SwitchPrimitives.Root>
  );
}

export { Switch };
