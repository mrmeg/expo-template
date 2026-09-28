/**
 * Typography goes through `StyledText` (`size`, `semantic`, `variant`,
 * `fontWeight`) or `useFontStyle`, never through a literal in a style. The
 * messages name the size whose font size or line height the literal matches,
 * or the two sizes that bracket it, read from `StyledText.tsx` at lint time.
 */
const path = require("node:path");
const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-raw-typography");

const UI_SRC = path.resolve(__dirname, "../../ui/src");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } },
});

const SIZE_GUIDANCE =
  "Use `size` or a `semantic` variant on `StyledText` instead of `fontSize` in a style.";
const LINE_HEIGHT_GUIDANCE =
  "Use `size` on `StyledText` instead of `lineHeight` in a style; every size carries its line height.";
const FAMILY_TAIL = "A brand face goes through `setFonts`, never a literal.";

/** `const s: TextStyle = …` — the smallest style position. */
const style = (body: string) => `const s: TextStyle = ${body};`;

ruleTester.run("no-raw-typography", rule, {
  valid: [
    // Typography through the component.
    'import { StyledText } from "@mrmeg/expo-ui/components";\nconst x = <StyledText size="lg" fontWeight="semibold">Hi</StyledText>;',
    // Zero and undefined say "unset", not "this size".
    style("{ fontSize: 0, lineHeight: 0 }"),
    style("{ fontSize: undefined, fontFamily: undefined }"),
    // Not literals: a token, a prop, a hook result.
    style("{ fontSize: typography.sm.fontSize, lineHeight: typography.sm.lineHeight }"),
    style("{ fontSize: props.size }"),
    "const font = useFontStyle(\"medium\");\nconst s: TextStyle = { ...font, fontSize: font.fontSize };",
    // Other typography keys are not this rule's.
    style("{ fontWeight: \"600\", letterSpacing: 0.4, textTransform: \"uppercase\" }"),
    // Objects that are never used as styles: a chart config, a PDF layout.
    "const chart = { fontSize: 13, fontFamily: \"Menlo\" };",
    "const axis = { tickLabels: { fontSize: 13, lineHeight: 19 } };",
    "configure({ fontSize: 13, lineHeight: 19 });",
  ],
  invalid: [
    {
      // Exactly a StyledText size: name it with both numbers.
      code: style("{ fontSize: 14 }"),
      errors: [
        {
          message:
            "`14` is a raw font size. `StyledText size=\"base\"` renders it (14/21). " + SIZE_GUIDANCE,
        },
      ],
    },
    {
      // Off the scale: bracket it.
      code: style("{ fontSize: 13 }"),
      errors: [
        {
          message:
            "`13` is a raw font size. Nearest `StyledText` sizes: `sm` (12), `base` (14). " +
            SIZE_GUIDANCE,
        },
      ],
    },
    {
      // Past the top of the scale: both suggestions come from below.
      code: style("{ fontSize: 40 }"),
      errors: [
        {
          message:
            "`40` is a raw font size. Nearest `StyledText` sizes: `display` (34), `xxl` (28). " +
            SIZE_GUIDANCE,
        },
      ],
    },
    {
      code: style("{ lineHeight: 18 }"),
      errors: [
        {
          message:
            "`18` is a raw line height. `StyledText size=\"sm\"` sets it (12/18). " +
            LINE_HEIGHT_GUIDANCE,
        },
      ],
    },
    {
      code: style("{ lineHeight: 20 }"),
      errors: [
        {
          message:
            "`20` is a raw line height. Nearest `StyledText` sizes by line height: `base` (21), `sm` (18). " +
            LINE_HEIGHT_GUIDANCE,
        },
      ],
    },
    {
      // A kit face at one weight: name the variant and the weight.
      code: style("{ fontFamily: \"Inter_500Medium\" }"),
      errors: [
        {
          message:
            "`\"Inter_500Medium\"` is a raw font family. It is the kit's `sansSerif` face at `medium`: use `StyledText variant=\"sansSerif\" fontWeight=\"medium\"` or `useFontStyle(\"medium\", \"sansSerif\")`. " +
            FAMILY_TAIL,
        },
      ],
    },
    {
      // A kit face shared by every weight: name the variant only.
      code: style("{ fontFamily: \"Georgia\" }"),
      errors: [
        {
          message:
            "`\"Georgia\"` is a raw font family. It is the kit's `serif` face: use `StyledText variant=\"serif\"` (weight through `fontWeight`) or `useFontStyle(weight, \"serif\")`. " +
            FAMILY_TAIL,
        },
      ],
    },
    {
      // The first family of a stack matches the kit's stack.
      code: style("{ fontFamily: \"Inter\" }"),
      errors: [{ message: /is the kit's `sansSerif` face: use `StyledText variant="sansSerif"`/ }],
    },
    {
      // Unknown to the kit: the props are still the answer.
      code: style("{ fontFamily: \"Comic Sans MS\" }"),
      errors: [
        {
          message:
            "`\"Comic Sans MS\"` is a raw font family. Use `StyledText variant` (sansSerif | serif | mono) or `useFontStyle(weight, variant)`. " +
            FAMILY_TAIL,
        },
      ],
    },
    {
      // A template literal is a literal too.
      code: style("{ fontFamily: `Menlo` }"),
      errors: [{ message: /is the kit's `mono` face/ }],
    },
    {
      // Every style position the other value rules see: a sheet, a themed
      // factory, a Pressable style function, navigation options.
      code: [
        "const styles = StyleSheet.create({ label: { fontSize: 13, lineHeight: 19 } });",
        "const useStyles = createThemedStyles((theme) => ({ title: { fontSize: 24 } }));",
        "const x = <Pressable style={({ pressed }) => [{ fontSize: 15 }]} />;",
        "const y = <Tabs screenOptions={{ tabBarLabelStyle: { fontSize: 10 } }} />;",
      ].join("\n"),
      errors: [
        { messageId: "rawFontSize" },
        { messageId: "rawLineHeight" },
        { messageId: "rawFontSize" },
        { messageId: "rawFontSize" },
        { messageId: "rawFontSize" },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Facts without typography
// ---------------------------------------------------------------------------

const fs = require("node:fs");
const os = require("node:os");
const { loadDesignSystem } = require("../lib/source");
const { serializeDesignSystem } = require("../lib/manifest");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-typography-"));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

// A schemaVersion 1 manifest: written before `tokens.typography` and `fonts`
// existed. It still loads, and this rule says once per file what it lacks.
const LEGACY_MANIFEST = path.join(TMP, "legacy.json");
const legacy = serializeDesignSystem(loadDesignSystem(UI_SRC), {
  packageName: "@mrmeg/expo-ui",
  version: "0.25.0",
});
delete legacy.tokens.typography;
delete legacy.fonts;
legacy.schemaVersion = 1;
fs.writeFileSync(LEGACY_MANIFEST, JSON.stringify(legacy));

const legacyTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { manifestPath: LEGACY_MANIFEST } },
});

const LEGACY_MESSAGE = `Design-system typography facts are missing: the manifest at \`${LEGACY_MANIFEST}\` predates \`no-raw-typography\` (schemaVersion 1, no \`tokens.typography\`). Install an @mrmeg/expo-ui release that ships them, or set \`settings["expo-ui"].uiSourceDir\` to the sources.`;

legacyTester.run("no-raw-typography (manifest without typography)", rule, {
  valid: [],
  invalid: [
    {
      // Reported once per file, and the literal is still flagged with the
      // props as the answer, since no size can be named.
      code: style("{ fontSize: 13, fontSize2: 1 }"),
      errors: [
        { message: LEGACY_MESSAGE },
        { message: "`13` is a raw font size. " + SIZE_GUIDANCE },
      ],
    },
  ],
});
