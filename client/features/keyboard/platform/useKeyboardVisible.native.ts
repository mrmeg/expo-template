import { useEffect, useState } from "react";
import { KeyboardController, KeyboardEvents } from "react-native-keyboard-controller";

/**
 * Native: true from the moment the software keyboard starts to appear until the
 * moment it starts to disappear.
 *
 * Keyed to the `keyboardWill*` events on purpose. `useKeyboardState().isVisible`
 * only flips back on `keyboardDidHide`, i.e. after the hide animation has run.
 * The tab layout feeds this value to `NativeTabs`' `hidden` prop, and
 * react-native-screens reveals the bar without animation — so on `didHide` the
 * screen first re-laid out with the keyboard gone and no tab bar, then the bar
 * snapped in and shifted everything a second time. Flipping on `willHide` folds
 * the bar's reveal into the keyboard's own slide, so there is one motion.
 *
 * `keyboardDidHide` stays subscribed as a backstop: if this mounts mid-dismissal
 * the initial read is still true and `willHide` has already fired.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => KeyboardController.isVisible());

  useEffect(() => {
    const subscriptions = [
      KeyboardEvents.addListener("keyboardWillShow", () => setVisible(true)),
      KeyboardEvents.addListener("keyboardWillHide", () => setVisible(false)),
      KeyboardEvents.addListener("keyboardDidHide", () => setVisible(false)),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return visible;
}
