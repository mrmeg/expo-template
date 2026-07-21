import type { GestureResponderEvent } from "react-native";
import type { FocusedInputLayoutChangedEvent } from "react-native-keyboard-controller";

export type KeyboardFocusedInputLayout = FocusedInputLayoutChangedEvent["layout"];
export type KeyboardFocusedInputToken = object;

const FOCUSED_INPUT_TOUCH_SLOP = 16;

let focusedInput:
  | {
      token: KeyboardFocusedInputToken;
      layout: KeyboardFocusedInputLayout;
      /**
       * Resigns the native field's first responder directly. Window-independent:
       * acts on the real SwiftUI/Compose field via its @expo/ui ref, so it works
       * even when the field lives in a separate native window (e.g. a native
       * bottom sheet) where `KeyboardController.dismiss()` may target the wrong
       * window and `useKeyboardState()` never observes the keyboard.
       */
      blur?: () => void;
    }
  | null = null;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * Subscribe to focus presence changes. Pairs with {@link hasKeyboardFocusedInput}
 * via `useSyncExternalStore` so a component can mount/unmount with focus WITHOUT
 * `react-native-keyboard-controller`'s `useKeyboardState` — which doesn't observe
 * keyboards raised inside a native sheet's isolated window.
 */
export function subscribeKeyboardFocus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setKeyboardFocusedInputLayout(
  token: KeyboardFocusedInputToken,
  layout: KeyboardFocusedInputLayout,
  blur?: () => void
) {
  const wasPresent = focusedInput != null;
  focusedInput = { token, layout, blur };
  // Only notify subscribers on a presence transition; re-measures (scroll,
  // layout) update the layout silently so the overlay doesn't churn.
  if (!wasPresent) emit();
}

export function clearKeyboardFocusedInputLayout(token: KeyboardFocusedInputToken) {
  if (focusedInput?.token === token) {
    focusedInput = null;
    emit();
  }
}

export function getKeyboardFocusedInputLayout() {
  return focusedInput?.layout;
}

/** Whether any native field currently holds focus. Stable boolean for snapshots. */
export function hasKeyboardFocusedInput() {
  return focusedInput != null;
}

/**
 * Resign the currently-focused native field, dismissing its keyboard. Returns
 * `true` if a field was focused and a blur handle was available.
 */
export function dismissKeyboardFocusedInput() {
  if (focusedInput?.blur) {
    focusedInput.blur();
    return true;
  }
  return false;
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
