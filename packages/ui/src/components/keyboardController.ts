/**
 * Keyboard-controller indirection — web variant (inert stubs).
 *
 * `react-native-keyboard-controller` drags a large native animation runtime
 * into every bundle that imports it, and none of that code can run on web.
 * Components therefore import the keyboard API from this module instead of the
 * package: Metro resolves `keyboardController.native.ts` (the real re-exports)
 * on iOS/Android and this file on web, so the package never reaches the web
 * bundle.
 *
 * Both variants are typed against the package's own types — type-only imports
 * are erased at compile time and bundle nothing — so the two files stay
 * interchangeable to the type checker. TypeScript always resolves this `.ts`
 * variant for consumers, which is why the stubs must keep the full native
 * signatures.
 *
 * Every stub here is a plain function that calls no hooks, so the `use*`
 * exports are safe from any call site (rules of hooks can't be violated by a
 * function that has no hook calls of its own).
 */
import React from "react";
import { View } from "react-native";
import type {
  IKeyboardState,
  KeyboardAnimationContext,
  KeyboardAvoidingViewProps,
  KeyboardControllerModule,
  KeyboardEventData,
} from "react-native-keyboard-controller";

/** There is no software keyboard to observe on web, so state is constant. */
const HIDDEN_KEYBOARD_STATE: IKeyboardState = {
  isVisible: false,
  height: 0,
  duration: 0,
  timestamp: 0,
  target: -1,
  type: "default",
  appearance: "light",
};

/**
 * Inert keyboard context.
 *
 * The real context exposes animation values that only exist alongside the
 * native module, so this is a minimal stand-in cast to the package's type: the
 * only field consumers read on web-capable paths is `layout.value`. It is a
 * module-level singleton because `DismissKeyboard` puts the context object in a
 * `useCallback` dependency list — a fresh object per call would invalidate it
 * on every render.
 */
const INERT_KEYBOARD_CONTEXT = {
  enabled: false,
  layout: { value: null },
  update: () => Promise.resolve(),
  setKeyboardHandlers: () => () => undefined,
  setInputHandlers: () => () => undefined,
  setEnabled: () => undefined,
} as unknown as KeyboardAnimationContext;

/** No-op imperative module: there is no IME to dismiss or preload on web. */
export const KeyboardController: KeyboardControllerModule = {
  setDefaultMode: () => undefined,
  setInputMode: () => undefined,
  preload: () => undefined,
  dismiss: () => Promise.resolve(),
  setFocusTo: () => undefined,
  isVisible: () => false,
  state: () => HIDDEN_KEYBOARD_STATE as KeyboardEventData,
};

/**
 * Applies `selector` to a permanently "keyboard hidden" state.
 *
 * @param selector - Picks the fields a caller needs from the keyboard state.
 * @returns The selected value, or the whole state when no selector is given.
 */
export function useKeyboardState<T = IKeyboardState>(
  selector?: (state: IKeyboardState) => T
): T {
  return selector ? selector(HIDDEN_KEYBOARD_STATE) : (HIDDEN_KEYBOARD_STATE as unknown as T);
}

/**
 * @returns A stable, empty keyboard context (no focused input layout on web).
 */
export function useKeyboardContext(): KeyboardAnimationContext {
  return INERT_KEYBOARD_CONTEXT;
}

type NativeKeyboardAvoidingViewProps = KeyboardAvoidingViewProps & {
  children?: React.ReactNode;
};

/**
 * Plain `View` passthrough. Keyboard-avoidance props are accepted (so callers
 * stay identical across platforms) and dropped, since the browser handles
 * viewport resizing itself.
 */
export function NativeKeyboardAvoidingView({
  behavior,
  contentContainerStyle,
  keyboardVerticalOffset,
  automaticOffset,
  enabled,
  children,
  ...viewProps
}: NativeKeyboardAvoidingViewProps) {
  // Dropped rather than forwarded so they never reach the DOM node.
  void behavior;
  void contentContainerStyle;
  void keyboardVerticalOffset;
  void automaticOffset;
  void enabled;

  return React.createElement(View, viewProps, children);
}
