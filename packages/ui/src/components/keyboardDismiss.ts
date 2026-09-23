/**
 * Tap-away keyboard dismissal that never steals a touch.
 *
 * Let the deepest interactive view win the responder negotiation, and blur on
 * release only for an unclaimed, single-finger tap within the travel slop.
 * Hosted `@expo/ui` inputs register with RN's `TextInputState`. A ScrollView
 * using `keyboardShouldPersistTaps="handled"` can therefore claim dead space
 * and blur on release if it observed no scroll, even after substantial travel.
 * `DismissKeyboard`'s ScrollView uses `always` so this boundary owns tap dismissal
 * with an explicit travel policy, independent of whether content can scroll.
 * Two signals need no rectangles and no responder ownership:
 *
 *  1. `onStartShouldSetResponder` in the *bubble* phase is only ever called on a
 *     view when no descendant claimed the touch. Pressables and RN TextInputs
 *     claim, as can scroll views depending on their tap policy. Being asked
 *     means no descendant took responder ownership, not necessarily dead space.
 *  2. The package `TextInput` tags touches that begin on its surface
 *     (`markTextInputTouchStart`). Its bubble handler runs before any enclosing
 *     boundary's, so the boundary can tell a tap on *any* native field — focused
 *     or not — from dead space, and leave focus handoff, double-tap selection
 *     and the eye toggle to the platform.
 *
 * The boundary always answers `false`, so it never becomes the JS responder.
 * Native controls (SwiftUI/Compose fields, sliders) keep receiving every touch phase
 * on both platforms, and scroll views take over drags exactly as before.
 * Dismissal happens in `onTouchEnd`, a plain bubbling event that fires whether
 * or not anyone became the responder. Moves cancel permanently once past the
 * slop; release coordinates also enforce it when move delivery was missed.
 * Cancellation and multitouch drop the tap without rearming another finger.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Platform, type GestureResponderEvent, type ViewProps } from "react-native";
import { KeyboardController, useKeyboardState } from "./keyboardController";
import { dismissKeyboardFocusedInput, hasKeyboardFocusedInput } from "./keyboardFocusRegistry";

/** Maximum displacement per axis (RN logical units) for a tap, scrollable or not. */
const MOVE_SLOP = 10;

// Only equality matters here, so the identifier is kept exactly as RN reports it.
type TouchKey = { identifier: number; timestamp: number };

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
// An ancestor can observe a second finger outside an inner boundary/surface.
// Invalidate already-armed taps there too, even if that finger lifts first and
// the inner view only receives its original finger's final touches=[] event.
let multiTouchVersion = 0;

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

/** Shared single-finger travel policy for tap-away dismissal and surface focus. */
function createTapTracker() {
  let pending: PendingTap | null = null;
  let armedVersion = multiTouchVersion;
  let lastStart: TouchKey | null = null;
  const active = new Set<TouchKey["identifier"]>();

  function readTouches(event: GestureResponderEvent) {
    const { touches } = event.nativeEvent;
    if (touches == null) return false;
    active.clear();
    touches.forEach(({ identifier }) => active.add(identifier));
    return true;
  }

  return {
    start(event: GestureResponderEvent) {
      // Negotiation precedes the plain bubbling touch-start for the same event.
      // Observe it once; a child-claimed start reaches only onTouchStart, which
      // clears any stale pending tap but never arms one.
      if (isSameEvent(lastStart, event)) return false;
      lastStart = keyOf(event);
      pending = null;
      // RN's array is authoritative, including after a missed end. The set is
      // also a fallback for callers/tests omitting arrays, retaining other down
      // fingers even after movement has cancelled the pending tap.
      if (!readTouches(event)) active.add(event.nativeEvent.identifier);
      if (active.size > 1 || (event.nativeEvent.changedTouches?.length ?? 1) > 1) {
        multiTouchVersion += 1;
        return false;
      }
      return active.size === 1;
    },
    arm(event: GestureResponderEvent) {
      pending = { ...keyOf(event), pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY };
      armedVersion = multiTouchVersion;
    },
    move(event: GestureResponderEvent) {
      readTouches(event);
      if (active.size > 1 || (event.nativeEvent.changedTouches?.length ?? 1) > 1) {
        multiTouchVersion += 1;
        pending = null;
      } else if (isSameTouch(pending, event) && movedPastSlop(pending, event)) {
        pending = null;
      }
    },
    end(event: GestureResponderEvent) {
      const tap = pending;
      pending = null;
      // On touch end, touches contains the REMAINING fingers (empty on the last
      // release); changedTouches contains those that ended. Never treat the
      // final empty array as an invalid single-finger tap.
      if (!readTouches(event)) {
        active.delete(event.nativeEvent.identifier);
        event.nativeEvent.changedTouches?.forEach(({ identifier }) => active.delete(identifier));
      }
      if (active.size === 0) lastStart = null;
      if (active.size > 0 || (event.nativeEvent.changedTouches?.length ?? 1) > 1) {
        multiTouchVersion += 1;
      }
      return (
        armedVersion === multiTouchVersion &&
        active.size === 0 &&
        (event.nativeEvent.changedTouches?.length ?? 1) <= 1 &&
        isSameTouch(tap, event) &&
        !movedPastSlop(tap, event)
      );
    },
  };
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
  // Latest `focus` for the memoized handlers, synced after each commit (before
  // any touch can be dispatched) instead of written during render.
  const focusRef = useRef(focus);
  useLayoutEffect(() => {
    focusRef.current = focus;
  });
  return useMemo<TextInputSurfaceResponderProps>(() => {
    const tap = createTapTracker();
    return {
      onStartShouldSetResponder: (event) => {
        markTextInputTouchStart(event);
        if (tap.start(event)) tap.arm(event);
        return false;
      },
      onTouchStart: (event) => {
        tap.start(event);
      },
      onTouchMove: (event) => {
        tap.move(event);
      },
      onTouchEnd: (event) => {
        if (tap.end(event)) focusRef.current();
      },
      onTouchCancel: (event) => {
        tap.end(event);
      },
    };
  }, []);
}

