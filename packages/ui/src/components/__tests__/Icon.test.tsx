import React from "react";
import { StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Icon } from "../Icon";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#0F172A",
        primaryForeground: "#FFFFFF",
        secondary: "#6366F1",
        muted: "#F1F5F9",
        destructive: "#EF4444",
        success: "#22C55E",
        warning: "#F59E0B",
        text: "#111827",
        textDim: "#6B7280",
      },
    },
  }),
}));

describe("Icon", () => {
  it("renders web font icons inside a View without raw text-node warnings", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = args.map(String).join(" ");
      if (message.includes("Unexpected text node")) {
        throw new Error(message);
      }
    });

    let testRenderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = TestRenderer.create(
        <View>
          <Icon name="mic" style={{ marginRight: 4 }} />
          <Icon name="mic-off" decorative />
        </View>
      );
    });

    expect(
      consoleError.mock.calls.some((args) =>
        args.map(String).join(" ").includes("Unexpected text node")
      )
    ).toBe(false);

    const icons = (testRenderer?.root.findAllByProps({ testID: "icon-Feather" }) ?? [])
      .filter((node) => node.type === View);
    expect(icons).toHaveLength(2);
    expect(StyleSheet.flatten(icons[0].props.style)).toEqual(
      expect.objectContaining({
        marginRight: 4,
        pointerEvents: "none",
      })
    );
    expect(icons[0].props.accessible).toBe(true);
    expect(icons[1].props.accessible).toBe(false);
    expect(icons[1].props.importantForAccessibility).toBe("no-hide-descendants");
    expect(icons[1].props.accessibilityElementsHidden).toBe(true);
    expect(icons[1].props["aria-hidden"]).toBe(true);
  });
});
