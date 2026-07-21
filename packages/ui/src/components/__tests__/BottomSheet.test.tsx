import React from "react";
import { Platform, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BottomSheet } from "../BottomSheet";

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
    BottomSheet: ({ children, index, handleComponent }: any) => (
      <View
        testID="native-bottom-sheet"
        accessibilityLabel={handleComponent === null ? "custom-handle" : "native-handle"}
        accessibilityValue={{ now: index }}
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
