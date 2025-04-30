import React from "react";
import { TouchableWithoutFeedback, Keyboard, StyleProp, ViewStyle, Platform, KeyboardAvoidingView } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * @returns Wrapper for a view that dismisses the keyboard when tapped outside of a text input
 */
export const DismissKeyboard = ({ children, style }: Props) => {
  const handlePress = () => Platform.OS !== "web" && Keyboard.dismiss();

  return (
    <TouchableWithoutFeedback onPress={handlePress} accessible={false}>
      <KeyboardAvoidingView style={[{ flex: 1, width: "100%" }, style]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {children}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};
