/**
 * The manifest is how the rules reach a project that installed
 * `@mrmeg/expo-ui` and has no design-system sources on disk. Two things must
 * hold: a round trip through JSON says exactly what the source loader says, and
 * the rules quote the shipping package's name where they would otherwise quote
 * `packages/ui/src`.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");

const {
  MANIFEST_SCHEMA_VERSION,
  loadDesignSystemFromManifest,
  serializeDesignSystem,
} = require("../lib/manifest");
const { loadDesignSystem } = require("../lib/source");

const UI_SRC = path.resolve(__dirname, "../../ui/src");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-manifest-"));

/**
 * @param {string} name a fresh file name; the loader caches per path on mtime,
 *   so two payloads must never share one
 * @param {unknown} payload
 * @returns {string} the absolute path written
 */
function writeManifest(name, payload) {
  const file = path.join(TEMP_ROOT, name);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

/** `Map`s and `Map`-valued token groups compared as plain entries. */
function comparable(design) {
  const tokens = {};
  for (const group of Object.keys(design.tokens)) {
    tokens[group] = {
      entries: design.tokens[group].entries,
      values: design.tokens[group].values,
      nameByValue: [...design.tokens[group].nameByValue.entries()],
    };
  }
  return {
    loaded: design.loaded,
    tokens,
    palette: design.palette,
    themeTokens: design.themeTokens,
    lightTheme: design.lightTheme,
    darkTheme: design.darkTheme,
    fontVariants: design.fontVariants,
    components: [...design.components.entries()],
  };
}

afterAll(() => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("design-system manifest round trip", () => {
  const source = loadDesignSystem(UI_SRC);
  const payload = serializeDesignSystem(source, {
    packageName: "@mrmeg/expo-ui",
    version: "9.9.9",
  });
  const file = writeManifest("round-trip.json", payload);
  const loaded = loadDesignSystemFromManifest(file);

  it("declares the schema version the loader accepts", () => {
    expect(payload.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.package).toBe("@mrmeg/expo-ui");
    expect(payload.version).toBe("9.9.9");
  });

  it("says exactly what the source loader says", () => {
    expect(comparable(loaded)).toEqual(comparable(source));
  });

  it("records where the facts came from", () => {
    expect(loaded.origin).toEqual({
      kind: "manifest",
      path: file,
      package: "@mrmeg/expo-ui",
      version: "9.9.9",
    });
    expect(source.origin).toEqual({ kind: "source", path: UI_SRC });
  });

  it("keeps component files bare names, as the messages assume", () => {
    expect(payload.components.length).toBeGreaterThan(0);
    for (const info of payload.components) {
      expect(info.file).toMatch(/^[\w.-]+\.tsx?$/);
    }
  });

  it("refuses to serialize a design system that was not loaded", () => {
    expect(() =>
      serializeDesignSystem(loadDesignSystem(path.join(TEMP_ROOT, "no-such-dir")), {
        packageName: "@mrmeg/expo-ui",
        version: "9.9.9",
      }),
    ).toThrow(/not loaded/);
  });
});

// ---------------------------------------------------------------------------
// The rules, reading a manifest instead of sources
// ---------------------------------------------------------------------------

const REAL_MANIFEST = writeManifest(
  "configured.json",
  serializeDesignSystem(loadDesignSystem(UI_SRC), {
    packageName: "@mrmeg/expo-ui",
    version: "9.9.9",
  }),
);

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  // No sources anywhere: only the manifest can answer.
  settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir", manifestPath: REAL_MANIFEST } },
});

ruleTester.run("no-restyle (manifest)", require("../rules/no-restyle"), {
  valid: [],
  invalid: [
    {
      code:
        'import { Button } from "@mrmeg/expo-ui/components";\n' +
        'const x = <Button style={{ backgroundColor: "#f00" }} />;',
      errors: [
        {
          message:
            /Use `preset`: default \| outline \| ghost \| link \| destructive \| secondary\. Add a preset in `@mrmeg\/expo-ui\/components\/Button\.tsx`/,
        },
      ],
    },
  ],
});

