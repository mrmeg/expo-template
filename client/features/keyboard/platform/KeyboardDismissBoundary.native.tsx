import React from "react";
import { View, type ViewProps } from "react-native";
import { useKeyboardDismissResponder } from "@mrmeg/expo-ui/components/keyboardDismiss";

type KeyboardDismissBoundaryProps = ViewProps & {
  children: React.ReactNode;
};

/**
 * App-wide tap-away keyboard dismissal.
 *
 * Never claims the touch: Pressables, other text inputs and the focused field's
 * own gestures win the responder negotiation, and the keyboard is dismissed on
 * release only when nothing else took the tap and the finger did not move. See
 * `useKeyboardDismissResponder` in `@mrmeg/expo-ui` for the mechanism.
 */
export function KeyboardDismissBoundary({
  children,
  style,
  ...props
}: KeyboardDismissBoundaryProps) {
  const responderProps = useKeyboardDismissResponder();

  return (
    <View {...props} style={style} {...responderProps}>
      {children}
    </View>
  );
}
