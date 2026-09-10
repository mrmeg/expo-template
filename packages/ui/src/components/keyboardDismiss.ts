/**
 * Tap-away keyboard dismissal that never steals a touch.
 *
 * React Native's own `keyboardShouldPersistTaps="handled"` is the model: let the
 * deepest interactive view win the responder negotiation, and blur on *release*
 * only when nothing else took the tap and the finger did not scroll. RN cannot
 * apply that to the native `@expo/ui` field (it is invisible to
 * `TextInputState`), so this module re-creates the same decision with two
 * signals that need no rectangles and no responder ownership:
 *
 *  1. `onStartShouldSetResponder` in the *bubble* phase is only ever called on a
 *     view when no descendant claimed the touch. Pressables, RN TextInputs and
 *     scroll views all claim, so being asked at all means "this tap is on dead
 *     space or on a native view that does not participate".
 *  2. The package `TextInput` tags touches that begin on its surface
 *     (`markTextInputTouchStart`). Its bubble handler runs before any enclosing
 *     boundary's, so the boundary can tell a tap on *any* native field — focused
 *     or not — from dead space, and leave focus handoff, double-tap selection
 *     and the eye toggle to the platform.
 *
 * The boundary always answers `false`, so no JS responder is ever set: native
 * controls (SwiftUI/Compose fields, sliders) keep receiving every touch phase
 * on both platforms, and scroll views take over drags exactly as before.
 * Dismissal happens in `onTouchEnd`, a plain bubbling event that fires whether
 * or not anyone became the responder; a drag past the slop or a cancel drops it.
 */
import { useMemo, useRef } from "react";
import { Platform, type GestureResponderEvent, type ViewProps } from "react-native";
import { KeyboardController, useKeyboardState } from "./keyboardController";
import { dismissKeyboardFocusedInput, hasKeyboardFocusedInput } from "./keyboardFocusRegistry";

/** Finger travel (pt) after which a touch counts as a scroll, not a tap. */
const MOVE_SLOP = 10;

// RN types `identifier` as a string even though the runtime value is numeric;
// only equality matters here, so follow the type.
type TouchKey = { identifier: string; timestamp: number };

function keyOf(event: GestureResponderEvent): TouchKey {
  const { identifier, timestamp } = event.nativeEvent;
  return { identifier, timestamp };
}

/** Same native event: the responder negotiation hands one event to every listener. */
function isSameEvent(key: TouchKey | null, event: GestureResponderEvent) {
  return (
    key != null &&
    key.identifier === event.nativeEvent.identifier &&
    key.timestamp === event.nativeEvent.timestamp
  );
}

let textInputTouch: TouchKey | null = null;
let claimedTouch: TouchKey | null = null;

/**
 * `onStartShouldSetResponder` for a native text-field surface: decline the
 * responder (the native field keeps every touch phase) but tag the touch so an
 * enclosing tap-away boundary leaves it alone. The package `TextInput` uses
 * this through {@link useTextInputSurfaceResponder}.
 */
export function markTextInputTouchStart(event: GestureResponderEvent): boolean {
  textInputTouch = keyOf(event);
  return false;
}

/**
 * Hide the software keyboard for whatever is focused. Prefers the registered
 * native field's own blur handle (window-independent), then falls back to
 * `KeyboardController.dismiss()`, which resigns at the IME level and covers RN
 * or third-party inputs. No-op on web, which has no software keyboard to hide.
 */
export function dismissKeyboard() {
  if (Platform.OS === "web") return;
  if (!dismissKeyboardFocusedInput()) {
    void KeyboardController.dismiss();
  }
}

type PendingTap = TouchKey & { pageX: number; pageY: number };

function isSameTouch(tap: PendingTap | null, event: GestureResponderEvent): tap is PendingTap {
  return tap != null && tap.identifier === event.nativeEvent.identifier;
}

