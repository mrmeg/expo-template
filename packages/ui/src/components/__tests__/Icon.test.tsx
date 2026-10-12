import React from "react";
import { StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Icon, isIconName, registerIcons, type IconGlyph as IconGlyphData, type IconName } from "../Icon";
import { IconGlyph } from "../IconGlyph";
import { BUILTIN_ICONS } from "../iconBuiltins.generated";
import iconNames from "../icon-names.json";

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

function renderIcon(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

/** The SVG root host a named icon renders (`testID: icon-<name>`). */
function svgRootOf(element: React.ReactElement, name: string): TestRenderer.ReactTestInstance {
  return renderIcon(element)
    .root.findAllByProps({ testID: `icon-${name}` })
    .filter((node) => typeof node.type === "string")[0];
}

/** Color `Icon` resolved and handed to the glyph renderer. */
function glyphColorOf(element: React.ReactElement): string {
  return renderIcon(element).root.findByType(IconGlyph).props.color;
}

describe("Icon", () => {
  it("renders an SVG root sized, styled, and hidden from assistive tech without raw text nodes", () => {
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
          <Icon name="eye" style={{ marginRight: 4 }} />
          <Icon name="eye-off" decorative />
        </View>
      );
    });

    expect(
      consoleError.mock.calls.some((args) =>
        args.map(String).join(" ").includes("Unexpected text node")
      )
    ).toBe(false);

    const hosts = (testID: string) =>
      testRenderer!.root.findAllByProps({ testID }).filter((node) => typeof node.type === "string");
    const eye = hosts("icon-eye");
    const eyeOff = hosts("icon-eye-off");
    expect(eye).toHaveLength(1);
    expect(eyeOff).toHaveLength(1);
    expect(StyleSheet.flatten(eye[0].props.style)).toEqual(
      expect.objectContaining({
        marginRight: 4,
        pointerEvents: "none",
      })
    );
    expect(eye[0].props.width).toBe(24);
    expect(eye[0].props.height).toBe(24);
    // Neither icon carries a label, so both are hidden from assistive tech: an
    // unlabeled icon beside its text would otherwise be announced as nothing.
    expect(eye[0].props.accessible).toBe(false);
    expect(eye[0].props["aria-hidden"]).toBe(true);
    expect(eyeOff[0].props.accessible).toBe(false);
    expect(eyeOff[0].props.importantForAccessibility).toBe("no-hide-descendants");
    expect(eyeOff[0].props.accessibilityElementsHidden).toBe(true);
    expect(eyeOff[0].props["aria-hidden"]).toBe(true);
  });

  it("hands the renderer the registered glyph", () => {
    const glyph = renderIcon(<Icon name="check" />).root.findByType(IconGlyph);
    // Deep equality: the app may register a builtin name again (same data).
    expect(glyph.props.glyph).toEqual(BUILTIN_ICONS.check);
    expect(glyph.props.size).toBe(24);
  });

  it("resolves any theme color name to its semantic value", () => {
    // Includes tokens beyond the old hard-coded shortcut list (foreground, accent),
    // which previously fell through as invalid literal strings.
    expect(glyphColorOf(<Icon name="sun" color="accent" />)).toBe("#14B8A6");
    expect(glyphColorOf(<Icon name="moon" color="foreground" />)).toBe("#0A0A0A");
    expect(glyphColorOf(<Icon name="check" color="primary" />)).toBe("#0F172A");
    expect(svgRootOf(<Icon name="check" color="primary" />, "check").props.stroke).toBe("#0F172A");
  });

  it("defaults to the theme text color and passes literal colors through", () => {
    expect(glyphColorOf(<Icon name="eye" />)).toBe("#111827");
    expect(glyphColorOf(<Icon name="eye" color="#FF0000" />)).toBe("#FF0000");
  });

  it("puts a caller's testID on the SVG root", () => {
    const renderer = renderIcon(<Icon name="check" testID="saved-mark" />);
    expect(renderer.root.findAllByProps({ testID: "saved-mark" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: "icon-check" })).toHaveLength(0);
  });

  it("renders a custom component with the resolved color, size, and a11y props", () => {
    const Custom = jest.fn((props: { size: number; color: string }) => (
      <View testID="custom-icon" {...props} />
    ));

    const renderer = renderIcon(<Icon component={Custom} color="destructive" size={12} decorative />);
    const node = renderer.root.findByProps({ testID: "custom-icon" });

    expect(node.props.color).toBe("#EF4444");
    expect(node.props.size).toBe(12);
    expect(node.props.accessible).toBe(false);
    expect(node.props["aria-hidden"]).toBe(true);
    expect(StyleSheet.flatten(node.props.style)).toEqual(expect.objectContaining({ pointerEvents: "none" }));
    expect(Custom).toHaveBeenCalled();
  });

  it("sizes, colors, and hides a component icon exactly like a named one", () => {
    const Custom = (props: { size: number; color: string }) => <View testID="custom-icon" {...props} />;

    const custom = renderIcon(<Icon component={Custom} color="accent" style={{ marginLeft: 2 }} />)
      .root.findByProps({ testID: "custom-icon" });
    const named = renderIcon(<Icon name="sun" color="accent" style={{ marginLeft: 2 }} />)
      .root.findByType(IconGlyph);

    for (const key of ["size", "color", "accessible", "importantForAccessibility", "aria-hidden"]) {
      expect(custom.props[key]).toEqual(named.props[key]);
    }
    expect(custom.props.size).toBe(24);
    expect(custom.props.color).toBe("#14B8A6");
    expect(StyleSheet.flatten(custom.props.style)).toEqual(StyleSheet.flatten(named.props.style));
  });

  it("renders nothing and warns once for an unregistered name at runtime", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const missing = "missing-glyph" as unknown as IconName;
      expect(renderIcon(<Icon name={missing} />).toJSON()).toBeNull();
      expect(renderIcon(<Icon name={missing} />).toJSON()).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('"missing-glyph"');
      expect(warn.mock.calls[0][0]).toContain("client/icons.json");
      expect(warn.mock.calls[0][0]).toContain("registerIcons(appIcons)");
      // A registered name still renders after the miss.
      expect(glyphColorOf(<Icon name="check" color="primary" />)).toBe("#0F172A");
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects unregistered names at compile time", () => {
    // @ts-expect-error -- "not-an-icon" is neither a builtin nor registered by the app
    const element = <Icon name="not-an-icon" />;
    expect(element).toBeTruthy();
  });
});

