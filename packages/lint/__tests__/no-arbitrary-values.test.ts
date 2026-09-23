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

/** `const s: ViewStyle = …` — the smallest style position. */
const style = (body: string) => `const s: ViewStyle = ${body};`;

ruleTester.run("no-arbitrary-values", rule, {
  valid: [
    style("{ padding: spacing.md }"),
    style("{ borderRadius: spacing.radiusMd }"),
    // Zero needs no token.
    style("{ margin: 0, paddingTop: 0 }"),
    // On-scale values, negatives included.
    style("{ paddingHorizontal: 16, gap: 8, marginTop: -24 }"),
    style("{ borderTopLeftRadius: 14, borderRadius: 9999 }"),
    // Out of scope by design: type scale, dimensions, hairlines, icon size.
    style("{ fontSize: 13, lineHeight: 19 }"),
    style("{ width: 13, height: 13, maxWidth: 13 }"),
    style("{ borderWidth: 3, borderBottomWidth: 0.5 }"),
    'import { Icon } from "@mrmeg/expo-ui/components";\nconst x = <Icon name="x" size={13} />;',
    // Nothing to compare against.
    style("{ padding: props.pad }"),
    style("{ padding: spacing.md * 2 }"),

    // Objects that are never used as styles: a chart's padding, a gesture
    // config, a layout table.
    "const chart = { padding: 13, domainPadding: { x: 7 } };",
    "const x = <VictoryChart padding={{ top: 13, bottom: 7 }} />;",
    'const layout = [{ name: "compact", gap: 3 }];',
    "configure({ margin: 13 });",
  ],
  invalid: [
    {
      code: style("{ padding: 13 }"),
      errors: [
        {
          message:
            "`13` is not a spacing token. Nearest: `spacing.smd` (12), `spacing.md` (16). " +
            IMPORT_AND_FILE,
        },
      ],
    },
    {
      code: style("{ borderRadius: 13 }"),
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
      code: style("{ marginTop: -13 }"),
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
      code: style("{ marginTop: -3 }"),
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
      code: style("{ gap: 3 }"),
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
    {
      // Inline, through a variable, and through navigation options.
      code: [
        "const inset = { paddingHorizontal: 13 };",
        "const x = <View style={[{ margin: 7 }, inset]} />;",
        "const y = <Tabs screenOptions={{ tabBarStyle: { paddingBottom: 5 } }} />;",
      ].join("\n"),
      errors: [{ messageId: "offScale" }, { messageId: "offScale" }, { messageId: "offScale" }],
    },
    {
      // A `createThemedStyles` factory, a memoized style, and a local helper.
      code: [
        "const useStyles = createThemedStyles((theme) => ({ card: { borderRadius: 13 } }));",
        "const pad = useMemo(() => ({ padding: 13 }), []);",
        "const row = (dense) => ({ gap: dense ? 4 : 13, columnGap: 13 });",
        "const x = <View style={[pad, row(true)]} />;",
      ].join("\n"),
      errors: [{ messageId: "offScale" }, { messageId: "offScale" }, { messageId: "offScale" }],
    },
  ],
});
