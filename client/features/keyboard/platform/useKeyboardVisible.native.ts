import { useKeyboardState } from "react-native-keyboard-controller";

/**
 * Native: true while the software keyboard is shown.
 */
export function useKeyboardVisible(): boolean {
  return useKeyboardState((state) => state.isVisible);
}
