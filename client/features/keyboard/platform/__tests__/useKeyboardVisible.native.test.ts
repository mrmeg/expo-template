import { renderHook, act } from "@testing-library/react-native";

import { useKeyboardVisible } from "../useKeyboardVisible.native";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

/**
 * The tab layout hides the native tab bar behind this hook. The tab bar is
 * revealed without animation, so the hook must flip as soon as the keyboard
 * *starts* to move — not once it has finished — or the screen re-lays out twice.
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

  it("turns off as soon as the keyboard starts to hide, before didHide", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true });
    const { result } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(true);

    // The controller's own `isVisible` still reports true until `keyboardDidHide`.
    await act(() => {
      keyboardControllerMock.__emitKeyboardEvent("keyboardWillHide");
    });

    expect(result.current).toBe(false);
    expect(keyboardControllerMock.KeyboardController.isVisible()).toBe(true);
  });

  it("falls back to didHide when willHide was missed", async () => {
    // Mounted mid-dismissal: the initial read is still true and willHide is gone.
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
    const before = keyboardControllerMock.__keyboardEventListenerCount("keyboardWillHide");
    const { unmount } = await renderHook(() => useKeyboardVisible());
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardWillHide")).toBe(before + 1);

    await unmount();

    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardWillHide")).toBe(before);
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardWillShow")).toBe(before);
    expect(keyboardControllerMock.__keyboardEventListenerCount("keyboardDidHide")).toBe(before);
  });
});
