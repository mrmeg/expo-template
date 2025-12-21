import React from "react";
import { TouchableWithoutFeedback, Keyboard, StyleProp, ViewStyle, Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

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
      <KeyboardAvoidingView style={[{ flexGrow: 1, width: "100%" }, style]} behavior="padding" keyboardVerticalOffset={100}>
        {children}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};