ruleTester.run("no-raw-colors (manifest)", require("../rules/no-raw-colors"), {
  valid: [],
  invalid: [
    {
      code: 'import { View } from "react-native";\nconst x = <View style={{ backgroundColor: "#EF4444" }} />;',
      errors: [
        {
          message:
            /`theme\.colors\.destructive`.+`palette\.red500`.+`@mrmeg\/expo-ui\/constants\/colors\.ts`/,
        },
      ],
    },
  ],
});

ruleTester.run("no-arbitrary-values (manifest)", require("../rules/no-arbitrary-values"), {
  valid: [],
  invalid: [
    {
      code: 'import { View } from "react-native";\nconst x = <View style={{ padding: 13 }} />;',
      errors: [
        {
          message:
            /Nearest: `spacing\.smd` \(12\), `spacing\.md` \(16\)\..+`@mrmeg\/expo-ui\/constants\/spacing\.ts`/,
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * An installed `@mrmeg/expo-ui` with facts that exist nowhere else, so a message
 * quoting them proves this package was resolved — not the workspace link in this
 * repo's own `node_modules`, which may or may not hold a built manifest.
 */
const INSTALLED_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-installed-"));
const INSTALLED_PACKAGE = path.join(INSTALLED_ROOT, "node_modules", "@mrmeg", "expo-ui");
fs.mkdirSync(path.join(INSTALLED_PACKAGE, "dist"), { recursive: true });
fs.writeFileSync(
  path.join(INSTALLED_PACKAGE, "package.json"),
  `${JSON.stringify(
    {
      name: "@mrmeg/expo-ui",
      version: "9.9.9",
      main: "./dist/index.js",
      exports: { "./design-system.json": { default: "./dist/design-system.json" } },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  path.join(INSTALLED_PACKAGE, "dist", "design-system.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      package: "@mrmeg/expo-ui",
      version: "9.9.9",
      tokens: {
        spacing: { entries: [{ name: "alphaGap", value: 7 }] },
        radius: { entries: [] },
        icon: { entries: [] },
      },
      palette: { alphaRed: "#AA0000" },
      themeTokens: ["background"],
      lightTheme: { background: { paletteKey: "alphaRed", value: "#AA0000" } },
      darkTheme: { background: { paletteKey: "alphaRed", value: "#AA0000" } },
      fontVariants: ["alphaSans"],
      components: [
        {
          name: "Button",
          file: "Button.tsx",
          hasSize: true,
          variantProp: "preset",
          variantValues: ["alpha", "beta"],
          sizeValues: ["small", "large"],
        },
      ],
    },
    null,
    2,
  )}\n`,
);

const REJECTED_MANIFEST = writeManifest("rejected.json", {
  ...serializeDesignSystem(loadDesignSystem(UI_SRC), {
    packageName: "@mrmeg/expo-ui",
    version: "9.9.9",
  }),
  schemaVersion: 2,
});

afterAll(() => {
  fs.rmSync(INSTALLED_ROOT, { recursive: true, force: true });
});

const autoTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  // No `manifestPath`: the installed package next to the linted file must be found.
  settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } },
});

autoTester.run("no-restyle (installed package)", require("../rules/no-restyle"), {
  valid: [],
  invalid: [
    {
      filename: path.join(INSTALLED_ROOT, "app", "screen.tsx"),
      code:
        'import { Button } from "@mrmeg/expo-ui/components";\n' +
        'const x = <Button style={{ backgroundColor: "#f00" }} />;',
      errors: [{ message: /Use `preset`: alpha \| beta\./ }],
    },
  ],
});

// ---------------------------------------------------------------------------
// Malformed and empty payloads
// ---------------------------------------------------------------------------

/**
 * A group whose `entries` is not a list: iterating it used to throw
 * `TypeError: entries is not iterable` out of every rule's `create()`. The
 * components still carry facts, so the manifest loads with empty scales.
 */
const MALFORMED_TOKENS_MANIFEST = writeManifest("malformed-tokens.json", {
  schemaVersion: 1,
  package: "@mrmeg/expo-ui",
  version: "9.9.9",
  tokens: { spacing: { entries: 5 }, radius: {}, icon: {} },
  palette: { alphaRed: "#AA0000" },
  themeTokens: ["background"],
  lightTheme: { background: { paletteKey: "alphaRed", value: "#AA0000" } },
  darkTheme: { background: { paletteKey: "alphaRed", value: "#AA0000" } },
  fontVariants: ["alphaSans"],
  components: [
    {
      name: "Button",
      file: "Button.tsx",
      hasSize: true,
      variantProp: "preset",
      variantValues: ["alpha", "beta"],
      sizeValues: ["small", "large"],
    },
  ],
});

describe("a manifest whose token entries are not a list", () => {
  const loaded = loadDesignSystemFromManifest(MALFORMED_TOKENS_MANIFEST);

  it("loads with empty scales instead of throwing", () => {
    expect(loaded.loaded).toBe(true);
    for (const group of Object.keys(loaded.tokens)) {
      expect(loaded.tokens[group].entries).toEqual([]);
      expect(loaded.tokens[group].values).toEqual([]);
    }
    expect(loaded.components.has("Button")).toBe(true);
  });
});

const malformedTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir", manifestPath: MALFORMED_TOKENS_MANIFEST } },
});

