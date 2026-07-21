import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import {
  clearKeyboardFocusedInputLayout,
  setKeyboardFocusedInputLayout,
} from "@mrmeg/expo-ui/components/keyboardFocusRegistry";

import { KeyboardDismissBoundary } from "../KeyboardDismissBoundary.native";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

const focusedInputLayout = {
  x: 0,
  y: 0,
  width: 180,
  height: 44,
  absoluteX: 40,
  absoluteY: 100,
};
const focusedInputToken = {};

describe("KeyboardDismissBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
    keyboardControllerMock.__setFocusedInputLayout(focusedInputLayout);
  });

  afterEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
    keyboardControllerMock.__setFocusedInputLayout(null);
    clearKeyboardFocusedInputLayout(focusedInputToken);
  });

  async function renderBoundary() {
    const result = await render(
      <KeyboardDismissBoundary testID="keyboard-boundary">
        <View testID="content" />
      </KeyboardDismissBoundary>
    );

    return result.getByTestId("keyboard-boundary");
  }

  it("keeps the keyboard open for touches inside the focused input", async () => {
    const boundary = await renderBoundary();

    const shouldCapture = boundary.props.onStartShouldSetResponderCapture({
      nativeEvent: { pageX: 80, pageY: 120 },
    });

    expect(shouldCapture).toBe(false);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("dismisses the keyboard for touches outside the focused input", async () => {
    const boundary = await renderBoundary();

    const shouldCapture = boundary.props.onStartShouldSetResponderCapture({
      nativeEvent: { pageX: 20, pageY: 40 },
    });

    expect(shouldCapture).toBe(false);
    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });

  it("uses the package TextInput focused layout when native layout is unavailable", async () => {
    keyboardControllerMock.__setFocusedInputLayout(null);
    setKeyboardFocusedInputLayout(focusedInputToken, focusedInputLayout);
    const boundary = await renderBoundary();

    const shouldCapture = boundary.props.onStartShouldSetResponderCapture({
      nativeEvent: { pageX: 80, pageY: 120 },
    });

    expect(shouldCapture).toBe(false);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("does nothing when the keyboard is already hidden", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false });
    const boundary = await renderBoundary();

    const shouldCapture = boundary.props.onStartShouldSetResponderCapture({
      nativeEvent: { pageX: 20, pageY: 40 },
    });

    expect(shouldCapture).toBe(false);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });
});
