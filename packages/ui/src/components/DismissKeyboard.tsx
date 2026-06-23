import React from "react";
import {
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { KeyboardController, useKeyboardState } from "react-native-keyboard-controller";
import { KeyboardAvoidingView, useKeyboardAvoidance } from "./KeyboardAvoidingView";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enable keyboard avoiding behavior */
  avoidKeyboard?: boolean;
  /** Enable scrolling */
  scrollable?: boolean;
}

/**
 * Full-screen tap-catcher that dismisses the keyboard, mounted ONLY while the
 * keyboard is visible.
 *
 * Why window-level dismissal: the native `@expo/ui` TextInput is a SwiftUI /
 * Compose field that never registers with React Native's `TextInputState`, so
 * `Keyboard.dismiss()` (which only blurs RN-tracked inputs) does nothing for it.
 * `KeyboardController.dismiss()` resigns the focused responder at the IME level,
 * which works for both native and RN fields.
 *
 * Why only-while-visible: an always-mounted catcher would intercept the very tap
 * that focuses a field and close the keyboard before it opens, and would fight
 * bottom sheets / modals. Rendering it solely while the keyboard is up means
 * nothing intercepts taps when no field is focused; once one is, a tap anywhere
 * off the field dismisses.
 */
function KeyboardDismissOverlay() {
  const isVisible = useKeyboardState((state) => state.isVisible);

  if (!isVisible) return null;

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.overlay]}
      onPressIn={() => KeyboardController.dismiss()}
      accessibilityLabel="Dismiss keyboard"
      accessibilityRole="button"
    />
  );
}

/**
 * @returns Wrapper for a view that dismisses the keyboard when tapped outside of a text input
 */
export const DismissKeyboard = ({ children, style, avoidKeyboard = true, scrollable = true }: Props) => {
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

  // Web has no software keyboard, so the tap-catcher is native-only. The overlay
  // is never created on web, keeping `useKeyboardState` off that platform.
  const overlay = Platform.OS !== "web" ? <KeyboardDismissOverlay /> : null;

  if (!avoidKeyboard || hasKeyboardAvoidance) {
    return (
      <View style={{ flex: 1 }}>
        {content}
        {overlay}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, width: "100%" }, style]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {content}
      {overlay}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
  },
});
