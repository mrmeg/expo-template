const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-raw-colors");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } },
});

const COLORS_FILE = "Add a token in `packages/ui/src/constants/colors.ts` only if the design explicitly calls for one.";

ruleTester.run("no-raw-colors", rule, {
  valid: [
    // The sanctioned paths.
    "const s = { color: theme.colors.mutedForeground };",
    "const s = { backgroundColor: palette.red500 };",
    "const s = { shadowColor: withAlpha(palette.black, 0.2) };",
    // Explicitly allowed: it is not a color, it is the absence of one.
    'const s = { backgroundColor: "transparent" };',
    // A token table: the keys are token names, not style keys. This is the
    // `PALETTES` shape in `ThemedShowcaseScreen.tsx`.
    'const PALETTES = { violet: { light: { primary: "#7C3AED", border: "#DDD6FE" } } };',
    // Not a color property.
    'const s = { fontFamily: "#000" };',
    // Not a design-system component, so its props are not ours to police.
    'import { Chart } from "./Chart";\nconst x = <Chart color="#fff" />;',
    // No literal to read.
    "const s = { color: isActive ? a : b };",
    'const s = { color: `${prefix}-500` };',
  ],
  invalid: [
    {
      code: 'const s = { color: "#DB4437" };',
      errors: [
        {
          message:
            '`"#DB4437"` is a raw color. Use a theme token from `useTheme()`: `theme.colors.destructive`. Use `palette.red500` from `"@mrmeg/expo-ui/constants"` only where the color must ignore the color scheme. ' +
            COLORS_FILE,
        },
      ],
    },
    {
      // Alpha earns the `withAlpha` sentence.
      code: 'const s = { backgroundColor: "rgba(0, 0, 0, 0.3)" };',
      errors: [
        {
          message:
            '`"rgba(0, 0, 0, 0.3)"` is a raw color. Use a theme token from `useTheme()`. Use `palette.black` from `"@mrmeg/expo-ui/constants"` only where the color must ignore the color scheme. For alpha, `withAlpha(color, 0.3)` from `"@mrmeg/expo-ui/hooks"`. ' +
            COLORS_FILE,
        },
      ],
    },
    {
      // CSS keyword.
      code: 'const s = { borderColor: "black" };',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Expression-free template literal.
      code: "const s = { shadowColor: `#000` };",
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Inside `StyleSheet.create`, which is where most of them live.
      code: 'const styles = StyleSheet.create({ card: { backgroundColor: "#fff" } });',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // A color-valued prop on a design-system element.
      code: 'import { Icon } from "@mrmeg/expo-ui/components";\nconst x = <Icon name="x" color="#fff" />;',
      errors: [
        {
          message:
            '`"#fff"` is a raw color. Use a theme token from `useTheme()`: `theme.colors.background`, `theme.colors.card`, `theme.colors.popover`. Use `palette.white` from `"@mrmeg/expo-ui/constants"` only where the color must ignore the color scheme. ' +
            COLORS_FILE,
        },
      ],
    },
    {
      code: 'import { Input } from "@mrmeg/expo-ui/components";\nconst x = <Input placeholderTextColor="#999" />;',
      errors: [{ messageId: "rawColor" }],
    },
  ],
});
