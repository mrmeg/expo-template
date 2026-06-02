import { useEffect, useRef } from "react";
import { Animated, Keyboard, Platform } from "react-native";

function animateKeyboardOffset(value: Animated.Value, toValue: number, duration = 180) {
  Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: true,
  }).start();
}

export function useBottomSheetKeyboardAnimation() {
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      animateKeyboardOffset(
        keyboardHeight,
        -event.endCoordinates.height,
        event.duration || 180
      );
    });
    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      animateKeyboardOffset(keyboardHeight, 0, event.duration || 160);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardHeight]);

  return { height: keyboardHeight };
}

export const BottomSheetKeyboardController = {
  dismiss() {
    Keyboard.dismiss();
  },
};
