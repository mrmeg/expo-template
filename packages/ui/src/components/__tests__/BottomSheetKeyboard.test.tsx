/**
 * useBottomSheetKeyboardAnimation tests
 *
 * Locks in the keyboard-avoidance contract the BottomSheet relies on: the
 * exposed value is a *positive* keyboard height that animates 0 → keyboard px
 * on show and back to 0 on hide. The sheet uses this single source to both lift
 * its bottom and shrink its height, so the sign and resting value matter — a
 * regression here is what pushed tall sheets off the top of the screen.
 */

import { Animated, Keyboard } from "react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useBottomSheetKeyboardAnimation } from "../BottomSheetKeyboard";

function currentValue(value: Animated.Value): number {
  // __getValue is internal but stable, and the only sync way to read a value.
  return (value as unknown as { __getValue: () => number }).__getValue();
}

function mockKeyboardListeners() {
  const listeners: Record<string, (event: any) => void> = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: any) => {
    listeners[event] = cb;
    return { remove: jest.fn() };
  }) as typeof Keyboard.addListener);
  return {
    show: (height: number) =>
      (listeners.keyboardWillShow ?? listeners.keyboardDidShow)?.({
        endCoordinates: { height },
        duration: 10,
      }),
    hide: () =>
      (listeners.keyboardWillHide ?? listeners.keyboardDidHide)?.({ duration: 10 }),
  };
}

describe("useBottomSheetKeyboardAnimation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rests at 0 before the keyboard appears", () => {
    const { result } = renderHook(() => useBottomSheetKeyboardAnimation());
    expect(currentValue(result.current.height)).toBe(0);
  });

  it("animates to a positive keyboard height on show", async () => {
    const keyboard = mockKeyboardListeners();
    const { result } = renderHook(() => useBottomSheetKeyboardAnimation());

    keyboard.show(320);

    await waitFor(() => {
      expect(currentValue(result.current.height)).toBeCloseTo(320, 0);
    });
  });

  it("returns to 0 on hide", async () => {
    const keyboard = mockKeyboardListeners();
    const { result } = renderHook(() => useBottomSheetKeyboardAnimation());

    keyboard.show(320);
    await waitFor(() => {
      expect(currentValue(result.current.height)).toBeCloseTo(320, 0);
    });

    keyboard.hide();
    await waitFor(() => {
      expect(currentValue(result.current.height)).toBeCloseTo(0, 0);
    });
  });
});
