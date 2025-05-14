import React, { useState } from "react";
import { StyleSheet, TextInput as RNTextInput, ViewStyle, TextInputProps, StyleProp, Platform, View } from "react-native";
import { Entypo } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SansSerifText } from "./StyledText";

interface Props extends TextInputProps {
  focusedStyle?: object;
  rows?: number;
  showSecureEntryToggle?: boolean;
  wrapperStyle?: StyleProp<ViewStyle>;
  label?: string;
}

export const TextInput = ({
  focusedStyle,
  rows,
  showSecureEntryToggle,
  wrapperStyle,
  label,
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
  const { base, theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(secureTextEntry || false);
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
          placeholderTextColor={theme.colors.placeholder}
          style={[
            {
              backgroundColor: theme.dark ? theme.colors.card : base.white,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
            styles.input,
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
            size={20}
            color={theme.colors.secondaryText}
            style={styles.passwordToggle}
            onPress={() => setPasswordVisible(!passwordVisible)}
          />
        )}
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  input: {
    height: undefined,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  passwordToggle: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -10 }],
  },
  wrapper: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  label: {
    marginBottom: 4,
    fontSize: 14,
  }
});
