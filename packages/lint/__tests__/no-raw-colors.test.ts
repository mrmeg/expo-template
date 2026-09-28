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
    "const x = <View style={{ color: theme.colors.mutedForeground }} />;",
    "const x = <View style={{ backgroundColor: palette.red500 }} />;",
    "const x = <View style={{ shadowColor: withAlpha(palette.black, 0.2) }} />;",
    // Explicitly allowed: it is not a color, it is the absence of one.
    'const x = <View style={{ backgroundColor: "transparent" }} />;',
    // A token table: the keys are token names, not style keys. This is the
    // `PALETTES` shape in `ThemedShowcaseScreen.tsx`.
    'const PALETTES = { violet: { light: { primary: "#7C3AED", border: "#DDD6FE" } } };',
    // Not a color property.
    'const x = <View style={{ fontFamily: "#000" }} />;',
    // Not a design-system component, so its props are not ours to police.
    'import { Chart } from "./Chart";\nconst x = <Chart color="#fff" />;',
    // No literal to read.
    "const x = <View style={{ color: isActive ? a : b }} />;",
    "const x = <View style={{ color: `${prefix}-500` }} />;",

    // Objects that are never used as styles are data, whatever their keys say.
    // Chart series:
    'const series = [{ label: "Revenue", color: "#f00", value: 3 }];',
    'const data = { color: "#DB4437" };\nconst chart = <Chart data={data} />;',
    // A Google Maps theme passed through a prop that only looks like a style:
    // its `color` keys sit below the objects the prop receives.
    'const x = <MapView customMapStyle={[{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }]} />;',
    // Config objects handed to non-style props and functions.
    'const x = <Chart theme={{ backgroundColor: "#fff" }} />;',
    'track("tap", { color: "#f00" });',
    // A `*Style` key whose value is not an object.
    'const x = <StatusBar options={{ barStyle: "dark", color: "#000" }} />;',
    // An imported object cannot be resolved; unresolvable styles stay silent.
    'import { cardStyle } from "./styles";\nconst x = <View style={cardStyle} />;',
  ],
  invalid: [
    {
      code: 'const x = <View style={{ color: "#DB4437" }} />;',
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
      code: 'const styles = StyleSheet.create({ scrim: { backgroundColor: "rgba(0, 0, 0, 0.3)" } });',
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
      code: 'const x = <View style={{ borderColor: "black" }} />;',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Expression-free template literal.
      code: "const x = <View style={{ shadowColor: `#000` }} />;",
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Inside `StyleSheet.create`, which is where most of them live.
      code: 'const styles = StyleSheet.create({ card: { backgroundColor: "#fff" } });',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // A `createThemedStyles` factory is a sheet too.
      code: 'const useStyles = createThemedStyles((theme) => ({ card: { borderColor: "#eee" } }));',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Declared first, used as a style later: the object is a style.
      code: 'const card = { backgroundColor: "#fff" };\nconst x = <View style={card} />;',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // Through an array, a conditional, a logical, and a sheet member.
      code: [
        'const styles = StyleSheet.create({ card: {} });',
        'const active = { borderColor: "#00f" };',
        'const x = <View style={[styles.card, on ? active : { borderColor: "#ccc" }, busy && { opacity: 0.5, backgroundColor: "#fafafa" }]} />;',
      ].join("\n"),
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      // `*Style` props, and a Pressable style function.
      code: [
        'const a = <ScrollView contentContainerStyle={{ backgroundColor: "#fff" }} />;',
        'const b = <Pressable style={({ pressed }) => [{ backgroundColor: pressed ? "#eee" : "#fff" }]} />;',
      ].join("\n"),
      errors: [{ messageId: "rawColor" }],
    },
    {
      // `pressed ? "#eee" : "#fff"` is not a literal, but a returned object is.
      code: 'const b = <Pressable style={({ pressed }) => (pressed ? { backgroundColor: "#eee" } : null)} />;',
      errors: [{ messageId: "rawColor" }],
    },
    {
      // A map of states (native tabs' `labelStyle`): each state is a style.
      code: 'const x = <NativeTabs labelStyle={{ default: { color: "#999" }, selected: { color: "#f00" } }} />;',
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      // Navigation options: a `*Style` property's object is a style.
      code: 'const x = <Stack.Screen options={{ headerStyle: { backgroundColor: "#000" }, contentStyle: { backgroundColor: "#111" } }} />;',
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      // A memoized style and a local style helper.
      code: [
        'const tint = useMemo(() => ({ tintColor: "#f0f" }), []);',
        'function cardStyle(active) { return { backgroundColor: active ? theme.colors.card : "#fff", borderColor: "#ddd" }; }',
        "const x = <View style={[cardStyle(on), tint]} />;",
      ].join("\n"),
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      // Known style helpers.
      code: [
        'const flat = StyleSheet.flatten([{ color: "#123456" }]);',
        'const composed = StyleSheet.compose(base, { color: "#654321" });',
        'const animated = useAnimatedStyle(() => ({ backgroundColor: "#abcdef" }));',
      ].join("\n"),
      errors: [{ messageId: "rawColor" }, { messageId: "rawColor" }, { messageId: "rawColor" }],
    },
    {
      // Typed as a style, however it is used.
      code: [
        'const a: ViewStyle = { backgroundColor: "#fff" };',
        'const b = { color: "#000" } as TextStyle;',
        'const c = { borderColor: "#111" } satisfies ViewStyle;',
        'const d: StyleProp<ViewStyle> = [{ shadowColor: "#222" }];',
        'function e(): ViewStyle { return { backgroundColor: "#333" }; }',
        'const f = (): TextStyle => ({ color: "#444" });',
      ].join("\n"),
      errors: Array.from({ length: 6 }, () => ({ messageId: "rawColor" })),
    },
    {
      // One object reached through two style props is reported once.
      code: 'const shared = { color: "#f00" };\nconst x = <><View style={shared} /><Text style={[shared]} /></>;',
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
