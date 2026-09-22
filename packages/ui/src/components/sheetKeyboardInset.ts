/**
 * Measured keyboard inset for the `BottomSheet.Content` column (iOS only).
 *
 * The native sheet hosts the RN column in its own `UIWindow` outside the app's
 * `KeyboardProvider`, and `@expo/ui`'s community sheet forwards no keyboard
 * behavior to SwiftUI, so nothing in the package otherwise knows where the
 * keyboard is. RN core's iOS keyboard events are process-wide
 * `UIKeyboard*Notification`s, so they do arrive here, and `measureInWindow`
 * inside the sheet reports coordinates in the sheet's own full-screen window —
 * comparable with `endCoordinates.screenY`. The inset is the same computation
 * RN's `KeyboardAvoidingView` uses: the part of the column that the keyboard
 * covers, less the inset the column's `Footer` / `Body` already pad for the
 * home indicator. It is therefore a no-op whenever SwiftUI already shrank the
 * host (the column bottom sits above the keyboard).
 *
 * Android is Material3's: RN's Android keyboard events are read from the main
 * `ReactRootView`'s IME insets, and the Compose dialog window hosts the sheet
 * in a plain view group, so no JS keyboard signal exists inside the sheet. Web
 * has no software keyboard to measure. Both return a constant 0 inset.
 *
 * This module must import only `react-native`; it is deliberately independent
 * of `react-native-keyboard-controller`, which observes the main window only.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type View,
} from "react-native";

/** Host instance of the RN `View` the column renders (measurable). */
type ColumnHandle = React.ComponentRef<typeof View>;

/**
 * Height of the column that the keyboard covers, net of the inset the column
 * already pads (so existing home-indicator padding counts toward clearance
 * instead of stacking above the keyboard). Never negative.
 */
export function keyboardOverlap(
  columnBottom: number,
  keyboardTop: number,
  absorbedInset: number
): number {
  return Math.max(0, columnBottom - keyboardTop - absorbedInset);
}

export interface SheetKeyboardInsetOptions {
  /** `false` opts out: no subscriptions, no measurement, inset 0. */
  enabled: boolean;
  /** Bottom inset the column's children already pad (home indicator). */
  absorbedInset: number;
}

export interface SheetKeyboardInset {
  /** Attach to the content column so it can be measured in the sheet window. */
  columnRef: React.RefObject<ColumnHandle | null>;
  /** Attach to the content column; re-measures after the host re-lays out. */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Extra bottom padding that keeps the column's tail above the keyboard. */
  paddingBottom: number;
}

/**
 * Subscribes to RN `Keyboard` frame events on iOS and measures the column
 * against the keyboard's top edge. Inactive (constant 0, nothing subscribed)
 * when `enabled` is false or off iOS.
 */
export function useSheetKeyboardInset({
  enabled,
  absorbedInset,
}: SheetKeyboardInsetOptions): SheetKeyboardInset {
  const active = enabled && Platform.OS === "ios";
  const columnRef = useRef<ColumnHandle | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const absorbedRef = useRef(absorbedInset);
  absorbedRef.current = absorbedInset;
  // Bumped whenever a measurement's result must be discarded (a newer request
  // superseded it, or the hook unsubscribed), so late callbacks are dropped.
  const ticket = useRef(0);
  const [paddingBottom, setPaddingBottom] = useState(0);

  const measure = useCallback(() => {
    const top = keyboardTop.current;
    const current = ++ticket.current;
    if (top == null) {
      setPaddingBottom(0);
      return;
    }
    const column = columnRef.current;
    if (!column) return;
    column.measureInWindow((_x, y, _w, h) => {
      if (current !== ticket.current) return;
      setPaddingBottom(keyboardOverlap(y + h, top, absorbedRef.current));
    });
  }, []);

  useEffect(() => {
    if (!active) {
      keyboardTop.current = null;
      setPaddingBottom(0);
      return;
    }
    const onFrame = (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates.screenY;
      measure();
    };
    const onHide = () => {
      keyboardTop.current = null;
      measure();
    };
    const frame = Keyboard.addListener("keyboardDidChangeFrame", onFrame);
    const hide = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      frame.remove();
      hide.remove();
      ticket.current++;
      keyboardTop.current = null;
    };
  }, [active, measure]);

  // A changed absorbed inset (safe-area provider settled) re-nets a known frame.
  useEffect(() => {
    if (active && keyboardTop.current != null) measure();
  }, [absorbedInset, active, measure]);

  const onLayout = useCallback(() => {
    if (active) measure();
  }, [active, measure]);

  return { columnRef, onLayout, paddingBottom: active ? paddingBottom : 0 };
}