export type AncestorClaimWarningProps = Pick<
  ViewProps,
  "onStartShouldSetResponderCapture" | "onTouchStart"
>;

let warnedAncestorClaim = false;

/** Test hook: let the once-per-session ancestor-claim warning fire again. */
export function resetAncestorClaimWarningForTests() {
  warnedAncestorClaim = false;
}

/**
 * Dev-only diagnostic for a boundary whose subtree is drawn in another native
 * window but still lives in the screen's React tree (`BottomSheet.Content`).
 *
 * React Native's responder negotiation walks the React tree, so every ancestor
 * of the sheet takes part in the capture phase for a tap inside it, even though
 * none of them is under the finger. An ancestor `ScrollView` left on the default
 * `keyboardShouldPersistTaps="never"` claims the tap there as soon as a text
 * input holds focus and RN's `Keyboard` has reported the IME, and blurs the
 * field on release: the keyboard closes and the tapped control never fires.
 * Nothing inside the tree can preempt a capture-phase claim, so the boundary
 * names it instead.
 *
 * The signal needs no heuristics: `onStartShouldSetResponderCapture` runs on
 * this view for every touch that reaches the negotiation without an ancestor
 * claiming it, while `onTouchStart` bubbles regardless. A touch start with no
 * capture call for the same native event, while a package field is focused,
 * is exactly a tap an ancestor took. Warns once per session, Android only,
 * `__DEV__` only; elsewhere the inner props are returned untouched. The wrapped
 * `onTouchStart` still runs, so the boundary's own behavior is unchanged.
 */
export function useAncestorClaimWarning<P extends Pick<ViewProps, "onTouchStart">>(
  inner: P,
  message: string
): P & AncestorClaimWarningProps {
  const messageRef = useRef(message);
  useLayoutEffect(() => {
    messageRef.current = message;
  });
  return useMemo(() => {
    if (!__DEV__ || Platform.OS !== "android") return inner;
    let captured: TouchKey | null = null;
    return {
      ...inner,
      onStartShouldSetResponderCapture: (event: GestureResponderEvent) => {
        captured = keyOf(event);
        return false;
      },
      onTouchStart: (event: GestureResponderEvent) => {
        if (!warnedAncestorClaim && !isSameEvent(captured, event) && hasKeyboardFocusedInput()) {
          warnedAncestorClaim = true;
          console.warn(messageRef.current);
        }
        inner.onTouchStart?.(event);
      },
    };
  }, [inner]);
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
  useLayoutEffect(() => {
    isVisibleRef.current = isVisible;
  });

  return useMemo<KeyboardDismissResponderProps>(() => {
    if (Platform.OS === "web") return {};
    const tap = createTapTracker();

    return {
      onStartShouldSetResponder: (event) => {
        if (!tap.start(event)) return false;
        // `hasKeyboardFocusedInput` covers the window where a field has focus but
        // keyboard-controller has not reported the keyboard yet (or a hardware
        // keyboard is attached and there is no software keyboard to observe).
        if (!isVisibleRef.current && !hasKeyboardFocusedInput()) return false;
        if (isSameEvent(textInputTouch, event)) return false;
        // An inner boundary already runs this touch (bubble order is inner-first).
        if (isSameEvent(claimedTouch, event)) return false;
        claimedTouch = keyOf(event);
        tap.arm(event);
        return false;
      },
      onTouchStart: (event) => {
        tap.start(event);
      },
      onTouchMove: (event) => {
        tap.move(event);
      },
      onTouchEnd: (event) => {
        if (tap.end(event)) dismissKeyboard();
      },
      onTouchCancel: (event) => {
        tap.end(event);
      },
    };
  }, []);
}
