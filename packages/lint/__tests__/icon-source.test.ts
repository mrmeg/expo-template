/**
 * `expo-ui/icon-source` has two jobs: ban the icon libraries (Lucide's React
 * packages, the vector-icon fonts) and rewrite Lucide's old (alias) icon names
 * to their canonical names. The message text is the product, so it is pinned
 * exactly, including the three ways it tells a reader to register a name.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Linter, RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/icon-source");
const plugin = require("../index.js");
const { serializeDesignSystem } = require("../lib/manifest");
const { loadDesignSystem } = require("../lib/source");

const UI_SRC = path.resolve(__dirname, "../../ui/src");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-icon-source-"));

const languageOptions = {
  parser: tsParser,
  ecmaVersion: 2022,
  sourceType: "module",
  parserOptions: { ecmaFeatures: { jsx: true } },
};

afterAll(() => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

// The three ways to say how a name gets registered.
const IN_SOURCES = (name: string) => `run \`bun run icons add ${name}\``;
const IN_CONSUMER = (name: string) => `run \`bunx expo-ui-icons add ${name}\``;
const UPGRADE = (name: string) =>
  `upgrade \`@mrmeg/expo-ui\` to 0.29.0 or later, then run \`bunx expo-ui-icons add ${name}\``;

/**
 * @param register how the clause reads for the design system under test
 */
function messages(register: (name: string) => string) {
  const aliasNote = (kebab: string, canonical: string) =>
    kebab === canonical ? "" : ` (\`${kebab}\` is Lucide's old name for \`${canonical}\`)`;
  return {
    component: (name: string, source: string, kebab: string, canonical: string) =>
      `\`${name}\` from \`"${source}"\` is an icon-library component. Use \`<Icon name="${canonical}" />\` from \`"@mrmeg/expo-ui/components"\`${aliasNote(kebab, canonical)}; if \`${canonical}\` is not registered yet, ${register(canonical)}.`,
    library: (source: string) =>
      `\`"${source}"\` is an icon library; \`Icon\` from \`"@mrmeg/expo-ui/components"\` draws Lucide glyphs without one. Use \`<Icon name="…" />\` with a kebab-case Lucide name (to register one, ${register("<name>")}), type icon props with \`IconName\` or \`IconComponent\` from \`"@mrmeg/expo-ui/components/Icon"\`, and pass \`component\` for art that is not a Lucide icon.`,
    font: (source: string) =>
      `\`"${source}"\` is an icon font outside the design system. Use \`<Icon name="…" />\` from \`"@mrmeg/expo-ui/components"\` with a kebab-case Lucide name (to register one, ${register("<name>")}), list native tab bar glyphs under \`tabIcons\` in \`client/icons.json\`, and pass \`component\` for art that is not a Lucide icon.`,
    alias: (alias: string, canonical: string, prop: string) =>
      `\`"${alias}"\` is Lucide's old name for \`"${canonical}"\`, and \`Icon\` registers canonical names only. Use \`${prop}="${canonical}"\`; if it is not registered yet, ${register(canonical)}.`,
  };
}

const sources = messages(IN_SOURCES);

const COMPONENTS = 'import { Button, Icon, Item, ToggleIcon } from "@mrmeg/expo-ui/components";\n';

// No settings: the rule reads this repo's sources, so the clause is the root script.
const ruleTester = new RuleTester({ languageOptions });

