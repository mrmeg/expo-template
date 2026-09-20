/**
 * Registry of the currently focused native (`@expo/ui`) text field.
 *
 * Hosted `@expo/ui` inputs also register with React Native's `TextInputState`.
 * This package registry supplies a window-independent native blur handle and
 * focus presence even when keyboard-controller cannot observe the keyboard
 * (for example, in an isolated native sheet window). The package `TextInput`
 * registers on focus; tap-away dismissal (`keyboardDismiss.ts`, mounted by
 * `DismissKeyboard` and `BottomSheet.Content`) resigns the field through that
 * handle.
 */
export type KeyboardFocusedInputToken = object;

let focusedInput:
  | {
      token: KeyboardFocusedInputToken;
      /**
       * Resigns the native field's first responder directly. Window-independent:
       * acts on the real SwiftUI/Compose field via its @expo/ui ref, so it works
       * even when the field lives in a separate native window (e.g. a native
       * bottom sheet) where `KeyboardController.dismiss()` may target the wrong
       * window and `useKeyboardState()` never observes the keyboard.
       */
      blur: () => void;
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

export function setKeyboardFocusedInput(token: KeyboardFocusedInputToken, blur: () => void) {
  const wasPresent = focusedInput != null;
  focusedInput = { token, blur };
  // Only notify subscribers on a presence transition; a focus handoff between
  // two fields keeps presence true and stays silent.
  if (!wasPresent) emit();
}

export function clearKeyboardFocusedInput(token: KeyboardFocusedInputToken) {
  // Token-guarded: when focus hops A -> B, B's focus can land before A's blur,
  // and A's late clear must not wipe B's registration.
  if (focusedInput?.token === token) {
    focusedInput = null;
    emit();
  }
}

/** Whether any native field currently holds focus. Stable boolean for snapshots. */
export function hasKeyboardFocusedInput() {
  return focusedInput != null;
}

/**
 * Resign the currently-focused native field, dismissing its keyboard. Returns
 * `true` if a field was focused and a blur handle was available.
 *
 * Presence is cleared here, in the same call, rather than left to the field's
 * later `onBlur`: consumers call `dismissKeyboard()` from submit handlers and
 * the native blur callback is not guaranteed to arrive (isolated sheet window,
 * iOS secure/plain handoff), which used to leave a stale registration behind.
 * The clear is token-guarded, so a field that takes focus synchronously during
 * `blur()` keeps its registration; the field's own later clear is idempotent.
 */
export function dismissKeyboardFocusedInput() {
  const entry = focusedInput;
  if (!entry) return false;
  entry.blur();
  clearKeyboardFocusedInput(entry.token);
  return true;
}
