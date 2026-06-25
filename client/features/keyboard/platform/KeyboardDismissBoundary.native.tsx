import React, { useCallback } from "react";
import {
  View,
  type GestureResponderEvent,
  type ViewProps,
} from "react-native";
import {
  KeyboardController,
  useKeyboardContext,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { isTouchInsideKeyboardFocusedInput } from "@mrmeg/expo-ui/components/keyboardFocusRegistry";

type KeyboardDismissBoundaryProps = ViewProps & {
  children: React.ReactNode;
};

export function KeyboardDismissBoundary({
  children,
  style,
  ...props
}: KeyboardDismissBoundaryProps) {
  const isVisible = useKeyboardState((state) => state.isVisible);
  const { layout: focusedInput } = useKeyboardContext();

  const dismissOnTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (isVisible) {
        if (isTouchInsideKeyboardFocusedInput(event, focusedInput.value?.layout)) {
          return false;
        }

        KeyboardController.dismiss();
      }

      return false;
    },
    [focusedInput, isVisible]
  );

  return (
    <View
      {...props}
      style={style}
      onStartShouldSetResponderCapture={dismissOnTouchStart}
    >
      {children}
    </View>
  );
}
