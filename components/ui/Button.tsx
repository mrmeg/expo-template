import React, { ComponentType } from "react";
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
  StyleSheet,
  View,
  Platform,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import { TextProps } from "./Themed";
import { SansSerifText, TextColorContext } from "./StyledText";

type Presets = "default" | "outline";

export interface ButtonAccessoryProps {
  style: StyleProp<any>;
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
   */
  preset?: Presets;
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
}

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
    ...rest
  } = props;

  const { theme, getContrastingColor } = useTheme();
  const styles = createStyles(theme);

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
  } else if (preset === "outline") {
    backgroundColor = "transparent";
  } else {
    backgroundColor = theme.colors.primary;
  }

  // Use contrast calculation for reliable, readable text color across platforms
  const textColor = preset === "outline"
    ? theme.colors.primary  // Outline uses primary color for text
    : getContrastingColor(
      backgroundColor,
      theme.colors.textLight,
      theme.colors.textDark
    );

  return (
    <TextColorContext.Provider value={textColor}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        {...rest}
        disabled={disabled}
      >
        {(state) => (
          <View
            style={[
              styles.button,
              preset === "default" && styles.buttonDefault,
              preset === "outline" && styles.buttonOutline,
              withShadow && !disabled && (Platform.OS === "web" ? styles.shadowWeb : styles.shadowNative),
              state.pressed && styles.pressed,
              state.pressed && pressedStyleOverride,
              disabled && styles.disabled,
              disabled && disabledStyleOverride,
              // Spread array styles from Slot to prevent nested arrays on web
              ...(Array.isArray(styleOverride) ? styleOverride : [styleOverride]),
            ]}
          >
            {!!LeftAccessory && (
              <LeftAccessory
                style={styles.leftAccessory}
                pressableState={state}
                disabled={disabled}
              />
            )}

            {(tx || text) ? (
              <SansSerifText
                tx={tx}
                text={text}
                txOptions={txOptions}
                style={[
                  styles.text,
                  state.pressed && styles.pressedText,
                  state.pressed && pressedTextStyleOverride,
                  disabled && disabledTextStyleOverride,
                  textStyleOverride,
                ]}
              />
            ) : (
              children
            )}

            {!!RightAccessory && (
              <RightAccessory
                style={styles.rightAccessory}
                pressableState={state}
                disabled={disabled}
              />
            )}
          </View>
        )
        }
      </Pressable>
    </TextColorContext.Provider>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: spacing.radiusMd,
    paddingVertical: spacing.buttonPadding,
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  buttonDefault: {
    backgroundColor: theme.colors.primary,
  } as ViewStyle,
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  } as ViewStyle,
  shadowWeb: Platform.select({
    web: {
      // Empty object on web - no shadow to avoid CSS errors
    },
    default: {},
  }) as ViewStyle,
  shadowNative: Platform.select({
    web: {},
    ios: {
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    // No shadow on Android - causes text background artifact
    android: {},
    default: {},
  }) as ViewStyle,
  text: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
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
});
