import React from "react";
import { Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAvoidingView, useKeyboardAvoidance } from "./KeyboardAvoidingView";
import { dismissKeyboard, useKeyboardDismissResponder } from "./keyboardDismiss";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enable keyboard avoiding behavior */
  avoidKeyboard?: boolean;
  /** Enable scrolling */
  scrollable?: boolean;
};

/**
 * Wrapper for a screen (or form) that dismisses the keyboard when the user taps
 * outside of a text input.
 *
 * Mirrors RN's `keyboardShouldPersistTaps="handled"` for the native `@expo/ui`
 * field, which RN itself cannot see: the wrapper never claims the touch, so
 * buttons, other fields and the focused field's own gestures win, and it
 * dismisses on release only when nothing else took the tap and the finger did
 * not scroll. See `useKeyboardDismissResponder`.
 *
 * A drag on the inner ScrollView also hides the keyboard: `interactive` on iOS
 * (UIKit resigns any first responder, SwiftUI fields included) and an explicit
 * dismiss on drag start on Android, where RN's `on-drag` only knows RN inputs.
 */
export function DismissKeyboard({
  children,
  style,
  avoidKeyboard = true,
  scrollable = true,
}: Props) {
  const responderProps = useKeyboardDismissResponder();
  const hasKeyboardAvoidance = useKeyboardAvoidance();
  const content = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
      onScrollBeginDrag={Platform.OS === "android" ? dismissKeyboard : undefined}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  if (!avoidKeyboard || hasKeyboardAvoidance) {
    return (
      <View style={{ flex: 1 }} {...responderProps}>
        {content}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, width: "100%" }, style]}
      keyboardVerticalOffset={0}
      {...responderProps}
    >
      {content}
    </KeyboardAvoidingView>
  );
}
