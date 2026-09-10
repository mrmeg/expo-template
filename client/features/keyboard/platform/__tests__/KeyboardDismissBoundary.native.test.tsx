import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import {
  clearKeyboardFocusedInput,
  setKeyboardFocusedInput,
} from "@mrmeg/expo-ui/components/keyboardFocusRegistry";
import { markTextInputTouchStart } from "@mrmeg/expo-ui/components/keyboardDismiss";

import { KeyboardDismissBoundary } from "../KeyboardDismissBoundary.native";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

type TouchEvent = { nativeEvent: Record<string, number | string> };

let nextTimestamp = 1000;

/** A touch phase event. Each call gets a fresh timestamp, like distinct native events. */
function touch(overrides: Record<string, number | string> = {}): TouchEvent {
  nextTimestamp += 16;
  return {
    nativeEvent: { identifier: "0", timestamp: nextTimestamp, pageX: 100, pageY: 200, ...overrides },
  };
}

type Boundary = { props: Record<string, (event?: TouchEvent) => unknown> };

/** Drive the responder negotiation and touch phases the way RN does for a tap. */
function tap(boundary: Boundary, start = touch(), end = touch()) {
  const claimed = boundary.props.onStartShouldSetResponder(start);
  boundary.props.onTouchStart(start);
  boundary.props.onTouchEnd(end);
  return claimed;
}

describe("KeyboardDismissBoundary", () => {
  const focusedInputToken = {};

  beforeEach(() => {
    jest.clearAllMocks();
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
    clearKeyboardFocusedInput(focusedInputToken);
  });

  async function renderBoundary(children: React.ReactNode = <View testID="content" />) {
    const result = await render(
      <KeyboardDismissBoundary testID="keyboard-boundary">{children}</KeyboardDismissBoundary>
    );

    return result.getByTestId("keyboard-boundary") as unknown as Boundary;
  }

  it("never claims the responder, so native controls and scroll views keep the touch", async () => {
    const boundary = await renderBoundary();

    expect(boundary.props.onStartShouldSetResponder(touch())).toBe(false);
  });

  it("dismisses on release for a tap nothing else claimed", async () => {
    const boundary = await renderBoundary();

    tap(boundary);

    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss on touch start", async () => {
    const boundary = await renderBoundary();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("prefers the focused native field's own blur handle", async () => {
    const blur = jest.fn();
    setKeyboardFocusedInput(focusedInputToken, blur);
    const boundary = await renderBoundary();

    tap(boundary);

    expect(blur).toHaveBeenCalledTimes(1);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("leaves touches that started on a text input to the native field", async () => {
    const boundary = await renderBoundary();
    const start = touch();

    // The TextInput surface's bubble handler runs first for the same event.
    expect(markTextInputTouchStart(start as never)).toBe(false);
    tap(boundary, start);

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("does not dismiss when the finger moved past the slop (a scroll)", async () => {
    const boundary = await renderBoundary();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchMove(touch({ pageY: 260 }));
    boundary.props.onTouchEnd(touch({ pageY: 260 }));

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("tolerates finger jitter within the slop", async () => {
    const boundary = await renderBoundary();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchMove(touch({ pageX: 104, pageY: 203 }));
    boundary.props.onTouchEnd(touch({ pageX: 104, pageY: 203 }));

    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });

  it("drops the tap when the touch is cancelled", async () => {
    const boundary = await renderBoundary();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchCancel(touch());
    boundary.props.onTouchEnd(touch());

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("ignores a release for a different touch than the one it recorded", async () => {
    const boundary = await renderBoundary();

    boundary.props.onStartShouldSetResponder(touch({ identifier: "1" }));
    boundary.props.onTouchStart(touch({ identifier: "1" }));
    boundary.props.onTouchEnd(touch({ identifier: "2" }));

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("does nothing when the keyboard is hidden and no field is focused", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false });
    const boundary = await renderBoundary();

    tap(boundary);

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("still blurs a focused native field when keyboard state has not caught up", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false });
    const blur = jest.fn();
    setKeyboardFocusedInput(focusedInputToken, blur);
    const boundary = await renderBoundary();

    tap(boundary);

    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("dismisses once when boundaries are nested", async () => {
    const result = await render(
      <KeyboardDismissBoundary testID="outer">
        <KeyboardDismissBoundary testID="inner">
          <View testID="content" />
        </KeyboardDismissBoundary>
      </KeyboardDismissBoundary>
    );
    const outer = result.getByTestId("outer") as unknown as Boundary;
    const inner = result.getByTestId("inner") as unknown as Boundary;
    const start = touch();
    const end = touch();

    // Bubble order: inner first, then outer, for the same native event.
    inner.props.onStartShouldSetResponder(start);
    outer.props.onStartShouldSetResponder(start);
    inner.props.onTouchStart(start);
    outer.props.onTouchStart(start);
    inner.props.onTouchEnd(end);
    outer.props.onTouchEnd(end);

    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });
});
