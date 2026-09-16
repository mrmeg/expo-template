const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
const rule = require("../rules/no-raw-primitives");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-raw-primitives", rule, {
  valid: [
    // Primitives the design system deliberately does not wrap.
    'import { View, Pressable, TouchableOpacity, TextInput, StyleSheet } from "react-native";',
    'import type { TextStyle } from "react-native";',
    // A type-only import renders nothing, so it cannot render with the wrong
    // font: these are how a wrapper's own props get typed.
    'import type { Text } from "react-native";',
    'import { type Text as T, View } from "react-native";',
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
