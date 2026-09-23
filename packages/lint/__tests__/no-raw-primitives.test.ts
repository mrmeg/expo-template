const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-raw-primitives");

const languageOptions = {
  parser: tsParser,
  ecmaVersion: 2022,
  sourceType: "module",
  parserOptions: { ecmaFeatures: { jsx: true } },
};

const ruleTester = new RuleTester({ languageOptions });

const wrapped = (name: string) =>
  `\`${name}\` from \`"react-native"\` is wrapped by the design system. Use \`${name}\` from \`"@mrmeg/expo-ui/components"\`, which applies the theme and the shared props.`;

ruleTester.run("no-raw-primitives", rule, {
  valid: [
    // Primitives the design system deliberately does not wrap.
    'import { View, Pressable, TouchableOpacity, ScrollView, FlatList, Image, ActivityIndicator, StyleSheet } from "react-native";',
    // APIs are not primitives, even where the design system has a helper of the
    // same name (`Alert.show`).
    'import { Alert, Keyboard, Platform } from "react-native";',
    'import type { TextStyle } from "react-native";',
    // A type-only import renders nothing, so it cannot render with the wrong
    // font: these are how a wrapper's own props get typed.
    'import type { Text } from "react-native";',
    'import { type Text as T, View } from "react-native";',
    'import type { TextInputProps, TextInput } from "react-native";',
    'import { type Switch as NativeSwitch, View } from "react-native";',
    'import type { RootProps } from "@rn-primitives/select";',
    // Inline type specifiers only: a value import of no values.
    'import { type RootProps, type Root } from "@rn-primitives/select";',
    'import type { SliderProps } from "@expo/ui/community/slider";',
    'import { type TextInputProps } from "@expo/ui";',
    // `@expo/ui` beyond the wrapped surfaces.
    'import { Host, Picker } from "@expo/ui";',
    'import { Button } from "@expo/ui/swift-ui";',
    // Constants and hooks are the sanctioned imports.
    'import { palette, spacing } from "@mrmeg/expo-ui/constants";',
    // A local `Text` is not the platform primitive.
    'import { Text } from "./Text";',
    'import { TextInput } from "./TextInput";',
  ],
  invalid: [
    {
      code: 'import { Text } from "react-native";',
      errors: [
        {
          message:
            '`Text` from `"react-native"` is a raw primitive: it renders with the platform font and no theme color. Use `StyledText` or a semantic alias (`TitleText`, `BodyText`, `CaptionText`, ...) from `"@mrmeg/expo-ui/components"`.',
        },
      ],
    },
    {
      // An alias does not change what is imported.
      code: 'import { View, Text as RNText } from "react-native";',
      errors: [{ messageId: "rawPrimitive" }],
    },
    {
      code: 'import { TextInput } from "react-native";',
      errors: [{ message: wrapped("TextInput") }],
    },
    {
      code: 'import { Switch as RNSwitch, View } from "react-native";',
      errors: [{ message: wrapped("Switch") }],
    },
    {
      // Every React Native component the design system has a component of the
      // same name for.
      code: 'import { Button, KeyboardAvoidingView, StatusBar, Pressable } from "react-native";',
      errors: [
        { message: wrapped("Button") },
        { message: wrapped("KeyboardAvoidingView") },
        { message: wrapped("StatusBar") },
      ],
    },
    {
      code: 'import * as Checkbox from "@rn-primitives/checkbox";',
      errors: [
        {
          message:
            '`"@rn-primitives/checkbox"` is the headless layer that the design system wraps. Import the styled component from `"@mrmeg/expo-ui/components"`.',
        },
      ],
    },
    {
      code: 'import { Slider } from "@expo/ui/community/slider";',
      errors: [
        {
          message:
            '`"@expo/ui/community/slider"` is wrapped by the design system. Use `Slider` from `"@mrmeg/expo-ui/components"`, which applies the theme and the shared props.',
        },
      ],
    },
    {
      code: 'import { BottomSheet } from "@expo/ui/community/bottom-sheet";',
      errors: [{ messageId: "rawPrimitive" }],
    },
    {
      code: 'import { SegmentedControl } from "@expo/ui/community/segmented-control";',
      errors: [{ messageId: "rawPrimitive" }],
    },
    {
      code: 'import { TextInput } from "@expo/ui";',
      errors: [
        {
          message:
            '`TextInput` from `"@expo/ui"` is wrapped by the design system. Use `TextInput` from `"@mrmeg/expo-ui/components"`, which applies the theme and the shared props.',
        },
      ],
    },
  ],
});

describe("the react-native wrapper table comes from the design system", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-primitives-"));
  const manifestPath = path.join(dir, "design-system.json");
  // A design system that wraps `Image` and not `Switch`.
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      package: "@mrmeg/expo-ui",
      version: "0.0.0-test",
      tokens: { spacing: { entries: [{ name: "md", value: 16 }] } },
      palette: {},
      themeTokens: [],
      lightTheme: {},
      darkTheme: {},
      fontVariants: null,
      components: [
        { name: "Image", file: "Image.tsx", hasSize: false, variantProp: null, variantValues: null, sizeValues: null },
      ],
    }),
  );

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const fromManifest = new RuleTester({
    languageOptions,
    settings: { "expo-ui": { manifestPath } },
  });

  fromManifest.run("no-raw-primitives (manifest)", rule, {
    valid: ['import { Switch, TextInput, View } from "react-native";'],
    invalid: [
      {
        code: 'import { Image, Switch } from "react-native";',
        errors: [{ message: wrapped("Image") }],
      },
    ],
  });
});
