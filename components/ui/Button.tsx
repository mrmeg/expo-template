import React, { ComponentType } from "react";
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
  StyleSheet,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import { TextProps } from "./Themed";
import { SansSerifText } from "./StyledText";

type Presets = "default" | "filled" | "outline";

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
    withShadow = true,
    preset = "default",
    ...rest
  } = props;

  const { theme, getShadowStyle, getContrastingColor } = useTheme();
  const styles = createStyles(theme);

  // Declarative style function for the button container
  function getViewStyle({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> {
    const baseStyle: StyleProp<ViewStyle>[] = [styles.button];

    // Apply preset styles
    if (preset === "default") {
      baseStyle.push(styles.buttonDefault);
    } else if (preset === "outline") {
      baseStyle.push(styles.buttonOutline);
    } else if (preset === "filled") {
      baseStyle.push(styles.buttonFilled);
    }

    // Apply shadow if enabled
    if (withShadow && !disabled) {
      baseStyle.push(getShadowStyle('base'));
    }

    // Apply pressed styles
    if (pressed) {
      baseStyle.push(styles.pressed);
      if (pressedStyleOverride) {
        baseStyle.push(pressedStyleOverride);
      }
    }

    // Apply disabled styles
    if (disabled) {
      baseStyle.push(styles.disabled);
      if (disabledStyleOverride) {
        baseStyle.push(disabledStyleOverride);
      }
    }

    // Apply custom style override
    if (styleOverride) {
      baseStyle.push(styleOverride);
    }

    return baseStyle;
  }

  // Declarative style function for the text
  function getTextStyle({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> {
    const baseStyle: StyleProp<TextStyle>[] = [styles.text];

    // Determine the background color for contrast calculation
    let backgroundColor: string;

    // Check for custom background color in style override
    const flattenedStyle = StyleSheet.flatten(styleOverride);
    const customBgColor = flattenedStyle?.backgroundColor;

    if (customBgColor && typeof customBgColor === 'string') {
      backgroundColor = customBgColor;
    } else if (preset === "default") {
      backgroundColor = theme.colors.primary;
    } else if (preset === "filled") {
      backgroundColor = theme.colors.secondary;
    } else if (preset === "outline") {
      // Outline has transparent background, use theme background for contrast
      backgroundColor = theme.colors["base-100"];
    } else {
      backgroundColor = theme.colors.primary; // fallback
    }

    // Use theme's contrast helper to pick readable text color
    const textColor = getContrastingColor(
      backgroundColor,
      theme.colors.white,           // white text for dark backgrounds
      theme.colors["base-content"]  // dark text for light backgrounds
    );

    baseStyle.push({ color: textColor });

    // Apply pressed text styles
    if (pressed) {
      baseStyle.push(styles.pressedText);
      if (pressedTextStyleOverride) {
        baseStyle.push(pressedTextStyleOverride);
      }
    }

    // Apply disabled text styles
    if (disabled) {
      if (disabledTextStyleOverride) {
        baseStyle.push(disabledTextStyleOverride);
      }
    }

    // Apply custom text style override
    if (textStyleOverride) {
      baseStyle.push(textStyleOverride);
    }

    return baseStyle;
  }

  return (
    <Pressable
      style={getViewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
      disabled={disabled}
    >
      {(state) => (
        <>
          {!!LeftAccessory && (
            <LeftAccessory
              style={styles.leftAccessory}
              pressableState={state}
              disabled={disabled}
            />
          )}

          <SansSerifText
            tx={tx}
            text={text}
            txOptions={txOptions}
            style={getTextStyle(state)}
          >
            {children}
          </SansSerifText>

          {!!RightAccessory && (
            <RightAccessory
              style={styles.rightAccessory}
              pressableState={state}
              disabled={disabled}
            />
          )}
        </>
      )}
    </Pressable>
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
    minHeight: 48,
  } as ViewStyle,
  buttonDefault: {
    backgroundColor: theme.colors.primary,
  } as ViewStyle,
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  } as ViewStyle,
  buttonFilled: {
    backgroundColor: theme.colors.secondary,
  } as ViewStyle,
  text: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
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
