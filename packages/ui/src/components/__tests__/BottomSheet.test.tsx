import React from "react";
import {
  DeviceEventEmitter,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { BottomSheet } from "../BottomSheet";
import {
  clearKeyboardFocusedInput,
  hasKeyboardFocusedInput,
  setKeyboardFocusedInput,
} from "../keyboardFocusRegistry";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

type Touch = { identifier: number | string };
type TouchEvent = { nativeEvent: Record<string, number | string | Touch[]> };
type Handlers = { props: Record<string, (event?: TouchEvent) => unknown> & { style?: unknown } };

let nextTimestamp = 5000;

/** Same shape as keyboardDismiss.test.tsx: a single-finger touch at (50, 60). */
function touch(overrides: TouchEvent["nativeEvent"] = {}): TouchEvent {
  nextTimestamp += 16;
  return {
    nativeEvent: { identifier: "0", timestamp: nextTimestamp, pageX: 50, pageY: 60, ...overrides },
  };
}

/** Flip Platform.OS for one render, restoring it afterwards. */
async function withPlatform<T>(os: string, run: () => Promise<T>) {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  try {
    return await run();
  } finally {
    Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
  }
}

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        card: "#FFFFFF",
        foreground: "#111111",
        mutedForeground: "#737373",
        secondary: "#F5F5F5",
        border: "#E5E5E5",
      },
    },
  }),
}));

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    BottomSheet: ({ children, index, handleComponent, backgroundStyle }: any) => (
      <View
        testID="native-bottom-sheet"
        accessibilityLabel={handleComponent === null ? "custom-handle" : "native-handle"}
        accessibilityValue={{ now: index }}
        backgroundStyle={backgroundStyle}
      >
        {children}
      </View>
    ),
  };
});

describe("BottomSheet.Handle", () => {
  it("walks through snap points and reverses direction at each end", async () => {
    await render(
      <BottomSheet open snapPoints={["25%", "50%", "90%"]}>
        <BottomSheet.Content>
          <BottomSheet.Handle />
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );

    const currentIndex = () =>
      screen.getByTestId("native-bottom-sheet").props.accessibilityValue.now;
    const handle = screen.getByLabelText("Change sheet height");

    expect(currentIndex()).toBe(2);
    await fireEvent.press(handle);
    expect(currentIndex()).toBe(1);
    await fireEvent.press(handle);
    expect(currentIndex()).toBe(0);
    await fireEvent.press(handle);
    expect(currentIndex()).toBe(1);
  });

  it("hides the native indicator only when the interactive Handle is present", async () => {
    const { rerender } = await render(
      <BottomSheet open snapPoints={["25%", "90%"]}>
        <BottomSheet.Content>
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("native-bottom-sheet").props.accessibilityLabel).toBe(
      "native-handle"
    );

    await rerender(
      <BottomSheet open snapPoints={["25%", "90%"]}>
        <BottomSheet.Content>
          <BottomSheet.Handle />
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("native-bottom-sheet").props.accessibilityLabel).toBe(
      "custom-handle"
    );
  });

  it("skips middle snap points on Android, matching Material sheet states", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });

    try {
      await render(
        <BottomSheet open snapPoints={["25%", "50%", "90%"]}>
          <BottomSheet.Content>
            <BottomSheet.Handle />
          </BottomSheet.Content>
        </BottomSheet>
      );

      const currentIndex = () =>
        screen.getByTestId("native-bottom-sheet").props.accessibilityValue.now;
      const handle = screen.getByLabelText("Change sheet height");

      expect(currentIndex()).toBe(2);
      await fireEvent.press(handle);
      expect(currentIndex()).toBe(0);
      await fireEvent.press(handle);
      expect(currentIndex()).toBe(2);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
    }
  });

  it("disables the Handle when there is nowhere to snap", async () => {
    await render(
      <BottomSheet open snapPoints={["50%"]}>
        <BottomSheet.Content>
          <BottomSheet.Handle />
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByLabelText("Change sheet height").props.accessibilityState.disabled).toBe(
      true
    );
  });
});

