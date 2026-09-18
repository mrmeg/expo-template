import React from "react";
import { Dimensions, Platform, Pressable, StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
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
