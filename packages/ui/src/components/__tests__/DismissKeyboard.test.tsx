import React from "react";
import { act, render } from "@testing-library/react-native";
import { Keyboard, Platform, Pressable, ScrollView, View } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { DismissKeyboard } from "../DismissKeyboard";
import { clearKeyboardFocusedInput, setKeyboardFocusedInput } from "../keyboardFocusRegistry";

// The preset's ScrollView mock only forwards props. These tests need RN's real
// responder handlers and TextInputState; only the native host/commands are mocked.
jest.unmock("react-native/Libraries/Components/ScrollView/ScrollView");
const TextInputState = require("react-native/Libraries/Components/TextInput/TextInputState").default;
const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

let timestamp = 10000;
function touch(target: unknown, end = false, pageX = 50, pageY = 60) {
  timestamp += 16;
  return {
    target,
    currentTarget: target,
    persist: jest.fn(),
    nativeEvent: {
      target, identifier: 0, timestamp, pageX, pageY,
      touches: end ? [] : [{ identifier: 0 }],
    },
  };
}

describe("DismissKeyboard ScrollView ownership", () => {
  const token = {};
  let field: unknown;

  beforeEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
    // RNTL hosts are not Fabric nodes. Stub only the final native dispatch,
    // leaving RN's registration, focus state, and blur decision intact.
    for (const module of [
      require("react-native/Libraries/Components/TextInput/RCTSingelineTextInputNativeComponent"),
      require("react-native/Libraries/Components/TextInput/AndroidTextInputNativeComponent"),
    ]) jest.spyOn(module.Commands, "blur").mockImplementation(() => {});
    // Supply real keyboard metrics to ScrollView's dismissibility check.
    jest.spyOn(Keyboard, "metrics").mockReturnValue({
      height: 300, width: 400, screenX: 0, screenY: 500,
    });
  });

  afterEach(() => {
    TextInputState.blurInput(field);
    TextInputState.unregisterInput(field);
    clearKeyboardFocusedInput(token);
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  async function setup() {
    const ref = React.createRef<React.ComponentRef<typeof View>>();
    const controlRef = React.createRef<React.ComponentRef<typeof View>>();
    const onPress = jest.fn();
    const result = await render(
      <DismissKeyboard avoidKeyboard={false}>
        <View ref={ref} testID="hosted-field" />
        <View testID="dead-space" />
        <Pressable ref={controlRef} testID="control" onPress={onPress}><View /></Pressable>
      </DismissKeyboard>
    );
    field = ref.current;
    expect(field).not.toBeNull();
    // @expo/ui registers its hosted field with these same RN APIs. Keep the
    // focused host distinct from the dead-space/control event target.
    TextInputState.registerInput(field);
    TextInputState.focusInput(field);
    expect(TextInputState.isTextInput(field)).toBe(true);
    const blur = jest.fn(() => TextInputState.blurInput(field));
    setKeyboardFocusedInput(token, blur);
    const rnBlur = jest.spyOn(TextInputState, "blurTextInput");
    const boundary = result.root!;
    const [scroll] = boundary.queryAll((node) => !!node.props.onResponderRelease && !!node.props.onScroll);
    expect(scroll).toBeDefined();
    const target = result.getByTestId("dead-space");

    const start = (event = touch(target)) => {
      const captured = scroll.props.onStartShouldSetResponderCapture(event);
      const claimed = captured || scroll.props.onStartShouldSetResponder(event);
      if (claimed) scroll.props.onResponderGrant(event);
      else expect(boundary.props.onStartShouldSetResponder(event)).toBe(false);
      scroll.props.onTouchStart(event);
      boundary.props.onTouchStart(event);
      return claimed;
    };
    const end = (claimed: boolean, event = touch(target, true)) => {
      if (claimed) scroll.props.onResponderRelease(event);
      scroll.props.onTouchEnd(event);
      boundary.props.onTouchEnd(event);
    };
    return { result, scroll, boundary, target, blur, rnBlur, onPress, controlTarget: controlRef.current, start, end };
  }

  it("gives the nonclaiming package boundary sole ownership of a dead-space tap", async () => {
    const { start, end, blur, rnBlur } = await setup();
    const claimed = start();
    expect(blur).not.toHaveBeenCalled();
    end(claimed);
    expect(blur).toHaveBeenCalledTimes(1);
    expect(rnBlur).not.toHaveBeenCalled();
    expect(claimed).toBe(false);
    expect(TextInputState.currentlyFocusedInput()).toBeNull();
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it.each([
    ["horizontal", 157, 60],
    ["vertical without scroll range", 50, 167],
  ])("keeps host focus after a 107pt %s drag with no move/onScroll events", async (_, x, y) => {
    const { target, start, end, blur, rnBlur } = await setup();
    const claimed = start();
    end(claimed, touch(target, true, x, y));
    expect(TextInputState.currentlyFocusedInput()).toBe(field);
    expect(blur).not.toHaveBeenCalled();
    expect(rnBlur).not.toHaveBeenCalled();
    expect(claimed).toBe(false);
  });

  it("documents RN handled's independent blur when travel produces no onScroll", async () => {
    const ref = React.createRef<React.ComponentRef<typeof View>>();
    const result = await render(
      <ScrollView keyboardShouldPersistTaps="handled">
        <View ref={ref} />
        <View testID="dead-space" />
      </ScrollView>
    );
    field = ref.current;
    TextInputState.registerInput(field);
    TextInputState.focusInput(field);
    const scroll = result.root!;
    const target = result.getByTestId("dead-space");
    const event = touch(target);
    expect(scroll.props.onStartShouldSetResponderCapture(event)).toBe(false);
    expect(scroll.props.onStartShouldSetResponder(event)).toBe(true);
    scroll.props.onResponderGrant(event);
    scroll.props.onTouchStart(event);
    scroll.props.onResponderRelease(touch(target, true, 157));
    expect(TextInputState.currentlyFocusedInput()).toBeNull();
  });

  it("lets a real Pressable claim and act without dismissing", async () => {
    const { result, scroll, boundary, onPress, controlTarget, blur, rnBlur } = await setup();
    const control = result.getByTestId("control");
    const start = touch(controlTarget);
    expect(scroll.props.onStartShouldSetResponderCapture(start)).toBe(false);
    expect(control.props.onStartShouldSetResponder(start)).toBe(true);
    // A child claim ends bubble negotiation; ordinary touch events still bubble.
    await act(() => {
      control.props.onResponderGrant(start);
      scroll.props.onTouchStart(start);
      boundary.props.onTouchStart(start);
      const end = touch(controlTarget, true);
      control.props.onResponderRelease(end);
      scroll.props.onTouchEnd(end);
      boundary.props.onTouchEnd(end);
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
    expect(rnBlur).not.toHaveBeenCalled();
    expect(TextInputState.currentlyFocusedInput()).toBe(field);
  });

  it("preserves Android dismissal on an actual scroll-begin event", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const { scroll, boundary, target, start, end, blur, rnBlur } = await setup();
    expect(start()).toBe(false);
    boundary.props.onTouchMove(touch(target, false, 50, 100));
    scroll.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(blur).toHaveBeenCalledTimes(1);
    expect(TextInputState.currentlyFocusedInput()).toBeNull();
    // Native scrolling can still acquire the responder after the declined start.
    expect(scroll.props.onScrollShouldSetResponder()).toBe(true);
    scroll.props.onResponderGrant(touch(target, false, 50, 100));
    scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 40 } } });
    end(true, touch(target, true, 50, 100));
    expect(blur).toHaveBeenCalledTimes(1);
    expect(rnBlur).not.toHaveBeenCalled();
  });

  it("preserves the iOS interactive native mode while yielding actual scrolling", async () => {
    const { scroll, boundary, target, start, end, blur, rnBlur } = await setup();
    expect(scroll.props.keyboardDismissMode).toBe("interactive");
    expect(start()).toBe(false);
    boundary.props.onTouchMove(touch(target, false, 50, 100));
    scroll.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(scroll.props.onScrollShouldSetResponder()).toBe(true);
    scroll.props.onResponderGrant(touch(target, false, 50, 100));
    scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 40 } } });
    end(true, touch(target, true, 50, 100));
    expect(blur).not.toHaveBeenCalled();
    expect(rnBlur).not.toHaveBeenCalled();
    // UIKit's interactive keyboard animation itself needs device validation.
  });
});
