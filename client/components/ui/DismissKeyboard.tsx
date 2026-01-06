import React from "react";
import { TouchableWithoutFeedback, Keyboard, StyleProp, ViewStyle, Platform, KeyboardAvoidingView, ScrollView } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enable keyboard avoiding behavior */
  avoidKeyboard?: boolean;
  /** Enable scrolling */
  scrollable?: boolean;
}

/**
 * @returns Wrapper for a view that dismisses the keyboard when tapped outside of a text input
 */
export const DismissKeyboard = ({ children, style, avoidKeyboard = true, scrollable = true }: Props) => {
  const handlePress = () => Platform.OS !== "web" && Keyboard.dismiss();

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  if (!avoidKeyboard) {
    return (
      <TouchableWithoutFeedback onPress={handlePress} accessible={false}>
        {content}
      </TouchableWithoutFeedback>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, width: "100%" }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={handlePress} accessible={false}>
        {content}
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};
