const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-restyle");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } },
});

const IMPORT =
  'import { Button, Card, StyledText, BodyText, SansSerifBoldText, ItemTitle, Label, AnimatedView, BottomSheet, TextInput } from "@mrmeg/expo-ui/components";\n';

const NOT_FOUND =
  'Design-system sources were not found at `/nonexistent/dir`; the expo-ui rules need `packages/ui/src` (or `settings["expo-ui"].uiSourceDir`) to point at the @mrmeg/expo-ui sources.';

ruleTester.run("no-restyle", rule, {
  valid: [
    // Placing and spacing a component from the outside is the caller's job.
    IMPORT + "const x = <Card style={{ marginTop: 8, flex: 1, alignSelf: 'stretch' }} />;",
    IMPORT + "const x = <Card style={{ padding: 16 }} />;",
    // Unresolvable styles are skipped rather than guessed at.
    IMPORT + "const x = <Card style={props.style} />;",
    IMPORT + "const x = <Card style={styles.card} />;",
    // Not a design-system component.
    'import { Button } from "./Button";\nconst x = <Button style={{ backgroundColor: "red" }} />;',
    // Text components have no color prop, so a theme token in `style` is
    // the sanctioned path.
    IMPORT + "const x = <BodyText style={{ color: theme.colors.primary }} />;",
    // `ItemTitle` wraps `StyledText`, so it is text-like too.
    IMPORT + "const x = <ItemTitle style={{ color: theme.colors.mutedForeground }} />;",
    // Passthrough wrappers carry their child's styles.
    IMPORT + 'const x = <AnimatedView style={{ backgroundColor: theme.colors.card, borderRadius: 8 }} />;',
    // The documented transparent-sheet path: the native surface, and the
    // content column's own card fill.
    IMPORT + 'const x = <BottomSheet.Content backgroundStyle={{ backgroundColor: "transparent" }} />;',
    IMPORT + 'const x = <BottomSheet.Content style={{ backgroundColor: "transparent" }} />;',
    // State styles exist to restyle those states.
    IMPORT +
      "const x = <Button pressedStyle={{ backgroundColor: theme.colors.muted, borderRadius: 8 }} />;",
    IMPORT + "const x = <Button disabledStyle={{ opacity: 0.5, borderColor: theme.colors.border }} />;",
    IMPORT + "const x = <Button textStyle={{ color: theme.colors.primary }} />;",
    IMPORT + "const x = <Button pressedTextStyle={{ color: theme.colors.primaryForeground }} />;",
    // The focus treatment is the reason `focusedStyle` exists.
    IMPORT +
      "const x = <TextInput focusedStyle={{ borderColor: theme.colors.primary, borderWidth: 2 }} />;",
    {
      // Rule options extend the defaults rather than replacing them.
      code: IMPORT + "const x = <Card style={{ borderRadius: 8 }} />;",
      options: [{ contracts: [{ pattern: "^Card$", allow: ["shape"] }] }],
    },
  ],
  invalid: [
    {
      code: IMPORT + 'const x = <Button style={{ backgroundColor: "red" }} />;',
      errors: [
        {
          message:
            '`"backgroundColor"` is not allowed on `<Button>`: Button owns its color. Use `preset`: default | outline | ghost | link | destructive | secondary. Add a preset in `packages/ui/src/components/Button.tsx` only if the design explicitly calls for a treatment none of them provides.',
        },
      ],
    },
    {
      // A component that declares `size` owns its internal spacing too.
      code: IMPORT + "const x = <Button style={{ paddingHorizontal: 16 }} />;",
      errors: [
        {
          message:
            '`"paddingHorizontal"` is not allowed on `<Button>`: Button owns its spacing. Use `size`: sm | md | lg, or put margin on it or padding on a parent for space around it.',
        },
      ],
    },
    {
      code: IMPORT + "const x = <StyledText style={{ fontSize: 20 }} />;",
      errors: [
        {
          message:
            '`"fontSize"` is not allowed on `<StyledText>`: StyledText owns its typography. Use `size`, `semantic`, `fontWeight`, or `align`; `variant` picks the font family (sansSerif | serif | mono).',
        },
      ],
    },
    {
      // `ItemTitle` forwards `TextProps`, so it gets the same advice.
      code: IMPORT + 'const x = <ItemTitle style={{ fontWeight: "600" }} />;',
      errors: [
        {
          message:
            '`"fontWeight"` is not allowed on `<ItemTitle>`: ItemTitle owns its typography. Use `size`, `semantic`, `fontWeight`, or `align`; `variant` picks the font family (sansSerif | serif | mono).',
        },
      ],
    },
    {
      // Text declares `size`, but the type scale is not the fix for padding, so
      // the spacing message does not name it.
      code: IMPORT + "const x = <SansSerifBoldText style={{ paddingHorizontal: 16 }} />;",
      errors: [
        {
          message:
            '`"paddingHorizontal"` is not allowed on `<SansSerifBoldText>`: SansSerifBoldText owns its spacing. Put margin on it or padding on a parent for space around it.',
        },
      ],
    },
    {
      // `Label` is text-like but declares only its own three sizes.
      code: IMPORT + "const x = <Label style={{ letterSpacing: 2 }} />;",
      errors: [
        {
          message:
            '`"letterSpacing"` is not allowed on `<Label>`: Label owns its typography. Use `size` (sm | md | lg).',
        },
      ],
    },
    {
      // Resolved through a module-scope `StyleSheet.create`.
      code:
        IMPORT +
        'import { StyleSheet } from "react-native";\n' +
        "const styles = StyleSheet.create({ card: { marginTop: 8, borderRadius: 8 } });\n" +
        "const x = <Card style={styles.card} />;",
      errors: [
        {
          message:
            '`"borderRadius"` is not allowed on `<Card>`: Card owns its shape. Use `variant`: default | outline | ghost. Add a variant in `packages/ui/src/components/Card.tsx` only if the design explicitly calls for a treatment none of them provides.',
        },
      ],
    },
    {
      // Resolved through the `createThemedStyles` / `themedStyles(theme)` pair.
      code:
        IMPORT +
        'import { createThemedStyles } from "@mrmeg/expo-ui/hooks";\n' +
        'import { StyleSheet } from "react-native";\n' +
        "const createStyles = (theme) => StyleSheet.create({ card: { backgroundColor: theme.colors.card } });\n" +
        "const themedStyles = createThemedStyles(createStyles);\n" +
        "function C({ theme }) {\n  const styles = themedStyles(theme);\n  return <Card style={styles.card} />;\n}",
      errors: [{ messageId: "restyle" }],
    },
    {
      // Arrays and conditional branches are both walked.
      code:
        IMPORT +
        'const x = <Card style={[{ marginTop: 8 }, isActive && { backgroundColor: "red" }]} />;',
      errors: [{ messageId: "restyle" }],
    },
    {
      // The imported name is what the message names, not the local alias.
      code:
        'import { Button as Btn } from "@mrmeg/expo-ui/components";\nconst x = <Btn style={{ backgroundColor: "red" }} />;',
      errors: [
        {
          message:
            '`"backgroundColor"` is not allowed on `<Button>`: Button owns its color. Use `preset`: default | outline | ghost | link | destructive | secondary. Add a preset in `packages/ui/src/components/Button.tsx` only if the design explicitly calls for a treatment none of them provides.',
        },
      ],
    },
    {
      // A `*Style` prop is policed like `style`.
      code: IMPORT + "const x = <Card contentContainerStyle={{ borderRadius: 8 }} />;",
      errors: [{ messageId: "restyle" }],
    },
    {
      // Options can close a category the defaults leave open.
      code: IMPORT + 'const x = <AnimatedView style={{ backgroundColor: "red" }} />;',
      options: [{ contracts: [{ pattern: "^AnimatedView$", deny: ["color"] }] }],
      errors: [{ messageId: "restyle" }],
    },
    {
      // `textStyle` carries a color, not the type scale: the child owns that.
      code: IMPORT + 'const x = <Button textStyle={{ fontWeight: "600" }} />;',
      errors: [
        {
          message:
            '`"fontWeight"` is not allowed in `textStyle` on `<Button>`: Button.Text owns its typography. Render `<Button.Text size=\u2026 fontWeight=\u2026>` as the child instead of `textStyle`.',
        },
      ],
    },
    {
      // The same for the state variants of it.
      code: IMPORT + "const x = <Button disabledTextStyle={{ fontSize: 20 }} />;",
      errors: [
        {
          message:
            '`"fontSize"` is not allowed in `disabledTextStyle` on `<Button>`: Button.Text owns its typography. Render `<Button.Text size=\u2026 fontWeight=\u2026>` as the child instead of `disabledTextStyle`.',
        },
      ],
    },
    {
      // `pressedStyle` opens color and shape, not the type scale.
      code: IMPORT + 'const x = <Button pressedStyle={{ fontStyle: "italic" }} />;',
      errors: [{ messageId: "restyle" }],
    },
    {
      // `backgroundStyle` is only sanctioned on the sheet; elsewhere it is a
      // restyle like any other.
      code: IMPORT + 'const x = <Card backgroundStyle={{ backgroundColor: "red" }} />;',
      errors: [
        {
          message:
            '`"backgroundColor"` is not allowed on `<Card>`: Card owns its color. Use `variant`: default | outline | ghost. Add a variant in `packages/ui/src/components/Card.tsx` only if the design explicitly calls for a treatment none of them provides.',
        },
      ],
    },
    {
      // No prop produces italics, so the message must not promise one.
      code: IMPORT + 'const x = <StyledText style={{ fontStyle: "italic" }} />;',
      errors: [
        {
          message:
            '`"fontStyle"` is not allowed on `<StyledText>`: StyledText owns its typography and has no italic prop. Add one in `packages/ui/src/components/StyledText.tsx` only if the design explicitly calls for it.',
        },
      ],
    },
    {
      code: IMPORT + 'const x = <BodyText style={{ textDecorationLine: "underline" }} />;',
      errors: [
        {
          message:
            '`"textDecorationLine"` is not allowed on `<BodyText>`: BodyText owns its typography and has no text-decoration prop. Add one in `packages/ui/src/components/StyledText.tsx` only if the design explicitly calls for it.',
        },
      ],
    },
    {
      // `Label` takes the same answer: the prop would live in `StyledText`.
      code: IMPORT + 'const x = <Label style={{ textDecorationStyle: "dotted" }} />;',
      errors: [
        {
          message:
            '`"textDecorationStyle"` is not allowed on `<Label>`: Label owns its typography and has no text-decoration prop. Add one in `packages/ui/src/components/StyledText.tsx` only if the design explicitly calls for it.',
        },
      ],
    },
    {
      // An optional sheet read is a `ChainExpression`; without unwrapping it the
      // whole style is invisible.
      code:
        IMPORT +
        'import { StyleSheet } from "react-native";\n' +
        "const styles = StyleSheet.create({ card: { marginTop: 8, borderRadius: 8 } });\n" +
        "const x = <Card style={styles?.card} />;",
      errors: [
        {
          message:
            '`"borderRadius"` is not allowed on `<Card>`: Card owns its shape. Use `variant`: default | outline | ghost. Add a variant in `packages/ui/src/components/Card.tsx` only if the design explicitly calls for a treatment none of them provides.',
        },
      ],
    },
    {
      // A design system that cannot be read is reported once per file, not
      // silently ignored.
      code: IMPORT + "const x = <Button />;",
      settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } },
      errors: [{ message: NOT_FOUND }],
    },
  ],
});
