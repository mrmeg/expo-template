import React, { useState } from "react";
import { StyleSheet, TextInput as RNTextInput, ViewStyle, TextInputProps, StyleProp, Platform, View } from "react-native";
import { Entypo } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import { SansSerifText } from "./StyledText";

interface Props extends TextInputProps {
  focusedStyle?: object;
  rows?: number;
  showSecureEntryToggle?: boolean;
  wrapperStyle?: StyleProp<ViewStyle>;
  label?: string;
  forceLight?: boolean;
}

export const TextInput = ({
  focusedStyle,
  rows,
  showSecureEntryToggle,
  wrapperStyle,
  label,
  forceLight,
  secureTextEntry,
  inputMode,
  style,
  onChangeText,
  onFocus,
  onBlur,
  value,
  multiline,
  ...rest
}: Props) => {
  const { theme, getContrastingColor } = useTheme();
  const styles = createStyles(theme);
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(secureTextEntry || false);
  const backgroundColor = forceLight ? theme.colors.white : (theme.dark ? "#F1F3F5" : theme.colors.white);
  const isWeb = Platform.OS === "web";

  const handleScrollBehavior = () => {
    if (multiline && rest.scrollEnabled !== false) {
      return contentHeight > 100;
    }
    return false;
  };

  const handleNumericChange = (input: string) => {
    const numericRegex = /^[0-9]*$/;
    if (numericRegex.test(input)) {
      onChangeText?.(input);
    }
  };

  const handleTextChange = (input: string) => {
    onChangeText?.(input);
  };

  return (
    <View style={wrapperStyle}>
      {label && <SansSerifText style={styles.label}>{label}</SansSerifText>}
      <View style={styles.wrapper}>
        <RNTextInput
          {...rest}
          inputMode={inputMode || "text"}
          multiline={multiline}
          numberOfLines={rows}
          secureTextEntry={passwordVisible}
          onChangeText={inputMode === "numeric" ? handleNumericChange : handleTextChange}
          onFocus={onFocus ?? (() => setFocused(true))}
          onBlur={onBlur ?? (() => setFocused(false))}
          onContentSizeChange={e => setContentHeight(e.nativeEvent.contentSize.height)}
          scrollEnabled={handleScrollBehavior()}
          placeholderTextColor={theme.colors.neutral}
          style={[
            styles.input,
            {
              backgroundColor: backgroundColor,
              borderColor: forceLight ? "#d1d5db" : theme.colors.bgTertiary,
              color: forceLight ? "#1f2937" : getContrastingColor(backgroundColor, theme.colors.textPrimary, theme.colors.white),
            },
            style,
            focused && focusedStyle,
            isWeb && { fontSize: 16 },
          ]}
          textAlignVertical={multiline ? "top" : "center"}
          value={value}
        />

        {(secureTextEntry && showSecureEntryToggle) && (
          <Entypo
            name={passwordVisible ? "eye-with-line" : "eye"}
            size={spacing.iconSm + 4}
            color={theme.colors.neutral}
            style={styles.passwordToggle}
            onPress={() => setPasswordVisible(!passwordVisible)}
          />
        )}
      </View>
    </View>
  );
};


const createStyles = (theme: any) => StyleSheet.create({
  input: {
    height: undefined,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    paddingVertical: Platform.OS === "web" ? 5 : spacing.sm,
    paddingHorizontal: Platform.OS === "web" ? 5 : spacing.sm + 2,
  },
  passwordToggle: {
    position: "absolute",
    right: spacing.sm + 2,
    top: "50%",
    transform: [{ translateY: Platform.OS === "web" ? -10 : -12 }],
    zIndex: 1,
  },
  wrapper: {
    width: "100%",
    position: "relative",
    minHeight: Platform.OS === "web" ? 30 : 40,
    backgroundColor: "transparent",
  },
  label: {
    marginBottom: spacing.xs,
    fontSize: 14,
    color: theme.colors.textPrimary,
  }
});
