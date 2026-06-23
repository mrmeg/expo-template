import React, { useCallback } from "react";
import { View, type GestureResponderEvent, type ViewStyle } from "react-native";
import { KeyboardController, useKeyboardState } from "react-native-keyboard-controller";

type KeyboardDismissBoundaryProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function KeyboardDismissBoundary({ children, style }: KeyboardDismissBoundaryProps) {
  const isVisible = useKeyboardState((state) => state.isVisible);

  const dismissOnTouchStart = useCallback(
    (_event: GestureResponderEvent) => {
      if (isVisible) {
        KeyboardController.dismiss();
      }

      return false;
    },
    [isVisible]
  );

  return (
    <View
      style={style}
      onStartShouldSetResponderCapture={dismissOnTouchStart}
    >
      {children}
    </View>
  );
}
