/**
 * Keyboard-controller indirection — native variant.
 *
 * Re-exports the real `react-native-keyboard-controller` API under the names the
 * package's components import. See `keyboardController.ts` (the web variant)
 * for why the components go through this module instead of importing the
 * package directly.
 */
export {
  KeyboardController,
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  useKeyboardContext,
  useKeyboardState,
} from "react-native-keyboard-controller";