function movedPastSlop(tap: PendingTap, event: GestureResponderEvent) {
  return (
    Math.abs(event.nativeEvent.pageX - tap.pageX) > MOVE_SLOP ||
    Math.abs(event.nativeEvent.pageY - tap.pageY) > MOVE_SLOP
  );
}

export type TextInputSurfaceResponderProps = Pick<
  ViewProps,
  "onStartShouldSetResponder" | "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel"
>;

/**
 * View props for the painted surface around a native (`@expo/ui`) text field.
 *
 * Two jobs. It tags every touch that begins on the surface so the tap-away
 * boundary leaves it alone (see {@link markTextInputTouchStart}). And it
 * focuses the field on release of a tap that no child claimed: the SwiftUI
 * `TextField` only hit-tests its text line, so taps on the box's vertical
 * padding never reach it, and a tap on the field's `hitSlop` never can. Calling
 * `focus` is idempotent when the native field already took the tap, and the eye
 * toggle is a `Pressable` that claims the responder first, so it never fires
 * for that.
 */
export function useTextInputSurfaceResponder(focus: () => void): TextInputSurfaceResponderProps {
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const tap = useRef<PendingTap | null>(null);

  return useMemo<TextInputSurfaceResponderProps>(
    () => ({
      onStartShouldSetResponder: (event) => {
        markTextInputTouchStart(event);
        tap.current = { ...keyOf(event), pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY };
        return false;
      },
      onTouchStart: (event) => {
        if (tap.current && !isSameEvent(tap.current, event)) tap.current = null;
      },
      onTouchMove: (event) => {
        if (isSameTouch(tap.current, event) && movedPastSlop(tap.current, event)) tap.current = null;
      },
      onTouchEnd: (event) => {
        if (!isSameTouch(tap.current, event)) return;
        tap.current = null;
        focusRef.current();
      },
      onTouchCancel: () => {
        tap.current = null;
      },
    }),
    []
  );
}

export type KeyboardDismissResponderProps = Pick<
  ViewProps,
  "onStartShouldSetResponder" | "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel"
>;

/**
 * View props for a tap-away keyboard-dismiss boundary. Spread onto the wrapper
 * `View` that encloses the screen (or a form). Nesting is safe: the innermost
 * boundary owns each touch, so the keyboard is dismissed once. Returns `{}` on
 * web.
 */
export function useKeyboardDismissResponder(): KeyboardDismissResponderProps {
  const isVisible = useKeyboardState((state) => state.isVisible);
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;
  const pending = useRef<PendingTap | null>(null);

  return useMemo<KeyboardDismissResponderProps>(() => {
    if (Platform.OS === "web") return {};

    return {
      onStartShouldSetResponder: (event) => {
        pending.current = null;
        // `hasKeyboardFocusedInput` covers the window where a field has focus but
        // keyboard-controller has not reported the keyboard yet (or a hardware
        // keyboard is attached and there is no software keyboard to observe).
        if (!isVisibleRef.current && !hasKeyboardFocusedInput()) return false;
        if (isSameEvent(textInputTouch, event)) return false;
        // An inner boundary already runs this touch (bubble order is inner-first).
        if (isSameEvent(claimedTouch, event)) return false;
        claimedTouch = keyOf(event);
        pending.current = { ...claimedTouch, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY };
        return false;
      },
      onTouchStart: (event) => {
        // Bubbling touch events run after the negotiation for the same native
        // event, so a fresh pending tap matches here; anything else is stale
        // (e.g. a touch whose end never reached this view).
        if (pending.current && !isSameEvent(pending.current, event)) pending.current = null;
      },
      onTouchMove: (event) => {
        if (isSameTouch(pending.current, event) && movedPastSlop(pending.current, event)) {
          pending.current = null;
        }
      },
      onTouchEnd: (event) => {
        if (!isSameTouch(pending.current, event)) return;
        pending.current = null;
        dismissKeyboard();
      },
      onTouchCancel: () => {
        pending.current = null;
      },
    };
  }, []);
}
