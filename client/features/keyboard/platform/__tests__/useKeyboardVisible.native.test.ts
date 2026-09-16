import { renderHook, act } from "@testing-library/react-native";

import { useKeyboardVisible } from "../useKeyboardVisible.native";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

/**
 * The tab layout hides the native tab bar behind this hook. Keep it hidden
 * through focus handoffs; a will-hide event does not mean dismissal completed.
 */
describe("useKeyboardVisible (native)", () => {
  afterEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false });
  });

  it("starts from the controller's current visibility", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true });

    const { result } = await renderHook(() => useKeyboardVisible());

    expect(result.current).toBe(true);
  });

  it("turns on when the keyboard starts to appear", async () => {
    const { result } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);

    await act(() => {
      keyboardControllerMock.__emitKeyboardEvent("keyboardWillShow", { height: 336 });
    });

    expect(result.current).toBe(true);
  });

  it("stays on until keyboard dismissal finishes", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true });
    const { result } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(true);

    // The controller's own `isVisible` still reports true until `keyboardDidHide`.
    await act(() => {
      keyboardControllerMock.__emitKeyboardEvent("keyboardWillHide");
    });

    expect(result.current).toBe(true);
    expect(keyboardControllerMock.KeyboardController.isVisible()).toBe(true);

    await act(() => {
      keyboardControllerMock.__setKeyboardState({ isVisible: false });
      keyboardControllerMock.__emitKeyboardEvent("keyboardDidHide");
    });

    expect(result.current).toBe(false);
  });

  it("does not reveal the tab bar during repeated hide/show focus handoffs", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true });
    const { result } = await renderHook(() => useKeyboardVisible());

    // Flush each event separately: batching them would hide a transient false
    // value that can send a tab-bar layout transaction to UIKit on a device.
    for (let handoff = 0; handoff < 25; handoff += 1) {
      await act(() => {
        keyboardControllerMock.__emitKeyboardEvent("keyboardWillHide");
      });
      expect(result.current).toBe(true);

      await act(() => {
        keyboardControllerMock.__emitKeyboardEvent("keyboardWillShow", { height: 336 });
      });
      expect(result.current).toBe(true);
    }

    await act(() => {
      keyboardControllerMock.__setKeyboardState({ isVisible: false });
      keyboardControllerMock.__emitKeyboardEvent("keyboardDidHide");
    });
    expect(result.current).toBe(false);
  });

  it("turns off on didHide when mounted mid-dismissal", async () => {
    // Mounted mid-dismissal: the initial read is still true; only didHide is left to fire.
    keyboardControllerMock.__setKeyboardState({ isVisible: true });
    const { result } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(true);

    await act(() => {
      keyboardControllerMock.__setKeyboardState({ isVisible: false });
      keyboardControllerMock.__emitKeyboardEvent("keyboardDidHide");
    });

    expect(result.current).toBe(false);
  });

  it("removes its listeners on unmount", async () => {
    const events = ["keyboardWillShow", "keyboardWillHide", "keyboardDidHide"];
    const before = events.map((event) => keyboardControllerMock.__keyboardEventListenerCount(event));
    const { unmount } = await renderHook(() => useKeyboardVisible());
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardWillShow")).toBe(before[0] + 1);
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardWillHide")).toBe(before[1]);
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardDidHide")).toBe(before[2] + 1);

    await unmount();

    events.forEach((event, index) => {
      expect(keyboardControllerMock.__keyboardEventListenerCount(event)).toBe(before[index]);
    });
  });
});
