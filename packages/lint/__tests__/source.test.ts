/**
 * The loader reads the real `packages/ui/src`, so these assertions double as a
 * check that the design system still spells its tokens and variants the way the
 * rule messages claim.
 */
const path = require("node:path");
const { readSettings } = require("../lib/settings");
const { loadDesignSystem } = require("../lib/source");

const UI_SRC = path.resolve(__dirname, "../../ui/src");
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("design-system source loader", () => {
  const design = loadDesignSystem(UI_SRC);

  it("groups spacing members by key prefix", () => {
    expect(design.loaded).toBe(true);
    expect(design.tokens.spacing.nameByValue.get(12)).toBe("smd");
    expect(design.tokens.spacing.nameByValue.get(16)).toBe("md");
    expect(design.tokens.spacing.values).toContain(64);
    // 9999 is `radiusFull`; it must not leak into the spacing scale.
    expect(design.tokens.spacing.values).not.toContain(9999);
    expect(design.tokens.radius.nameByValue.get(10)).toBe("radiusMd");
    expect(design.tokens.radius.values).toContain(9999);
    expect(design.tokens.icon.values).toEqual([12, 16, 24, 32, 48]);
  });

  it("reads the palette and resolves theme tokens through it", () => {
    expect(design.palette.red500).toBe("#EF4444");
    expect(design.palette.white).toBe("#FFFFFF");
    expect(design.lightTheme.destructive).toEqual({ paletteKey: "red500", value: "#EF4444" });
    expect(design.darkTheme.destructive).toEqual({ paletteKey: "red400", value: "#F87171" });
    // A literal rather than a palette reference.
    expect(design.lightTheme.overlay).toEqual({ paletteKey: null, value: "rgba(0, 0, 0, 0.5)" });
    expect(design.themeTokens).toContain("mutedForeground");
  });

  it("reads the FontVariant union the text-typography message quotes", () => {
    // `no-restyle` prints these as the font families `variant` picks, so a
    // rename or a fourth family has to land in the message too.
    expect(design.fontVariants).toEqual(["sansSerif", "serif", "mono"]);
  });

  it("reads StyledText's size map as the typography group", () => {
    // `no-raw-typography` names these; a size added to `FONT_SIZES` has to
    // reach the message, and its line height rides on the same entry.
    const typography = design.tokens.typography;
    expect(typography.values).toEqual([11, 12, 14, 15, 18, 22, 28, 34]);
    expect(typography.nameByValue.get(14)).toBe("base");
    expect(typography.entries.find((entry) => entry.name === "base")).toEqual({
      name: "base",
      value: 14,
      lineHeight: 21,
    });
    expect(typography.entries.map((entry) => entry.name)).toEqual([
      "xs",
      "sm",
      "base",
      "body",
      "lg",
      "xl",
      "xxl",
      "display",
    ]);
  });

  it("reads every family a font slot resolves to, across platform branches", () => {
    const { families } = design.fonts;
    expect(Object.keys(families).sort()).toEqual(["mono", "sansSerif", "serif"]);
    // Web stack, native static file, and the fallback branch all count.
    expect(families.sansSerif.medium).toEqual(
      expect.arrayContaining(["Inter_500Medium", "sans-serif"]),
    );
    expect(families.sansSerif.medium.some((family) => family.startsWith("\"Inter\","))).toBe(true);
    expect(families.serif.bold).toEqual(expect.arrayContaining(["Georgia"]));
    // `Platform.OS === "ios" ? "Menlo" : "monospace"` is two families.
    expect(families.mono.regular).toEqual(expect.arrayContaining(["Menlo", "monospace"]));
  });

  it("indexes components, compounds, and their variant props", () => {
    const button = design.components.get("Button");
    expect(button.file).toBe("Button.tsx");
    expect(button.hasSize).toBe(true);
    expect(button.variantProp).toBe("preset");
    expect(button.variantValues).toEqual([
      "default",
      "outline",
      "ghost",
      "link",
      "destructive",
      "secondary",
    ]);
    expect(button.sizeValues).toEqual(["sm", "md", "lg"]);

    // `Object.assign(ButtonRoot, { Text, Icon })` compounds.
    expect(design.components.get("Button.Text").file).toBe("Button.tsx");
    expect(design.components.get("BottomSheet.Content").file).toBe("BottomSheet.tsx");

    // Semantic aliases live in the same file as `StyledText`.
    expect(design.components.get("TitleText").file).toBe("StyledText.tsx");
    expect(design.components.get("StyledText").hasSize).toBe(true);

    // The text-like contract covers `Item`'s text parts, not its icon tile.
    expect(design.components.get("ItemTitle").file).toBe("Item.tsx");
    expect(design.components.get("ItemDescription").file).toBe("Item.tsx");
    expect(design.components.get("Label").sizeValues).toEqual(["sm", "md", "lg"]);

    expect(design.components.get("Badge").variantProp).toBe("variant");
    expect(design.components.get("Badge").variantValues).toEqual([
      "default",
      "secondary",
      "outline",
      "destructive",
    ]);
  });

  it("degrades to unknown instead of throwing when the sources are missing", () => {
    const missing = loadDesignSystem(path.resolve(__dirname, "no-such-directory"));
    expect(missing.loaded).toBe(false);
    expect(missing.components.size).toBe(0);
    expect(missing.tokens.spacing.values).toEqual([]);
    expect(missing.tokens.typography.values).toEqual([]);
    expect(missing.fonts.families).toEqual({});
    expect(missing.palette).toEqual({});
  });

  it("resolves a relative `uiSourceDir` from a subdirectory of the repo", () => {
    // Linting from anywhere but the repo root used to load nothing at all,
    // which turned every rule into a silent no-op.
    const fromSubdir = readSettings({ cwd: path.join(REPO_ROOT, "app"), settings: {} });
    expect(fromSubdir.uiSourceDir).toBe(UI_SRC);
    expect(loadDesignSystem(fromSubdir.uiSourceDir).loaded).toBe(true);

    // And from a working directory outside the repo, via the linted file.
    const fromFile = readSettings({
      cwd: path.sep,
      filename: path.join(REPO_ROOT, "client", "showcase", "ShowcaseScreen.tsx"),
      settings: {},
    });
    expect(fromFile.uiSourceDir).toBe(UI_SRC);
    expect(loadDesignSystem(fromFile.uiSourceDir).loaded).toBe(true);

    // An absolute setting is taken as written.
    const absolute = readSettings({
      cwd: REPO_ROOT,
      settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } },
    });
    expect(absolute.uiSourceDir).toBe("/nonexistent/dir");
    expect(loadDesignSystem(absolute.uiSourceDir).loaded).toBe(false);
  });
});
