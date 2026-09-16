import { useEffect, useState } from "react";
import { KeyboardController, KeyboardEvents } from "react-native-keyboard-controller";

/**
 * Native: true from the moment the software keyboard starts to appear until the
 * moment it finishes disappearing.
 *
 * NativeTabs binds this to `hidden`. A transient will-hide/will-show pair can
 * occur when password visibility hands focus between SwiftUI fields. Revealing
 * the tab bar on will-hide requests native layout inside that keyboard/focus
 * transition. Wait for did-hide, matching KeyboardController's visibility
 * timing, so an interrupted dismissal keeps the tab bar hidden.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => KeyboardController.isVisible());

  useEffect(() => {
    const subscriptions = [
      KeyboardEvents.addListener("keyboardWillShow", () => setVisible(true)),
      KeyboardEvents.addListener("keyboardDidHide", () => setVisible(false)),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return visible;
}
