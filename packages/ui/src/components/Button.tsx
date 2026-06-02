import React, { ComponentType, use, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  LayoutChangeEvent,
  DimensionValue,
  StyleProp,
  TextStyle,
  ViewStyle,
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { spacing } from "../constants/spacing";
import { StyledText, TextProps } from "./StyledText";
import { Icon, type IconProps } from "./Icon";
import { TextColorContext, TextSelectabilityContext, TextStyleContext } from "./StyledText.context";
import { fontFamilies } from "../constants/fonts";
import type { Theme } from "../constants/colors";
import { palette } from "../constants/colors";
import { useTheme } from "../hooks/useTheme";
import { useScalePress } from "../hooks/useScalePress";

/**
 * Button variants
 */
type Presets = "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";

/**
 * Button size variants
 */
export type ButtonSize = "sm" | "md" | "lg";

const SIZE_CONFIGS: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; height: number }> = {
  sm: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: 10,
    fontSize: 12,
    height: 28,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 12,
    fontSize: 14,
    height: 32,
  },
  lg: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    height: 40,
  },
};

const getNativeHitSlop = (sizeConfig: { height: number }) =>
  Math.ceil(Math.max(0, spacing.touchTarget - sizeConfig.height) / 2);

export type ButtonAccessoryStyle = {
  margin?: DimensionValue;
  marginHorizontal?: DimensionValue;
  marginVertical?: DimensionValue;
  marginTop?: DimensionValue;
  marginRight?: DimensionValue;
  marginBottom?: DimensionValue;
  marginLeft?: DimensionValue;
  marginStart?: DimensionValue;
  marginEnd?: DimensionValue;
};

export interface ButtonAccessoryProps {
  style: ButtonAccessoryStyle;
  pressableState: PressableStateCallbackType;
  disabled?: boolean;
}

export interface ButtonProps extends PressableProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"];
  /**
   * The text to display directly, or as fallback text when `tx` is provided.
   */
  text?: TextProps["text"];
  /**
   * Optional options to pass to i18n.
   */
  txOptions?: TextProps["txOptions"];
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * An optional style override for the "pressed" state.
   */
  pressedStyle?: StyleProp<ViewStyle>;
  /**
   * An optional style override for the button text.
   */
  textStyle?: StyleProp<TextStyle>;
  /**
   * An optional style override for the button text when in the "pressed" state.
   */
  pressedTextStyle?: StyleProp<TextStyle>;
  /**
   * An optional style override for the button text when in the "disabled" state.
   */
  disabledTextStyle?: StyleProp<TextStyle>;
  /**
   * One of the different types of button presets.
   * @default "default"
   */
  preset?: Presets;
  /**
   * Size variant
   * @default "md"
   */
  size?: ButtonSize;
  /**
   * An optional component to render on the right side of the text.
   */
  RightAccessory?: ComponentType<ButtonAccessoryProps>;
  /**
   * An optional component to render on the left side of the text.
   */
  LeftAccessory?: ComponentType<ButtonAccessoryProps>;
  /**
   * Children components.
   */
  children?: React.ReactNode;
  /**
   * disabled prop, accessed directly for declarative styling reasons.
   */
  disabled?: boolean;
  /**
   * An optional style override for the disabled state
   */
  disabledStyle?: StyleProp<ViewStyle>;
  /**
   * Whether to show shadow
   */
  withShadow?: boolean;
  /**
   * Whether button is loading (shows spinner)
   */
  loading?: boolean;
  /**
   * Whether button should take full width of container
   */
  fullWidth?: boolean;
}

/**
 * Enhanced Button Component
 *
 * Features:
 * - 6 variants (default, outline, ghost, link, destructive, secondary)
 * - 3 sizes (sm, md, lg)
 * - Loading state with spinner
 * - Full width option
 * - Shadow support
 * - Automatic text contrast calculation
 * - Accessory components (left/right)
 *
 * Usage:
 * ```tsx
 * // Simplest path — plain label via the `text` prop
 * <Button onPress={handler} text="Click Me" />
 *
 * // Different variants
 * <Button preset="outline" onPress={handler} text="Outline" />
 * <Button preset="ghost" onPress={handler} text="Ghost" />
 * <Button preset="destructive" onPress={handler} text="Delete" />
 *
 * // Different sizes
 * <Button size="sm" onPress={handler} text="Small" />
 * <Button size="lg" onPress={handler} text="Large" />
 *
 * // Loading state
 * <Button loading onPress={handler} text="Processing..." />
 *
 * // Full width
 * <Button fullWidth onPress={handler} text="Submit" />
 *
 * // Composed content — icon + label via subcomponents
 * <Button onPress={handler}>
 *   <Button.Icon name="heart" />
 *   <Button.Text>Like</Button.Text>
 * </Button>
 * ```
 */