describe("icon registry", () => {
  it("builds BUILTIN_ICONS from every icon-names.json entry, and nothing else", () => {
    expect(iconNames.length).toBeGreaterThan(0);
    expect(Object.keys(BUILTIN_ICONS)).toEqual(iconNames);
  });

  it("keeps icon-names.json sorted and unique", () => {
    expect(iconNames).toEqual([...new Set(iconNames)].sort());
  });

  it("carries every name the package's own components draw", () => {
    for (const name of [
      "check",
      "chevron-down",
      "chevron-right",
      "chevron-up",
      "circle-alert",
      "circle-check-big",
      "eye",
      "eye-off",
      "info",
      "minus",
      "monitor",
      "moon",
      "smartphone",
      "sun",
      "trending-down",
      "trending-up",
      "triangle-alert",
      "user",
      "x",
    ]) {
      expect(isIconName(name)).toBe(true);
      expect(iconNames).toContain(name);
    }
  });

  it("registers app glyphs idempotently, later keys winning, and narrows with isIconName", () => {
    const first: IconGlyphData = [["circle", { cx: "12", cy: "12", r: "10" }]];
    const second: IconGlyphData = [["path", { d: "M2 2h20" }]];
    const value: unknown = "registry-test-glyph";

    expect(isIconName(value)).toBe(false);
    registerIcons({ "registry-test-glyph": first });
    registerIcons({ "registry-test-glyph": first });
    expect(isIconName(value)).toBe(true);
    if (isIconName(value)) {
      // Narrowed: usable as `name` without a cast.
      expect(renderIcon(<Icon name={value} />).root.findByType(IconGlyph).props.glyph).toBe(first);
    }

    registerIcons({ "registry-test-glyph": second });
    const glyph = renderIcon(<Icon name={value as IconName} />).root.findByType(IconGlyph);
    expect(glyph.props.glyph).toBe(second);

    expect(isIconName(42)).toBe(false);
    expect(isIconName(undefined)).toBe(false);
  });
});