ruleTester.run("icon-source", rule, {
  valid: [
    // Canonical names, and the names the package registers itself.
    `${COMPONENTS}const a = <Icon name="house" />;`,
    `${COMPONENTS}const a = <Item icon="archive" />;`,
    // A local `Icon` is not the design system's: its `name` is its own business.
    'import { Icon } from "./Icon";\nconst a = <Icon name="home" />;',
    // `name` is an icon name only on the Icon family.
    `${COMPONENTS}const a = <Button name="home" />;`,
    `${COMPONENTS}const a = <Item name="home" />;`,
    // A value the rule cannot read is left to the type checker.
    `${COMPONENTS}const a = <Item icon={someVar} />;`,
    `${COMPONENTS}const a = <Icon name={\`\${prefix}-home\`} />;`,
    // Alias names outside JSX on a design-system component are out of scope.
    `${COMPONENTS}const a = { icon: "home" };`,
    // Not an icon library.
    'import { palette } from "@mrmeg/expo-ui/constants";',
    'import { icons } from "lucide-static";',
    'import { createElement } from "lucide";',
    // A package whose name merely starts with a banned one.
    'import { Home } from "lucide-react-nativex";',
    'import { Ionicons } from "@expo/vector-icons-extra";',
    'const f = require("./lucide-react-native");',
    // A call that is not `require`, or has no string to read.
    'const a = load("lucide-react-native");',
    "const a = require(name);",
    "const a = import(name);",
  ],
  invalid: [
    {
      // The example in the spec, word for word.
      code: 'import { Home } from "lucide-react-native";',
      errors: [
        {
          message:
            '`Home` from `"lucide-react-native"` is an icon-library component. Use `<Icon name="house" />` from `"@mrmeg/expo-ui/components"` (`home` is Lucide\'s old name for `house`); if `house` is not registered yet, run `bun run icons add house`.',
          line: 1,
          column: 10,
        },
      ],
    },
    {
      // Each icon is its own report, on its specifier, whatever it is renamed to.
      code: 'import { Archive, AlertCircle as Alert } from "lucide-react";',
      errors: [
        { message: sources.component("Archive", "lucide-react", "archive", "archive") },
        { message: sources.component("AlertCircle", "lucide-react", "alert-circle", "circle-alert") },
      ],
    },
    {
      code: 'import { HomeIcon } from "lucide-react-native";',
      errors: [{ message: sources.component("HomeIcon", "lucide-react-native", "home", "house") }],
    },
    {
      code: 'import { LucideHome } from "lucide-react-native";',
      errors: [{ message: sources.component("LucideHome", "lucide-react-native", "home", "house") }],
    },
    {
      // Digits are split off the letter before them, as Lucide's own export names do.
      code: 'import { Grid2x2, CalendarX2, ArrowDown01, BarChart2 } from "lucide-react-native";',
      errors: [
        { message: sources.component("Grid2x2", "lucide-react-native", "grid-2x2", "grid-2x2") },
        { message: sources.component("CalendarX2", "lucide-react-native", "calendar-x-2", "calendar-x-2") },
        {
          message: sources.component("ArrowDown01", "lucide-react-native", "arrow-down-01", "arrow-down-0-1"),
        },
        {
          message: sources.component("BarChart2", "lucide-react-native", "bar-chart-2", "chart-no-axes-column"),
        },
      ],
    },
    {
      // A string import name is the same export.
      code: 'import { "XCircle" as Cancel } from "lucide-react-native";',
      errors: [{ message: sources.component("XCircle", "lucide-react-native", "x-circle", "circle-x") }],
    },
    {
      // Type-only imports count: the package still has to be installed for them.
      code: 'import type { Home } from "lucide-react-native";',
      errors: [{ message: sources.component("Home", "lucide-react-native", "home", "house") }],
    },
    {
      code: 'import { type Home, Archive } from "lucide-react-native";',
      errors: [
        { message: sources.component("Home", "lucide-react-native", "home", "house") },
        { message: sources.component("Archive", "lucide-react-native", "archive", "archive") },
      ],
    },
    {
      code: 'import * as L from "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'import { icons } from "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'import type { LucideIcon } from "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'import Lucide from "lucide-react";',
      errors: [{ message: sources.library("lucide-react") }],
    },
    {
      code: 'import "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      // The icons are named, and the helper next to them is the library.
      code: 'import { Home, createLucideIcon } from "lucide-react-native";',
      errors: [
        { message: sources.component("Home", "lucide-react-native", "home", "house") },
        { message: sources.library("lucide-react-native") },
      ],
    },
    {
      code: 'import { Home, LucideProps } from "lucide-react-native";',
      errors: [
        { message: sources.component("Home", "lucide-react-native", "home", "house") },
        { message: sources.library("lucide-react-native") },
      ],
    },
    {
      // One icon's file: the name is the path segment.
      code: 'import Home from "lucide-react-native/icons/home";',
      errors: [
        {
          message: sources.component("home", "lucide-react-native/icons/home", "home", "house"),
        },
      ],
    },
    {
      code: 'import Archive from "lucide-react/dist/esm/icons/archive.js";',
      errors: [
        {
          message: sources.component(
            "archive",
            "lucide-react/dist/esm/icons/archive.js",
            "archive",
            "archive",
          ),
        },
      ],
    },
    {
      // Any other subpath is the library.
      code: 'import { createLucideIcon } from "lucide-react-native/dist/esm/createLucideIcon";',
      errors: [{ message: sources.library("lucide-react-native/dist/esm/createLucideIcon") }],
    },
    {
      code: 'import { icons } from "lucide-react-native/icons";',
      errors: [{ message: sources.library("lucide-react-native/icons") }],
    },
    {
      code: 'export { Home } from "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'export * from "lucide-react";',
      errors: [{ message: sources.library("lucide-react") }],
    },
    {
      code: 'export * as Lucide from "lucide-react-native";',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'const lucide = require("lucide-react-native");',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'const lucide = await import("lucide-react-native");',
      errors: [{ message: sources.library("lucide-react-native") }],
    },
    {
      code: 'const fonts = import("@expo/vector-icons");',
      errors: [{ message: sources.font("@expo/vector-icons") }],
    },
    {
      code: 'import { Ionicons } from "@expo/vector-icons";',
      errors: [{ message: sources.font("@expo/vector-icons") }],
    },
    {
      code: 'import Ionicons from "@expo/vector-icons/Ionicons";',
      errors: [{ message: sources.font("@expo/vector-icons/Ionicons") }],
    },
    {
      code: 'import Feather from "react-native-vector-icons/Feather";',
      errors: [{ message: sources.font("react-native-vector-icons/Feather") }],
    },
    {
      code: 'import { Ionicons } from "@react-native-vector-icons/ionicons";',
      errors: [{ message: sources.font("@react-native-vector-icons/ionicons") }],
    },
    {
      code: 'import type { IconProps } from "@expo/vector-icons/build/createIconSet";',
      errors: [{ message: sources.font("@expo/vector-icons/build/createIconSet") }],
    },
    {
      code: 'export { default } from "react-native-vector-icons";',
      errors: [{ message: sources.font("react-native-vector-icons") }],
    },
    {
      code: 'const Icons = require("@expo/vector-icons");',
      errors: [{ message: sources.font("@expo/vector-icons") }],
    },

    // -- Alias names, rewritten in place --------------------------------------
    {
      code: `${COMPONENTS}const a = <Icon name="home" />;`,
      output: `${COMPONENTS}const a = <Icon name="house" />;`,
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      // The quote it was written with is the quote it keeps.
      code: `${COMPONENTS}const a = <Button.Icon name='alert-circle' />;`,
      output: `${COMPONENTS}const a = <Button.Icon name='circle-alert' />;`,
      errors: [{ message: sources.alias("alert-circle", "circle-alert", "name") }],
    },
    {
      code: `${COMPONENTS}const a = <ToggleIcon name="home" />;`,
      output: `${COMPONENTS}const a = <ToggleIcon name="house" />;`,
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      // The resolved name is the imported one, so a rename does not hide it.
      code: 'import { Icon as Glyph } from "@mrmeg/expo-ui/components";\nconst a = <Glyph name="home" />;',
      output: 'import { Icon as Glyph } from "@mrmeg/expo-ui/components";\nconst a = <Glyph name="house" />;',
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      code: 'import * as UI from "@mrmeg/expo-ui/components";\nconst a = <UI.Icon name="home" />;',
      output: 'import * as UI from "@mrmeg/expo-ui/components";\nconst a = <UI.Icon name="house" />;',
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      // `icon` is an icon name on any design-system component.
      code: `${COMPONENTS}const a = <Item icon="home" />;`,
      output: `${COMPONENTS}const a = <Item icon="house" />;`,
      errors: [{ message: sources.alias("home", "house", "icon") }],
    },
    {
      code: `${COMPONENTS}const a = <Item icon={"home"} />;`,
      output: `${COMPONENTS}const a = <Item icon={"house"} />;`,
      errors: [{ message: sources.alias("home", "house", "icon") }],
    },
    {
      code: `${COMPONENTS}const a = <Icon name={\`home\`} />;`,
      output: `${COMPONENTS}const a = <Icon name={\`house\`} />;`,
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      // Only the alias branch is fixed.
      code: `${COMPONENTS}const a = <Icon name={open ? "home" : "x"} />;`,
      output: `${COMPONENTS}const a = <Icon name={open ? "house" : "x"} />;`,
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      code: `${COMPONENTS}const a = <Icon name={open ? "x" : "alert-circle"} />;`,
      output: `${COMPONENTS}const a = <Icon name={open ? "x" : "circle-alert"} />;`,
      errors: [{ message: sources.alias("alert-circle", "circle-alert", "name") }],
    },
    {
      code: `${COMPONENTS}const a = <Item icon={icon ?? "home"} />;`,
      output: `${COMPONENTS}const a = <Item icon={icon ?? "house"} />;`,
      errors: [{ message: sources.alias("home", "house", "icon") }],
    },
    {
      code: `${COMPONENTS}const a = <Icon name={open && "home"} />;`,
      output: `${COMPONENTS}const a = <Icon name={open && "house"} />;`,
      errors: [{ message: sources.alias("home", "house", "name") }],
    },
    {
      // Both branches, both fixed.
      code: `${COMPONENTS}const a = <Icon name={open ? "home" : "alert-circle"} />;`,
      output: `${COMPONENTS}const a = <Icon name={open ? "house" : "circle-alert"} />;`,
      errors: [
        { message: sources.alias("home", "house", "name") },
        { message: sources.alias("alert-circle", "circle-alert", "name") },
      ],
    },
    {
      // The import is reported and left as it is; the attribute is fixed.
      code: 'import { Home } from "lucide-react-native";\nimport { Icon } from "@mrmeg/expo-ui/components";\nexport const A = () => <Icon name="home" />;',
      output:
        'import { Home } from "lucide-react-native";\nimport { Icon } from "@mrmeg/expo-ui/components";\nexport const A = () => <Icon name="house" />;',
      errors: [
        { message: sources.component("Home", "lucide-react-native", "home", "house"), line: 1 },
        { message: sources.alias("home", "house", "name"), line: 3 },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// TypeScript-only forms, and exports of the Lucide packages that are not icons
// ---------------------------------------------------------------------------

ruleTester.run("icon-source (TypeScript forms)", rule, {
  valid: [
    // Another package's type, and a path that only starts like a banned one.
    'type P = import("react").ComponentProps<"div">;',
    'type P = import("lucide-react-nativex").Home;',
    'import Lucide = require("lucide-static");',
    'import Local = require("./lucide-react-native");',
    "import Alias = Namespace.Member;",
  ],
  invalid: [
    {
      // `import type` and an inline `type` modifier are reported like the value import.
      code: 'import type { Home } from "lucide-react-native";',
      errors: [{ message: sources.component("Home", "lucide-react-native", "home", "house") }],
    },
    {
      code: 'import { type Home } from "lucide-react-native";',
      errors: [{ message: sources.component("Home", "lucide-react-native", "home", "house") }],
    },
    {
      code: 'import Lucide = require("lucide-react-native");',
      errors: [{ message: sources.library("lucide-react-native"), line: 1, column: 25 }],
    },
    {
      code: 'import type Lucide = require("lucide-react");',
      errors: [{ message: sources.library("lucide-react") }],
    },
    {
      code: 'export import Lucide = require("lucide-react-native/icons");',
      errors: [{ message: sources.library("lucide-react-native/icons") }],
    },
    {
      code: 'import I = require("@expo/vector-icons");',
      errors: [{ message: sources.font("@expo/vector-icons") }],
    },
    {
      code: 'import F = require("@expo/vector-icons/Feather");',
      errors: [{ message: sources.font("@expo/vector-icons/Feather") }],
    },
    {
      code: 'import I = require("@react-native-vector-icons/ionicons");',
      errors: [{ message: sources.font("@react-native-vector-icons/ionicons") }],
    },
    {
      code: 'type P = React.ComponentProps<typeof import("lucide-react-native").Home>;',
      errors: [{ message: sources.library("lucide-react-native"), line: 1, column: 45 }],
    },
    {
      code: 'type L = import("lucide-react").LucideIcon;',
      errors: [{ message: sources.library("lucide-react") }],
    },
    {
      code: 'type I = import("@expo/vector-icons").Ionicons;',
      errors: [{ message: sources.font("@expo/vector-icons") }],
    },
    {
      code: 'type I = typeof import("react-native-vector-icons/Feather");',
      errors: [{ message: sources.font("react-native-vector-icons/Feather") }],
    },
  ],
});

// Type exports of Lucide's packages are the library, not icons: the one report
// is on the source, and no icon name is made up from them.
const NON_ICON_TYPE_CASES = [
  'import type { LucideIconNode } from "lucide-react-native";',
  'import { type LucideIconNode } from "lucide-react-native";',
  'import type { LucideIconData } from "lucide-react-native";',
  'import { type LucideIconData } from "lucide-react-native";',
  'import type { LucideIconNode } from "lucide-react";',
  'import type { LucideIconNode, LucideIconData } from "lucide-react-native";',
];

ruleTester.run("icon-source (non-icon exports)", rule, {
  valid: [],
  invalid: NON_ICON_TYPE_CASES.map((code) => ({
    code,
    errors: [
      {
        message: sources.library(/"lucide-react"/.test(code) ? "lucide-react" : "lucide-react-native"),
      },
    ],
  })),
});

describe("icon-source names Lucide aliases that have their own codepoints", () => {
  const linter = new Linter({ cwd: path.resolve(__dirname, "../../..") });
  const config = {
    files: ["**/*.tsx"],
    plugins: { "expo-ui": plugin },
    languageOptions,
    rules: { "expo-ui/icon-source": "error" },
  };
  const file = path.resolve(__dirname, "../../../client/file.tsx");

  // Lucide 1.57 keeps these four names with glyph files identical to a canonical icon.
  it.each([
    ["Trash2", "trash-2", "trash"],
    ["FlipHorizontal", "flip-horizontal", "square-centerline-dashed-horizontal"],
    ["FlipVertical", "flip-vertical", "square-centerline-dashed-vertical"],
    ["TextSelection", "text-selection", "square-dashed-text"],
  ])("%s resolves to a name the registry has", (component, kebab, canonical) => {
    const result = linter.verify(`import { ${component} } from "lucide-react-native";`, config, file);
    expect(result).toHaveLength(1);
    const message = result[0].message;
    // The name the reader is told to add is one the registry (and so the bin) accepts.
    const registered = /add ([a-z0-9-]+)`/.exec(message)?.[1];
    expect(registered).toBeDefined();
    expect(Object.keys(snapshot.icons)).toContain(registered);
    expect(message).toBe(sources.component(component, "lucide-react-native", kebab, canonical));
    expect(snapshot.aliases[kebab]).toBe(canonical);
  });

  it.each([
    ["trash-2", "trash"],
    ["flip-horizontal", "square-centerline-dashed-horizontal"],
  ])("rewrites name=%s to %s", (alias, canonical) => {
    const result = linter.verifyAndFix(`${COMPONENTS}const a = <Icon name="${alias}" />;`, config, file);
    expect(result.output).toBe(`${COMPONENTS}const a = <Icon name="${canonical}" />;`);
  });
});

// ---------------------------------------------------------------------------
// A manifest instead of sources
// ---------------------------------------------------------------------------

const iconNames = JSON.parse(
  fs.readFileSync(path.join(UI_SRC, "components", "icon-names.json"), "utf8"),
);
const snapshot = JSON.parse(fs.readFileSync(path.join(UI_SRC, "icons", "lucide.json"), "utf8"));

/**
 * The manifest the UI build writes: the serialized design system, then `icons`
 * after it. It needs the tokens and components too, or the loader rejects it and
 * the rule would report a missing design system instead of linting.
 */
const base = serializeDesignSystem(loadDesignSystem(UI_SRC), {
  packageName: "@mrmeg/expo-ui",
  version: "9.9.9",
});

/**
 * @param name a fresh file name: the loader caches per path, so two payloads must
 *   never share one
 */
function writeManifest(name: string, payload: unknown) {
  const file = path.join(TEMP_ROOT, name);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

function manifestTester(file: string) {
  return new RuleTester({
    languageOptions,
    // No sources anywhere: only the manifest can answer.
    settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir", manifestPath: file } },
  });
}

const FULL_MANIFEST = writeManifest("full.json", {
  ...base,
  icons: { names: iconNames, aliases: snapshot.aliases, lucide: snapshot.lucide },
});
// expo-ui 0.28: an `icons` block that holds the names and nothing else.
const NAMES_ONLY_MANIFEST = writeManifest("names-only.json", { ...base, icons: { names: iconNames } });
// expo-ui 0.27 and earlier: no `icons` key at all.
const NO_ICONS_MANIFEST = writeManifest("no-icons.json", base);

const consumer = messages(IN_CONSUMER);

// A 0.29+ manifest: aliases resolve, and a consumer runs its own bin.
manifestTester(FULL_MANIFEST).run("icon-source (manifest with aliases)", rule, {
  valid: [`${COMPONENTS}const a = <Icon name="house" />;`],
  invalid: [
    {
      code: 'import { Home } from "lucide-react-native";',
      errors: [
        {
          message:
            '`Home` from `"lucide-react-native"` is an icon-library component. Use `<Icon name="house" />` from `"@mrmeg/expo-ui/components"` (`home` is Lucide\'s old name for `house`); if `house` is not registered yet, run `bunx expo-ui-icons add house`.',
        },
      ],
    },
    {
      code: 'import * as L from "lucide-react";',
      errors: [{ message: consumer.library("lucide-react") }],
    },
    {
      code: 'import { Ionicons } from "@expo/vector-icons";',
      errors: [{ message: consumer.font("@expo/vector-icons") }],
    },
    {
      code: `${COMPONENTS}const a = <Icon name="home" />;`,
      output: `${COMPONENTS}const a = <Icon name="house" />;`,
      errors: [{ message: consumer.alias("home", "house", "name") }],
    },
  ],
});

const upgrade = messages(UPGRADE);

// The two older shapes behave alike: the ban holds, there are no alias fixes,
// and the reader is told to upgrade before running a bin they may not have.
for (const [label, file] of [
  ["names-only icons block", NAMES_ONLY_MANIFEST],
  ["no icons block", NO_ICONS_MANIFEST],
] as [string, string][]) {
  manifestTester(file).run(`icon-source (manifest, ${label})`, rule, {
    valid: [
      // `home` is not an alias here, because this manifest knows no aliases.
      `${COMPONENTS}const a = <Icon name="home" />;`,
      `${COMPONENTS}const a = <Item icon="alert-circle" />;`,
    ],
    invalid: [
      {
        // The kebab name as written, no alias note, and the upgrade clause.
        code: 'import { Home } from "lucide-react-native";',
        errors: [
          {
            message:
              '`Home` from `"lucide-react-native"` is an icon-library component. Use `<Icon name="home" />` from `"@mrmeg/expo-ui/components"`; if `home` is not registered yet, upgrade `@mrmeg/expo-ui` to 0.29.0 or later, then run `bunx expo-ui-icons add home`.',
          },
        ],
      },
      {
        code: 'import { AlertCircle } from "lucide-react";',
        errors: [{ message: upgrade.component("AlertCircle", "lucide-react", "alert-circle", "alert-circle") }],
      },
      {
        code: 'import * as L from "lucide-react-native";',
        errors: [{ message: upgrade.library("lucide-react-native") }],
      },
      {
        code: 'import Feather from "react-native-vector-icons/Feather";',
        errors: [{ message: upgrade.font("react-native-vector-icons/Feather") }],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Sources without a Lucide snapshot, and no design system at all
// ---------------------------------------------------------------------------

describe("icon-source without a Lucide snapshot", () => {
  // A copy of the sources that lacks `icons/lucide.json`: still a design system,
  // but one that cannot name aliases or promise the bin.
  const projectRoot = path.join(TEMP_ROOT, "no-snapshot");
  const copiedSources = path.join(projectRoot, "packages", "ui", "src");
  fs.mkdirSync(path.dirname(copiedSources), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "packages", "ui", "package.json"),
    `${JSON.stringify({ name: "@mrmeg/expo-ui", version: "9.9.9" })}\n`,
  );
  fs.cpSync(UI_SRC, copiedSources, {
    recursive: true,
    filter: (source: string) => !source.endsWith(path.join("icons", "lucide.json")),
  });

  const linter = new Linter({ cwd: projectRoot });
  const config = {
    files: ["**/*.tsx"],
    plugins: { "expo-ui": plugin },
    languageOptions,
    settings: { "expo-ui": { uiSourceDir: copiedSources } },
    rules: { "expo-ui/icon-source": "error" },
  };

  it("takes the kebab name and says to upgrade first", () => {
    const result = linter.verify(
      `${COMPONENTS}import { Home } from "lucide-react-native";\nconst a = <Icon name="home" />;`,
      config,
      path.join(projectRoot, "file.tsx"),
    );
    expect(result.map((entry: { message: string }) => entry.message)).toEqual([
      upgrade.component("Home", "lucide-react-native", "home", "home"),
    ]);
  });
});

describe("icon-source with no design system", () => {
  // `Linter` at a working directory outside this repo, where nothing resolves.
  const outside = fs.mkdtempSync(path.join(TEMP_ROOT, "outside-"));
  const linter = new Linter({ cwd: outside });
  const config = {
    files: ["**/*.tsx"],
    plugins: { "expo-ui": plugin },
    languageOptions,
    settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } },
    rules: { "expo-ui/icon-source": "error" },
  };

  it("still bans the import, and names the design system as missing", () => {
    const result = linter.verify(
      'import { Home } from "lucide-react-native";\nimport { Ionicons } from "@expo/vector-icons";',
      config,
      path.join(outside, "file.tsx"),
    );
    expect(result.map((entry: { message: string }) => entry.message)).toEqual([
      expect.stringContaining("Design-system facts were not found"),
      upgrade.component("Home", "lucide-react-native", "home", "home"),
      upgrade.font("@expo/vector-icons"),
    ]);
  });
});