function ButtonRoot(props: ButtonProps) {
  const {
    tx,
    text,
    txOptions,
    style: styleOverride,
    pressedStyle: pressedStyleOverride,
    textStyle: textStyleOverride,
    pressedTextStyle: pressedTextStyleOverride,
    disabledTextStyle: disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    disabledStyle: disabledStyleOverride,
    withShadow = false,
    preset = "default",
    size = "md",
    loading = false,
    fullWidth = false,
    onFocus,
    onBlur,
    onPressIn,
    onPressOut,
    ...rest
  } = props;

  const { theme, getContrastingColor, getFocusRingStyle, getShadowStyle } = useTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);
  const shadowStyle = getShadowStyle("base");
  const sizeConfig = SIZE_CONFIGS[size];
  const focusRingStyle = getFocusRingStyle();

  // Pre-compute background color for contrast calculation
  // Always flatten to handle both array styles (from Slot) and RegisteredStyle
  const flattenedStyle = styleOverride ? StyleSheet.flatten(styleOverride) : undefined;
  const customBgColor = flattenedStyle?.backgroundColor;

  // Calculate background color for each preset
  let backgroundColor: string;
  if (customBgColor && typeof customBgColor === "string") {
    backgroundColor = customBgColor;
  } else if (preset === "default") {
    backgroundColor = theme.colors.primary;
  } else if (preset === "secondary") {
    backgroundColor = theme.colors.secondary;
  } else if (preset === "destructive") {
    backgroundColor = theme.colors.destructive;
  } else if (preset === "outline" || preset === "ghost" || preset === "link") {
    backgroundColor = "transparent";
  } else {
    backgroundColor = theme.colors.primary;
  }

  // Determine text color per preset for readable contrast
  const textColor =
    preset === "outline"
      ? theme.colors.foreground
      : preset === "ghost"
        ? theme.colors.text
        : preset === "link"
          ? theme.colors.accent
          : preset === "default"
            ? theme.colors.primaryForeground
            : preset === "secondary"
              ? theme.colors.secondaryForeground
              : getContrastingColor(backgroundColor, palette.white, palette.black);

  const [focused, setFocused] = useState(false);
  const [restingWidth, setRestingWidth] = useState<number>();
  const isDisabled = disabled || loading;
  const { animatedStyle: scaleStyle, pressHandlers } = useScalePress({
    disabled: !!isDisabled,
    haptic: false,
    scaleTo: preset === "link" ? 1 : 0.97,
  });

  const showFocusRing: PressableProps["onFocus"] = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const hideFocusRing: PressableProps["onBlur"] = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const handlePressIn: PressableProps["onPressIn"] = (event) => {
    pressHandlers.onPressIn();
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps["onPressOut"] = (event) => {
    pressHandlers.onPressOut();
    onPressOut?.(event);
  };

  const handleButtonLayout = useCallback((event: LayoutChangeEvent) => {
    if (loading || fullWidth) return;

    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth <= 0) return;

    setRestingWidth((currentWidth) => {
      if (currentWidth !== undefined && Math.abs(currentWidth - nextWidth) < 0.5) {
        return currentWidth;
      }

      return nextWidth;
    });
  }, [fullWidth, loading]);

  return (
    <TextColorContext.Provider value={textColor}>
      <TextSelectabilityContext.Provider value={false}>
        <TextStyleContext.Provider value={styles.text}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!isDisabled, busy: loading }}
            {...rest}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onFocus={showFocusRing}
            onBlur={hideFocusRing}
            style={{ alignSelf: fullWidth ? "stretch" : (flattenedStyle?.alignSelf as ViewStyle["alignSelf"]) ?? "flex-start" }}
            hitSlop={rest.hitSlop ?? (Platform.OS === "web" ? undefined : getNativeHitSlop(sizeConfig))}
            disabled={isDisabled}
          >
            {(state) => (
              <Animated.View style={scaleStyle}>
                <View
                  style={[
                    styles.button,
                    preset === "default" && styles.buttonDefault,
                    preset === "outline" && styles.buttonOutline,
                    preset === "ghost" && styles.buttonGhost,
                    preset === "link" && styles.buttonLink,
                    preset === "destructive" && styles.buttonDestructive,
                    preset === "secondary" && styles.buttonSecondary,
                    fullWidth && styles.fullWidth,
                    withShadow && !isDisabled && shadowStyle,
                    state.pressed && preset === "outline" && styles.pressedMuted,
                    state.pressed && preset === "ghost" && styles.pressedMuted,
                    state.pressed && styles.pressed,
                    state.pressed && pressedStyleOverride,
                    isDisabled && styles.disabled,
                    isDisabled && disabledStyleOverride,
                    focused && !isDisabled && focusRingStyle,
                    loading && restingWidth !== undefined && !fullWidth && { width: restingWidth },
                    // Spread array styles from Slot to prevent nested arrays on web
                    ...(Array.isArray(styleOverride) ? styleOverride : [styleOverride]),
                  ]}
                  onLayout={handleButtonLayout}
                >
                  {loading && (
                    <View style={[styles.loaderOverlay, { pointerEvents: "none" }]}>
                      <ActivityIndicator
                        size="small"
                        color={textColor}
                      />
                    </View>
                  )}

                  <View style={[styles.content, loading && styles.loadingContent, { pointerEvents: loading ? "none" : "auto" }]}>
                    {!!LeftAccessory && (
                      <LeftAccessory
                        style={styles.leftAccessory}
                        pressableState={state}
                        disabled={isDisabled}
                      />
                    )}

                    {(tx || text) ? (
                      <StyledText
                        tx={tx}
                        text={text}
                        txOptions={txOptions}
                        style={[
                          styles.text,
                          state.pressed && styles.pressedText,
                          state.pressed && pressedTextStyleOverride,
                          isDisabled && disabledTextStyleOverride,
                          textStyleOverride,
                        ]}
                      />
                    ) : (
                      // Children render as-is. For text content, use the explicit
                      // <Button.Text> subcomponent so it inherits control typography
                      // via context instead of relying on a runtime `typeof` check.
                      children ?? null
                    )}

                    {!!RightAccessory && (
                      <RightAccessory
                        style={styles.rightAccessory}
                        pressableState={state}
                        disabled={isDisabled}
                      />
                    )}
                  </View>
                </View>
              </Animated.View>
            )}
          </Pressable>
        </TextStyleContext.Provider>
      </TextSelectabilityContext.Provider>
    </TextColorContext.Provider>
  );
}

