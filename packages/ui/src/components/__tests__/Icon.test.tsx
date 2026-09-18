import fs from "fs";
import path from "path";
import React from "react";
import { StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Icon } from "../Icon";
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

/** Color the registry mock (see test/setup.ts) received for `<Icon name>`. */
function iconColorOf(element: React.ReactElement, name: string): string {
  return renderIcon(element).root.findByProps({ testID: `icon-${name}` }).props.color;
}

describe("Icon", () => {
  it("renders SVG icons inside a View without raw text-node warnings", () => {
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

    const mic = testRenderer!.root.findAllByProps({ testID: "icon-mic" }).filter((node) => node.type === View);
    const micOff = testRenderer!.root
      .findAllByProps({ testID: "icon-mic-off" })
      .filter((node) => node.type === View);
    expect(mic).toHaveLength(1);
    expect(micOff).toHaveLength(1);
    expect(StyleSheet.flatten(mic[0].props.style)).toEqual(
      expect.objectContaining({
        marginRight: 4,
        pointerEvents: "none",
      })
    );
    expect(mic[0].props.size).toBe(24);
    expect(mic[0].props.accessible).toBe(true);
    expect(micOff[0].props.accessible).toBe(false);
    expect(micOff[0].props.importantForAccessibility).toBe("no-hide-descendants");
    expect(micOff[0].props.accessibilityElementsHidden).toBe(true);
    expect(micOff[0].props["aria-hidden"]).toBe(true);
  });

  it("resolves any theme color name to its semantic value", () => {
    // Includes tokens beyond the old hard-coded shortcut list (foreground, accent),
    // which previously fell through as invalid literal strings.
    expect(iconColorOf(<Icon name="box" color="accent" />, "box")).toBe("#14B8A6");
    expect(iconColorOf(<Icon name="house" color="foreground" />, "house")).toBe("#0A0A0A");
    expect(iconColorOf(<Icon name="check" color="primary" />, "check")).toBe("#0F172A");
  });

  it("defaults to the theme text color and passes literal colors through", () => {
    expect(iconColorOf(<Icon name="mic" />, "mic")).toBe("#111827");
    expect(iconColorOf(<Icon name="mic" color="#FF0000" />, "mic")).toBe("#FF0000");
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

  it("rejects names outside the registry at compile time", () => {
    // @ts-expect-error -- "not-an-icon" is not listed in icon-names.json
    const element = <Icon name="not-an-icon" />;
    expect(element).toBeTruthy();
  });
});

describe("icon registry", () => {
  // The global setup mock stands in for the generated module, and Jest cannot
  // load the real one (Lucide ships ESM `.mjs` that the RN transform does not
  // cover), so read the generated source and the installed package directly.
  // `bun run ui:icons:check` is the byte-exact freshness gate; this guards the
  // contract the mock hides: every listed name is a key, and nothing else is.
  const generatedPath = path.join(__dirname, "..", "iconRegistry.generated.ts");
  const generated = fs.readFileSync(generatedPath, "utf8");
  const registryKeys = [...generated.matchAll(/^ {2}"([a-z0-9-]+)": [A-Za-z0-9]+,$/gm)].map((m) => m[1]);
  const importedNames = [...generated.matchAll(/^import [A-Za-z0-9]+ from "lucide-react-native\/icons\/([a-z0-9-]+)";$/gm)].map((m) => m[1]);
  const lucideIconsDir = path.join(__dirname, "..", "..", "..", "..", "..", "node_modules", "lucide-react-native", "dist", "esm", "icons");

  it("keys ICONS by every icon-names.json entry, and nothing else", () => {
    expect(iconNames.length).toBeGreaterThan(0);
    expect(registryKeys).toEqual(iconNames);
    expect(importedNames).toEqual(iconNames);
    expect(generated).toContain("export type IconName = keyof typeof ICONS;");
  });

  it("keeps icon-names.json sorted and unique", () => {
    expect(iconNames).toEqual([...new Set(iconNames)].sort());
  });

  it("imports a per-icon subpath that exists in the installed lucide-react-native", () => {
    expect(generated).not.toMatch(/from "lucide-react-native"/);
    for (const name of iconNames) {
      expect(fs.existsSync(path.join(lucideIconsDir, `${name}.mjs`))).toBe(true);
    }
  });

  it("carries the package's own names after the Feather → Lucide renames", () => {
    for (const name of ["check", "x", "chevron-down", "chevron-right", "chevron-up", "circle-alert", "circle-check-big", "triangle-alert", "info", "trending-up", "trending-down", "user"]) {
      expect(iconNames).toContain(name);
    }
  });
});
