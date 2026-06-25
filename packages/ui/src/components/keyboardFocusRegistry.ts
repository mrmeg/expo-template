import type { GestureResponderEvent } from "react-native";
import type { FocusedInputLayoutChangedEvent } from "react-native-keyboard-controller";

export type KeyboardFocusedInputLayout = FocusedInputLayoutChangedEvent["layout"];
export type KeyboardFocusedInputToken = object;

const FOCUSED_INPUT_TOUCH_SLOP = 16;

let focusedInput:
  | {
      token: KeyboardFocusedInputToken;
      layout: KeyboardFocusedInputLayout;
    }
  | null = null;

export function setKeyboardFocusedInputLayout(
  token: KeyboardFocusedInputToken,
  layout: KeyboardFocusedInputLayout
) {
  focusedInput = { token, layout };
}

export function clearKeyboardFocusedInputLayout(token: KeyboardFocusedInputToken) {
  if (focusedInput?.token === token) {
    focusedInput = null;
  }
}

export function getKeyboardFocusedInputLayout() {
  return focusedInput?.layout;
}

function isTouchInsideLayout(
  event: GestureResponderEvent,
  layout: KeyboardFocusedInputLayout | null | undefined
) {
  if (!layout) return false;

  const { pageX, pageY } = event.nativeEvent;
  const left = layout.absoluteX - FOCUSED_INPUT_TOUCH_SLOP;
  const right = layout.absoluteX + layout.width + FOCUSED_INPUT_TOUCH_SLOP;
  const top = layout.absoluteY - FOCUSED_INPUT_TOUCH_SLOP;
  const bottom = layout.absoluteY + layout.height + FOCUSED_INPUT_TOUCH_SLOP;

  return pageX >= left && pageX <= right && pageY >= top && pageY <= bottom;
}

export function isTouchInsideKeyboardFocusedInput(
  event: GestureResponderEvent,
  nativeLayout?: KeyboardFocusedInputLayout | null
) {
  return (
    isTouchInsideLayout(event, getKeyboardFocusedInputLayout()) ||
    isTouchInsideLayout(event, nativeLayout)
  );
}
