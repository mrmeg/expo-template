import React from "react";
import { Pressable, Keyboard, StyleProp, ViewStyle, Platform, KeyboardAvoidingView, ScrollView } from "react-native";

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
      style={{ flex: 1 }}
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
      <Pressable onPress={handlePress} accessible={false} style={{ flex: 1 }}>
        {content}
      </Pressable>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, width: "100%" }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Pressable onPress={handlePress} accessible={false} style={{ flex: 1 }}>
        {content}
      </Pressable>
    </KeyboardAvoidingView>
  );
};