// The facts it does hold still lint: the rule quotes the component's presets.
malformedTester.run("no-restyle (malformed token entries)", require("../rules/no-restyle"), {
  valid: [],
  invalid: [
    {
      code:
        'import { Button } from "@mrmeg/expo-ui/components";\n' +
        'const x = <Button style={{ backgroundColor: "#f00" }} />;',
      errors: [{ message: /Use `preset`: alpha \| beta\./ }],
    },
  ],
});

/** Well-formed JSON that states nothing: no scale has an entry, no component. */
const EMPTY_FACTS_MANIFEST = writeManifest("empty-facts.json", {
  schemaVersion: 1,
  package: "@mrmeg/expo-ui",
  version: "9.9.9",
  tokens: { spacing: { entries: [] }, radius: { entries: [] }, icon: { entries: [] } },
  palette: {},
  themeTokens: [],
  lightTheme: {},
  darkTheme: {},
  fontVariants: null,
  components: [],
});

const emptyFactsTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { manifestPath: EMPTY_FACTS_MANIFEST } },
});

// Nothing to quote is a dead end, reported once per file — not silent linting.
emptyFactsTester.run("no-restyle (empty manifest)", require("../rules/no-restyle"), {
  valid: [],
  invalid: [
    {
      code: 'import { Button } from "@mrmeg/expo-ui/components";\nconst x = <Button />;',
      errors: [
        {
          message: `Design-system manifest could not be read at \`${EMPTY_FACTS_MANIFEST}\`: the manifest has no tokens or components.`,
        },
      ],
    },
  ],
});

const REJECTION_MESSAGE = `Design-system manifest could not be read at \`${REJECTED_MANIFEST}\`: schemaVersion 2 is not supported (this plugin reads 1).`;

const rejectionTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { manifestPath: REJECTED_MANIFEST } },
});

const RULES = {
  "no-raw-colors": require("../rules/no-raw-colors"),
  "no-arbitrary-values": require("../rules/no-arbitrary-values"),
  "no-restyle": require("../rules/no-restyle"),
  "no-raw-primitives": require("../rules/no-raw-primitives"),
};

// A manifest from a newer schema is a dead end, not a reason to lint silently.
for (const name of Object.keys(RULES)) {
  rejectionTester.run(`${name} (rejected manifest)`, RULES[name], {
    valid: [],
    invalid: [
      {
        code: 'import { Button } from "@mrmeg/expo-ui/components";\nconst x = <Button />;',
        errors: [{ message: REJECTION_MESSAGE }],
      },
    ],
  });
}