describe("BottomSheet.Body", () => {
  it("keeps scrollability measurement updates stable", async () => {
    await render(
      <BottomSheet open snapPoints={["50%"]}>
        <BottomSheet.Content>
          <BottomSheet.Body testID="sheet-body">
            <Text>Scrollable content</Text>
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    );

    const body = screen.getByTestId("sheet-body");

    await fireEvent(body, "layout", {
      nativeEvent: { layout: { height: 100 } },
    });
    await fireEvent(body, "contentSizeChange", 320, 200);

    expect(screen.getByLabelText("Close")).toBeTruthy();

    await fireEvent(body, "layout", {
      nativeEvent: { layout: { height: 100 } },
    });
    await fireEvent(body, "contentSizeChange", 320, 200);

    expect(screen.getByLabelText("Close")).toBeTruthy();
  });

  it("registers header and footer without update loops", async () => {
    await render(
      <BottomSheet open snapPoints={["50%"]}>
        <BottomSheet.Content>
          <BottomSheet.Header>
            <Text>Header</Text>
          </BottomSheet.Header>
          <BottomSheet.Body testID="sheet-body">
            <Text>Body</Text>
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <Text>Footer</Text>
          </BottomSheet.Footer>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByText("Header")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });
});

describe("BottomSheet.Content backgroundStyle", () => {
  it("themes the native sheet surface with the card color by default", async () => {
    await render(
      <BottomSheet open>
        <BottomSheet.Content>
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("native-bottom-sheet").props.backgroundStyle).toEqual({
      backgroundColor: "#FFFFFF",
    });
  });

  it("merges a backgroundStyle override over the card default", async () => {
    await render(
      <BottomSheet open>
        <BottomSheet.Content backgroundStyle={{ backgroundColor: "transparent" }}>
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("native-bottom-sheet").props.backgroundStyle).toEqual({
      backgroundColor: "transparent",
    });
  });
});

describe("BottomSheet.Body keyboard taps", () => {
  const token = {};

  beforeEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    clearKeyboardFocusedInput(token);
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  it("renders keyboardShouldPersistTaps=\"always\" by default so RN never claims the first tap", async () => {
    await render(
      <BottomSheet open snapPoints={["50%"]}>
        <BottomSheet.Content>
          <BottomSheet.Body testID="sheet-body">
            <Text>Body</Text>
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("sheet-body").props.keyboardShouldPersistTaps).toBe("always");
  });

  it("preserves an explicit consumer keyboardShouldPersistTaps value", async () => {
    await render(
      <BottomSheet open snapPoints={["50%"]}>
        <BottomSheet.Content>
          <BottomSheet.Body testID="sheet-body" keyboardShouldPersistTaps="handled">
            <Text>Body</Text>
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    );

    expect(screen.getByTestId("sheet-body").props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("fires a control inside Body on the first tap without blurring the focused field", async () => {
    const blur = jest.fn();
    setKeyboardFocusedInput(token, blur);
    const onPress = jest.fn();
    await render(
      <BottomSheet open snapPoints={["55%"]}>
        <BottomSheet.Content testID="sheet-column">
          <BottomSheet.Body testID="sheet-body">
            <Pressable testID="body-control" onPress={onPress}>
              <Text>In stock</Text>
            </Pressable>
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    );
    const column = screen.getByTestId("sheet-column") as unknown as Handlers;

    // Same shape as the Content boundary case: the Pressable claims the touch,
    // so only the plain touch events bubble to the column.
    const start = touch();
    column.props.onTouchStart(start);
    await fireEvent.press(screen.getByTestId("body-control"));
    column.props.onTouchEnd(touch());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("still dismisses an unclaimed dead-space tap on the column with a Body mounted", async () => {
    const blur = jest.fn();
    setKeyboardFocusedInput(token, blur);
    await render(
      <BottomSheet open snapPoints={["55%"]}>
        <BottomSheet.Content testID="sheet-column">
          <BottomSheet.Body testID="sheet-body">
            <Text>Body</Text>
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    );
    const column = screen.getByTestId("sheet-column") as unknown as Handlers;
    const start = touch();

    expect(column.props.onStartShouldSetResponder(start)).toBe(false);
    column.props.onTouchStart(start);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);

    column.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
  });
});

describe("BottomSheet.Content keyboard dismiss boundary", () => {
  const token = {};

  beforeEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    clearKeyboardFocusedInput(token);
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  async function setup() {
    const blur = jest.fn();
    setKeyboardFocusedInput(token, blur);
    const onPress = jest.fn();
    await render(
      <BottomSheet open snapPoints={["55%"]}>
        <BottomSheet.Content testID="sheet-column">
          <Pressable testID="control" onPress={onPress}>
            <Text>Save</Text>
          </Pressable>
        </BottomSheet.Content>
      </BottomSheet>
    );
    const column = screen.getByTestId("sheet-column") as unknown as Handlers;
    return { blur, onPress, column };
  }

  it("mounts no overlay and never claims the responder", async () => {
    const { column } = await setup();

    expect(screen.queryByLabelText("Dismiss keyboard")).toBeNull();
    expect(column.props.onStartShouldSetResponder(touch())).toBe(false);
  });

  it("dismisses an unclaimed dead-space tap on release and drops focus presence", async () => {
    const { column, blur } = await setup();
    const start = touch();

    expect(column.props.onStartShouldSetResponder(start)).toBe(false);
    column.props.onTouchStart(start);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);

    column.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("does not dismiss a tap that travels 12 units before release", async () => {
    const { column, blur } = await setup();
    const start = touch();

    column.props.onStartShouldSetResponder(start);
    column.props.onTouchStart(start);
    column.props.onTouchMove(touch({ pageY: 72 }));
    column.props.onTouchEnd(touch({ pageY: 72 }));

    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("does not dismiss a touch a child claimed, so the control fires on the first tap", async () => {
    const { column, blur, onPress } = await setup();
    // A claiming child (the Pressable) ends the bubble negotiation before the
    // column is asked; only the plain touch events still bubble up to it.
    const start = touch();
    column.props.onTouchStart(start);
    await fireEvent.press(screen.getByTestId("control"));
    column.props.onTouchEnd(touch());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("arms from focus-registry presence alone when keyboard-controller cannot see the sheet keyboard", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
    const { column, blur } = await setup();
    const start = touch();

    column.props.onStartShouldSetResponder(start);
    column.props.onTouchStart(start);
    column.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
  });
});

describe("BottomSheet.Content column height", () => {
  type SnapPoints = NonNullable<React.ComponentProps<typeof BottomSheet>["snapPoints"]>;

  async function columnStyle(snapPoints: SnapPoints) {
    await render(
      <BottomSheet open snapPoints={snapPoints}>
        <BottomSheet.Content testID="sheet-column">
          <Text>Sheet content</Text>
        </BottomSheet.Content>
      </BottomSheet>
    );
    return StyleSheet.flatten(screen.getByTestId("sheet-column").props.style) as Record<
      string,
      unknown
    >;
  }

  it("caps the column at a percentage detent of the window on iOS", async () => {
    const style = await columnStyle(["55%"]);
    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBe(0.55 * Dimensions.get("window").height);
  });

  it("caps the column at a fixed detent on iOS", async () => {
    const style = await columnStyle([320]);
    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBe(320);
  });

  it("lets the column fill the Material host on Android with no maxHeight", async () => {
    await withPlatform("android", async () => {
      const style = await columnStyle(["55%"]);
      expect(style.flex).toBe(1);
      expect(style).not.toHaveProperty("maxHeight");
    });
  });
});

describe("BottomSheet.Content keyboard avoidance is platform-owned", () => {
  // Device-verified (iPhone 17 Pro, iOS 27, @expo/ui 58): UIKit's sheet
  // presentation keeps the hosted column above the keyboard by itself — a 45%
  // sheet is lifted whole, a 92% one is shrunk — so the column's bottom edge
  // already lands at the keyboard's top and any JS inset would stack on it.
  // `measureInWindow` inside the sheet host is host-relative (the 45% column
  // reported bottom 409 while sitting at screen y 546), so no measured inset
  // can be right either. The column must observe no keyboard and pad nothing.
  const measureInWindow = (View.prototype as unknown as { measureInWindow: jest.Mock })
    .measureInWindow;
  let addListener: jest.SpyInstance;

  function columnStyle() {
    return StyleSheet.flatten(screen.getByTestId("sheet-column").props.style) as Record<
      string,
      unknown
    >;
  }

  function renderSheet(avoidKeyboard?: boolean, style?: Record<string, unknown>) {
    return render(
      <BottomSheet open snapPoints={["45%"]}>
        <BottomSheet.Content testID="sheet-column" avoidKeyboard={avoidKeyboard} style={style}>
          <BottomSheet.Body>
            <Text>Body</Text>
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <Text>Footer</Text>
          </BottomSheet.Footer>
        </BottomSheet.Content>
      </BottomSheet>
    );
  }

  /** What the device reported for a 45% sheet with the keyboard up. */
  const deviceKeyboardFrame = {
    endCoordinates: { screenX: 0, screenY: 546, width: 402, height: 328 },
    startCoordinates: { screenX: 0, screenY: 874, width: 402, height: 328 },
    duration: 250,
    easing: "keyboard",
    isEventFromThisApp: true,
  };

  beforeEach(() => {
    addListener = jest.spyOn(Keyboard, "addListener");
    // Host-relative, as on device: the column starts 16 below the host top.
    measureInWindow.mockImplementation((cb: (...args: number[]) => void) => cb(0, 16, 402, 393));
  });

  afterEach(() => {
    addListener.mockRestore();
    measureInWindow.mockReset();
  });

  it.each([undefined, true, false])(
    "subscribes to no keyboard event and measures nothing on iOS (avoidKeyboard=%s)",
    async (avoidKeyboard) => {
      await renderSheet(avoidKeyboard);

      expect(addListener).not.toHaveBeenCalled();
      expect(measureInWindow).not.toHaveBeenCalled();
      expect(columnStyle()).not.toHaveProperty("paddingBottom");
    }
  );

  it("keeps the column unpadded through keyboard frame events on iOS", async () => {
    await renderSheet(undefined, { paddingBottom: 8 });

    await act(async () => {
      DeviceEventEmitter.emit("keyboardWillChangeFrame", deviceKeyboardFrame);
      DeviceEventEmitter.emit("keyboardDidChangeFrame", deviceKeyboardFrame);
      DeviceEventEmitter.emit("keyboardDidShow", deviceKeyboardFrame);
    });

    // A consumer's own paddingBottom survives untouched: 8, not 8 + overlap.
    expect(columnStyle().paddingBottom).toBe(8);
    expect(measureInWindow).not.toHaveBeenCalled();
  });

  it("adds no paddingBottom on Android, where Material3 owns avoidance", async () => {
    await withPlatform("android", async () => {
      await renderSheet();

      expect(addListener).not.toHaveBeenCalled();
      expect(columnStyle()).not.toHaveProperty("paddingBottom");
    });
  });
});
