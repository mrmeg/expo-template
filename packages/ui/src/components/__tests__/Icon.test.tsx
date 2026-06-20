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
        foreground: "#0A0A0A",
        accent: "#14B8A6",
      },
    },
  }),
}));

function iconColorOf(element: React.ReactElement): string {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const node = renderer!.root.findByProps({ testID: "icon-Feather" });
  return node.props.color;
}

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

  it("resolves any theme color name to its semantic value", () => {
    // Includes tokens beyond the old hard-coded shortcut list (foreground, accent),
    // which previously fell through as invalid literal strings.
    expect(iconColorOf(<Icon name="box" color="accent" />)).toBe("#14B8A6");
    expect(iconColorOf(<Icon name="home" color="foreground" />)).toBe("#0A0A0A");
    expect(iconColorOf(<Icon name="check" color="primary" />)).toBe("#0F172A");
  });

  it("defaults to the theme text color and passes literal colors through", () => {
    expect(iconColorOf(<Icon name="mic" />)).toBe("#111827");
    expect(iconColorOf(<Icon name="mic" color="#FF0000" />)).toBe("#FF0000");
  });
});
