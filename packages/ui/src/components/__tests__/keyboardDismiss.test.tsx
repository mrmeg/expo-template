import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import {
  useKeyboardDismissResponder,
  useTextInputSurfaceResponder,
} from "../keyboardDismiss";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

type Touch = { identifier: number | string };
type TouchEvent = {
  nativeEvent: Record<string, number | string | Touch[]>;
};
type Handlers = { props: Record<string, (event?: TouchEvent) => unknown> };

let nextTimestamp = 5000;

function touch(overrides: TouchEvent["nativeEvent"] = {}): TouchEvent {
  nextTimestamp += 16;
  return {
    nativeEvent: { identifier: "0", timestamp: nextTimestamp, pageX: 50, pageY: 60, ...overrides },
  };
}

function Surface({ onFocus }: { onFocus: () => void }) {
  const props = useTextInputSurfaceResponder(onFocus);
  return <View testID="surface" {...props} />;
}

function Boundary({ children, testID = "boundary" }: { children: React.ReactNode; testID?: string }) {
  const props = useKeyboardDismissResponder();
  return (
    <View testID={testID} {...props}>
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

// Exercise the same travel/multitouch policy for both consumers. The earlier
// tests intentionally omit touch arrays; these also cover RN's remaining-touch
// arrays, including touches=[] on the final release.
describe.each(["boundary", "surface"] as const)("%s tap policy", (kind) => {
  beforeEach(() => {
    jest.clearAllMocks();
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  async function setup() {
    const focus = jest.fn();
    const result = await render(
      <Boundary><Surface onFocus={focus} /></Boundary>
    );
    const { props } = result.getByTestId(kind) as unknown as Handlers;
    const action = kind === "surface" ? focus : KeyboardController.dismiss;
    const start = (event = touch({ touches: [{ identifier: "0" }] })) => {
      expect(props.onStartShouldSetResponder(event)).toBe(false);
      props.onTouchStart(event);
    };
    return { props, action, start };
  }

  it.each([
    ["right", { pageX: 157 }],
    ["left", { pageX: -57 }],
    ["down", { pageY: 167 }],
    ["up", { pageY: -47 }],
  ])("rejects a displaced release %s when no move was delivered", async (_, position) => {
    const { props, action, start } = await setup();
    start();
    props.onTouchEnd(touch({ ...position, touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it.each(["pageX", "pageY"])("keeps cancellation sticky after %s travel returns to the origin", async (axis) => {
    const { props, action, start } = await setup();
    start();
    props.onTouchMove(touch({ [axis]: 100 }));
    props.onTouchMove(touch());
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it.each([
    ["minor jitter", { pageX: 54, pageY: 57 }],
    ["the inclusive per-axis slop", { pageX: 60, pageY: 50 }],
  ])("accepts %s and fires only on release", async (_, position) => {
    const { props, action, start } = await setup();
    start();
    props.onTouchMove(touch(position));
    expect(action).not.toHaveBeenCalled();
    props.onTouchEnd(touch({ ...position, touches: [] }));
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("rejects a cancelled touch, then accepts a fresh tap reusing its id", async () => {
    const { props, action, start } = await setup();
    start();
    props.onTouchCancel(touch({ touches: [] }));
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).not.toHaveBeenCalled();
    start();
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each([0, "0"])("keeps identifier %p exact through release", async (identifier) => {
    const { props, action, start } = await setup();
    start(touch({ identifier }));
    props.onTouchEnd(touch({ identifier: identifier === 0 ? "0" : 0 }));
    expect(action).not.toHaveBeenCalled();
    start(touch({ identifier }));
    props.onTouchEnd(touch({ identifier, touches: [] }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("cancels two fingers without rearming the second (reverse release: %s)", async (reverse) => {
    const { props, action, start } = await setup();
    start();
    start(touch({ identifier: "1", touches: [{ identifier: "0" }, { identifier: "1" }] }));
    const [first, last] = reverse ? ["1", "0"] : ["0", "1"];
    props.onTouchEnd(touch({ identifier: first, touches: [{ identifier: last }] }));
    props.onTouchEnd(touch({ identifier: last, touches: [] }));
    expect(action).not.toHaveBeenCalled();
    // A later independent tap may reuse either native identifier.
    start(touch({ identifier: last, touches: [{ identifier: last }] }));
    props.onTouchEnd(touch({ identifier: last, touches: [] }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("cancels overlapping starts even without arrays (reverse release: %s)", async (reverse) => {
    const { props, action, start } = await setup();
    start(touch());
    start(touch({ identifier: "1" }));
    const ids = reverse ? ["1", "0"] : ["0", "1"];
    ids.forEach((identifier) => props.onTouchEnd(touch({ identifier })));
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects a first observed event that already has two touches", async () => {
    const { props, action, start } = await setup();
    start(touch({ touches: [{ identifier: "0" }, { identifier: "1" }] }));
    props.onTouchEnd(touch({ touches: [{ identifier: "1" }] }));
    props.onTouchEnd(touch({ identifier: "1", touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it("cancels when a second touch is first observed on move or release", async () => {
    const { props, action, start } = await setup();
    start();
    props.onTouchMove(touch({ touches: [{ identifier: "0" }, { identifier: "1" }] }));
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).not.toHaveBeenCalled();
    start();
    props.onTouchEnd(touch({ touches: [{ identifier: "1" }] }));
    props.onTouchEnd(touch({ identifier: "1", touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects a simultaneous two-finger release even if its starts were missed", async () => {
    const { props, action, start } = await setup();
    start();
    props.onTouchEnd(touch({ touches: [], changedTouches: [{ identifier: "0" }, { identifier: "1" }] }));
    expect(action).not.toHaveBeenCalled();
  });

  it("does not rearm after travel cancellation when a second finger joins", async () => {
    const { props, action, start } = await setup();
    start();
    props.onTouchMove(touch({ pageX: 157 }));
    start(touch({ identifier: "1", touches: [{ identifier: "0" }, { identifier: "1" }] }));
    props.onTouchEnd(touch({ identifier: "1", touches: [{ identifier: "0" }] }));
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it("drops a stale pending tap when a child claims the next touch with the same id", async () => {
    const { props, action, start } = await setup();
    start();
    // The earlier touch end was lost. A claiming child stops the next bubble
    // negotiation before this view, but plain touch events still bubble here.
    props.onTouchStart(touch({ touches: [{ identifier: "0" }] }));
    props.onTouchEnd(touch({ touches: [] }));
    expect(action).not.toHaveBeenCalled();
  });

  it("cancels an inner tap when a second finger starts and finishes outside it", async () => {
    const focus = jest.fn();
    const result = await render(
      <Boundary testID="outer">
        {kind === "surface" ? <Surface onFocus={focus} /> : <Boundary><View /></Boundary>}
        <View testID="sibling" />
      </Boundary>
    );
    const inner = (result.getByTestId(kind) as unknown as Handlers).props;
    const outer = (result.getByTestId("outer") as unknown as Handlers).props;
    const first = touch({ touches: [{ identifier: "0" }] });
    inner.onStartShouldSetResponder(first);
    outer.onStartShouldSetResponder(first);
    inner.onTouchStart(first);
    outer.onTouchStart(first);
    // Only the common ancestor sees this finger's events. Its release happens
    // first, so the inner view's final touch array contains no evidence of it.
    const second = touch({ identifier: "1", touches: [{ identifier: "0" }, { identifier: "1" }] });
    outer.onStartShouldSetResponder(second);
    outer.onTouchStart(second);
    outer.onTouchEnd(touch({ identifier: "1", touches: [{ identifier: "0" }] }));
    const end = touch({ touches: [] });
    inner.onTouchEnd(end);
    outer.onTouchEnd(end);
    expect(focus).not.toHaveBeenCalled();
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();

    // Cancellation/dedup/tags must not poison the next tap reusing the id.
    const next = touch({ touches: [{ identifier: "0" }] });
    inner.onStartShouldSetResponder(next);
    outer.onStartShouldSetResponder(next);
    inner.onTouchStart(next);
    outer.onTouchStart(next);
    const nextEnd = touch({ touches: [] });
    inner.onTouchEnd(nextEnd);
    outer.onTouchEnd(nextEnd);
    expect(kind === "surface" ? focus : KeyboardController.dismiss).toHaveBeenCalledTimes(1);
    expect(kind === "surface" ? KeyboardController.dismiss : focus).not.toHaveBeenCalled();
  });
});
