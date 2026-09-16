const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-arbitrary-values");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } },
});

const IMPORT_AND_FILE =
'Import `{ spacing }` from `"@mrmeg/expo-ui/constants"`. Add a token in `packages/ui/src/constants/spacing.ts` only if the design explicitly calls for one.';

ruleTester.run("no-arbitrary-values", rule, {
  valid: [
    "const s = { padding: spacing.md };",
    "const s = { borderRadius: spacing.radiusMd };",
    // Zero needs no token.
    "const s = { margin: 0, paddingTop: 0 };",
    // On-scale values, negatives included.
    "const s = { paddingHorizontal: 16, gap: 8, marginTop: -24 };",
    "const s = { borderTopLeftRadius: 14, borderRadius: 9999 };",
    // Out of scope by design: type scale, dimensions, hairlines, icon size.
    "const s = { fontSize: 13, lineHeight: 19 };",
    "const s = { width: 13, height: 13, maxWidth: 13 };",
    "const s = { borderWidth: 3, borderBottomWidth: 0.5 };",
    'import { Icon } from "@mrmeg/expo-ui/components";\nconst x = <Icon name="x" size={13} />;',
    // Nothing to compare against.
    "const s = { padding: props.pad };",
    "const s = { padding: spacing.md * 2 };",
  ],
  invalid: [
    {
      code: "const s = { padding: 13 };",
      errors: [
        {
          message:
            "`13` is not a spacing token. Nearest: `spacing.smd` (12), `spacing.md` (16). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      code: "const s = { borderRadius: 13 };",
      errors: [
        {
          message:
            "`13` is not a radius token. Nearest: `spacing.radiusLg` (14), `spacing.radiusMd` (10). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      // A negated literal is measured on its magnitude, and the suggestion is
      // negated with it: `spacing.smd` would flip the offset.
      code: "const s = { marginTop: -13 };",
      errors: [
        {
          message:
            "`-13` is not a spacing token. Nearest: `-spacing.smd` (-12), `-spacing.md` (-16). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      // Below the bottom of the scale and negative: both suggestions are
      // negative too.
      code: "const s = { marginTop: -3 };",
      errors: [
        {
          message:
            "`-3` is not a spacing token. Nearest: `-spacing.xxs` (-2), `-spacing.xs` (-4). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      // Below the bottom of the scale: both suggestions come from above.
      code: "const s = { gap: 3 };",
      errors: [
        {
          message:
            "`3` is not a spacing token. Nearest: `spacing.xxs` (2), `spacing.xs` (4). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      code: "const styles = StyleSheet.create({ row: { paddingVertical: 7, rowGap: 13 } });",
      errors: [{ messageId: "offScale" }, { messageId: "offScale" }],
    },
  ],
});
