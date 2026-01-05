import React, { ComponentType } from "react";
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
  ImageStyle,
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
} from "react-native";
import { spacing } from "@/client/constants/spacing";
import { StyledText, TextColorContext, TextProps } from "./StyledText";
import { fontFamilies } from "@/client/constants/fonts";
import type { Theme } from "@/client/constants/colors";
import { palette } from "@/client/constants/colors";
import { useTheme } from "@/client/hooks/useTheme";

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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    height: 28,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    height: 32,
  },
  lg: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    height: 36,
  },
};

export interface ButtonAccessoryProps {
  style: StyleProp<ViewStyle | TextStyle | ImageStyle>;
  pressableState: PressableStateCallbackType;
  disabled?: boolean;
}

export interface ButtonProps extends PressableProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"];
  /**
   * The text to display if not using `tx` or nested components.
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
 * // Default button
 * <Button onPress={handler}>
 *   <SansSerifBoldText>Click Me</SansSerifBoldText>
 * </Button>
 *
 * // Different variants
 * <Button preset="outline" onPress={handler}>Outline</Button>
 * <Button preset="ghost" onPress={handler}>Ghost</Button>
 * <Button preset="destructive" onPress={handler}>Delete</Button>
 *
 * // Different sizes
 * <Button size="sm" onPress={handler}>Small</Button>
 * <Button size="lg" onPress={handler}>Large</Button>
 *
 * // Loading state
 * <Button loading onPress={handler}>Processing...</Button>
 *
 * // Full width
 * <Button fullWidth onPress={handler}>Submit</Button>
 * ```
 */
export function Button(props: ButtonProps) {
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
    ...rest
  } = props;

  const { theme, getContrastingColor, getShadowStyle } = useTheme();
  const styles = createStyles(theme, size);
  const shadowStyle = getShadowStyle("base");
  const sizeConfig = SIZE_CONFIGS[size];

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

  // Use contrast calculation for reliable, readable text color across platforms
  const textColor =
    preset === "outline"
      ? theme.colors.primary // Use primary color for text on transparent background
      : preset === "ghost"
        ? theme.colors.text
        : preset === "link"
          ? theme.colors.primary
          : preset === "destructive"
            ? getContrastingColor(backgroundColor, palette.white, palette.black)
            : getContrastingColor(backgroundColor, palette.white, palette.black);

  const isDisabled = disabled || loading;

  return (
    <TextColorContext.Provider value={textColor}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: loading }}
        {...rest}
        disabled={isDisabled}
      >
        {(state) => (
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
              state.pressed && styles.pressed,
              state.pressed && pressedStyleOverride,
              isDisabled && styles.disabled,
              isDisabled && disabledStyleOverride,
              // Spread array styles from Slot to prevent nested arrays on web
              ...(Array.isArray(styleOverride) ? styleOverride : [styleOverride]),
            ]}
          >
            {!!LeftAccessory && !loading && (
              <LeftAccessory
                style={styles.leftAccessory}
                pressableState={state}
                disabled={isDisabled}
              />
            )}

            {loading && (
              <ActivityIndicator
                size="small"
                color={textColor}
                style={styles.loader}
              />
            )}

            {(tx || text) ? (
              <StyledText
                style={[
                  styles.text,
                  state.pressed && styles.pressedText,
                  state.pressed && pressedTextStyleOverride,
                  isDisabled && disabledTextStyleOverride,
                  textStyleOverride,
                ]}
              >
                {tx || text}
              </StyledText>
            ) : !loading && children ? (
              // Wrap string children in StyledText to apply TextColorContext
              typeof children === "string" ? (
                <StyledText
                  style={[
                    styles.text,
                    state.pressed && styles.pressedText,
                    state.pressed && pressedTextStyleOverride,
                    isDisabled && disabledTextStyleOverride,
                    textStyleOverride,
                  ]}
                >
                  {children}
                </StyledText>
              ) : (
                children
              )
            ) : null}

            {!!RightAccessory && !loading && (
              <RightAccessory
                style={styles.rightAccessory}
                pressableState={state}
                disabled={isDisabled}
              />
            )}
          </View>
        )}
      </Pressable>
    </TextColorContext.Provider>
  );
}

const createStyles = (theme: Theme, size: ButtonSize) => {
  const sizeConfig = SIZE_CONFIGS[size];

  return StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: spacing.radiusSm,
      paddingVertical: sizeConfig.paddingVertical,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      minHeight: sizeConfig.height,
      ...(Platform.OS === "web" && { cursor: "pointer" as any }),
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
      borderColor: theme.colors.primary,
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
      fontFamily: fontFamilies.sansSerif.bold,
      fontSize: sizeConfig.fontSize,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: sizeConfig.fontSize * 1.25,
    } as TextStyle,
    pressed: {
      opacity: 0.8,
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
    loader: {
      marginRight: spacing.sm,
    } as ViewStyle,
  });
};
