import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import {
  useKeyboardDismissResponder,
  useTextInputSurfaceResponder,
} from "../keyboardDismiss";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

type TouchEvent = { nativeEvent: Record<string, number | string> };
type Handlers = { props: Record<string, (event?: TouchEvent) => unknown> };

let nextTimestamp = 5000;

function touch(overrides: Record<string, number | string> = {}): TouchEvent {
  nextTimestamp += 16;
  return {
    nativeEvent: { identifier: "0", timestamp: nextTimestamp, pageX: 50, pageY: 60, ...overrides },
  };
}

function Surface({ onFocus }: { onFocus: () => void }) {
  const props = useTextInputSurfaceResponder(onFocus);
  return <View testID="surface" {...props} />;
}

function Boundary({ children }: { children: React.ReactNode }) {
  const props = useKeyboardDismissResponder();
  return (
    <View testID="boundary" {...props}>
      {children}
    </View>
  );
}

describe("useTextInputSurfaceResponder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  async function renderSurface() {
    const onFocus = jest.fn();
    const result = await render(
      <Boundary>
        <Surface onFocus={onFocus} />
      </Boundary>
    );
    return {
      onFocus,
      surface: result.getByTestId("surface") as unknown as Handlers,
      boundary: result.getByTestId("boundary") as unknown as Handlers,
    };
  }

  it("declines the responder so the native field keeps the touch", async () => {
    const { surface } = await renderSurface();

    expect(surface.props.onStartShouldSetResponder(touch())).toBe(false);
  });

  it("focuses the field on release of a tap nothing else claimed", async () => {
    const { surface, onFocus } = await renderSurface();
    const start = touch();

    surface.props.onStartShouldSetResponder(start);
    surface.props.onTouchStart(start);
    surface.props.onTouchEnd(touch());

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("does not focus when the finger moved (a scroll) or the touch was cancelled", async () => {
    const { surface, onFocus } = await renderSurface();

    let start = touch();
    surface.props.onStartShouldSetResponder(start);
    surface.props.onTouchStart(start);
    surface.props.onTouchMove(touch({ pageY: 120 }));
    surface.props.onTouchEnd(touch({ pageY: 120 }));

    start = touch();
    surface.props.onStartShouldSetResponder(start);
    surface.props.onTouchStart(start);
    surface.props.onTouchCancel(touch());
    surface.props.onTouchEnd(touch());

    expect(onFocus).not.toHaveBeenCalled();
  });

  it("does not focus for a touch a child claimed (e.g. the eye toggle)", async () => {
    const { surface, onFocus } = await renderSurface();
    // A claiming child stops the negotiation before the surface is asked, so
    // only the bubbling touch events reach it.
    const start = touch();
    surface.props.onTouchStart(start);
    surface.props.onTouchEnd(touch());

    expect(onFocus).not.toHaveBeenCalled();
  });

  it("keeps the tap-away boundary from dismissing for a touch on the surface", async () => {
    const { surface, boundary, onFocus } = await renderSurface();
    const start = touch();
    const end = touch();

    // Bubble order: the surface answers before the enclosing boundary.
    surface.props.onStartShouldSetResponder(start);
    boundary.props.onStartShouldSetResponder(start);
    surface.props.onTouchStart(start);
    boundary.props.onTouchStart(start);
    surface.props.onTouchEnd(end);
    boundary.props.onTouchEnd(end);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });
});
