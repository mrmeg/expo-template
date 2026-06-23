import { StyleSheet, Pressable } from "react-native";
import { KeyboardController, useKeyboardState } from "react-native-keyboard-controller";

/**
 * A transparent, full-screen tap-catcher that dismisses the keyboard.
 *
 * Why this exists: the native @expo/ui TextInput is a SwiftUI field that does not
 * claim React Native's JS touch responder. As a result an always-mounted tap
 * wrapper would steal the focus tap and close the keyboard before it opens, and
 * the ScrollView's built-in `keyboardShouldPersistTaps` dismissal never fires
 * (RN's TextInputState doesn't know the native field is focused).
 *
 * Mounting the overlay ONLY while the keyboard is visible avoids both problems:
 * when no keyboard is up nothing intercepts taps (fields focus normally); once a
 * field is focused, the overlay appears and a tap anywhere off the field issues a
 * window-level `KeyboardController.dismiss()`, which resigns the native responder.
 *
 * Place it as the last child of a flex container so it covers its siblings while
 * mounted. While the keyboard is up it captures the next tap anywhere in that
 * container and consumes it (the tap dismisses rather than activating the control
 * underneath) — this matches React Native's classic `keyboardShouldPersistTaps`
 * = "never" behavior, which is what these screens had before the native field.
 */
export function DismissKeyboardOverlay() {
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

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
  },
});