/**
 * Button.Text
 * Text content for a Button. Inherits the button's control typography, color,
 * and non-selectable behavior from context, so callers state their intent
 * explicitly instead of relying on the component to inspect `typeof children`.
 *
 * ```tsx
 * <Button onPress={save}>
 *   <Button.Text>Save</Button.Text>
 * </Button>
 * ```
 */
function ButtonText(props: TextProps) {
  return <StyledText {...props} />;
}

/**
 * Button.Icon
 * Icon content for a Button. Defaults its color to the button's text color
 * (from context) and is decorative by default, since the label conveys meaning.
 *
 * ```tsx
 * <Button onPress={like}>
 *   <Button.Icon name="heart" />
 *   <Button.Text>Like</Button.Text>
 * </Button>
 * ```
 */
function ButtonIcon(props: IconProps) {
  const contextColor = use(TextColorContext);
  return <Icon decorative color={contextColor} {...props} />;
}

const createStyles = (theme: Theme, size: ButtonSize) => {
  const sizeConfig = SIZE_CONFIGS[size];

  return StyleSheet.create({
    button: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: spacing.radiusMd,
      paddingVertical: sizeConfig.paddingVertical,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      minHeight: sizeConfig.height,
      flexShrink: 0,
      ...(Platform.OS === "web" && { cursor: "pointer" as any }),
    } as ViewStyle,
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    } as ViewStyle,
    loadingContent: {
      opacity: 0,
    } as ViewStyle,
    buttonDefault: {
      backgroundColor: theme.colors.primary,
    } as ViewStyle,
    buttonSecondary: {
      backgroundColor: theme.colors.secondary,
    } as ViewStyle,
    buttonDestructive: {
      backgroundColor: theme.colors.destructive,
    } as ViewStyle,
    buttonOutline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.input,
    } as ViewStyle,
    buttonGhost: {
      backgroundColor: "transparent",
    } as ViewStyle,
    buttonLink: {
      backgroundColor: "transparent",
      paddingVertical: 0,
      paddingHorizontal: 0,
    } as ViewStyle,
    fullWidth: {
      width: "100%",
    } as ViewStyle,
    text: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: sizeConfig.fontSize,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: sizeConfig.fontSize * 1.4,
      flexShrink: 0,
      userSelect: "none",
    } as TextStyle,
    pressed: {
      opacity: 0.9,
    } as ViewStyle,
    pressedMuted: {
      backgroundColor: theme.colors.muted,
    } as ViewStyle,
    pressedText: {
      opacity: 0.9,
    } as TextStyle,
    disabled: {
      opacity: 0.6,
    } as ViewStyle,
    leftAccessory: {
      marginRight: spacing.sm,
    } as ViewStyle,
    rightAccessory: {
      marginLeft: spacing.sm,
    } as ViewStyle,
    loaderOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    } as ViewStyle,
  });
};

/**
 * Button with explicit subcomponents.
 * - `Button.Text` for label text (inherits control typography)
 * - `Button.Icon` for icons (inherits the button's text color)
 *
 * The `tx`/`text` props remain the simplest path for plain labels.
 */
const Button = Object.assign(ButtonRoot, {
  Text: ButtonText,
  Icon: ButtonIcon,
});

export { Button, ButtonText, ButtonIcon };
