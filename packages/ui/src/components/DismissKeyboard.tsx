import React from "react";
import {
  StyleProp,
  ViewStyle,
  Platform,
  ScrollView,
  View,
  type GestureResponderEvent,
  type ViewProps,
} from "react-native";
import {
  KeyboardController,
  useKeyboardContext,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { KeyboardAvoidingView, useKeyboardAvoidance } from "./KeyboardAvoidingView";
import { isTouchInsideKeyboardFocusedInput } from "./keyboardFocusRegistry";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enable keyboard avoiding behavior */
  avoidKeyboard?: boolean;
  /** Enable scrolling */
  scrollable?: boolean;
}

type DismissKeyboardLayoutProps = Props & {
  dismissOnTouchStart?: ViewProps["onStartShouldSetResponderCapture"];
};

/**
 * Native tap-away keyboard dismissal.
 *
 * Why window-level dismissal: the native `@expo/ui` TextInput is a SwiftUI /
 * Compose field that never registers with React Native's `TextInputState`, so
 * `Keyboard.dismiss()` (which only blurs RN-tracked inputs) does nothing for it.
 * `KeyboardController.dismiss()` resigns the focused responder at the IME level,
 * which works for both native and RN fields.
 *
 * Why responder capture: a full-screen overlay also catches taps on the focused
 * input, which breaks double-tap text selection. Capture lets the tap continue
 * to children while still dismissing when the touch starts outside the focused
 * input bounds.
 */
function useDismissKeyboardOnOutsideTouch() {
  const isVisible = useKeyboardState((state) => state.isVisible);
  const { layout: focusedInput } = useKeyboardContext();

  return React.useCallback(
    (event: GestureResponderEvent) => {
      if (Platform.OS === "web" || !isVisible) {
        return false;
      }

      if (isTouchInsideKeyboardFocusedInput(event, focusedInput.value?.layout)) {
        return false;
      }

      KeyboardController.dismiss();
      return false;
    },
    [focusedInput, isVisible]
  );
}

/**
 * @returns Wrapper for a view that dismisses the keyboard when tapped outside of a text input
 */
function DismissKeyboardLayout({
  children,
  style,
  avoidKeyboard = true,
  scrollable = true,
  dismissOnTouchStart,
}: DismissKeyboardLayoutProps) {
  const hasKeyboardAvoidance = useKeyboardAvoidance();
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

  if (!avoidKeyboard || hasKeyboardAvoidance) {
    return (
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={dismissOnTouchStart}
      >
        {content}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, width: "100%" }, style]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      onStartShouldSetResponderCapture={dismissOnTouchStart}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

function NativeDismissKeyboard(props: Props) {
  const dismissOnTouchStart = useDismissKeyboardOnOutsideTouch();

  return (
    <DismissKeyboardLayout
      {...props}
      dismissOnTouchStart={dismissOnTouchStart}
    />
  );
}

/**
 * @returns Wrapper for a view that dismisses the keyboard when tapped outside of a text input
 */
export const DismissKeyboard = (props: Props) => {
  if (Platform.OS === "web") {
    return <DismissKeyboardLayout {...props} />;
  }

  return <NativeDismissKeyboard {...props} />;
};
