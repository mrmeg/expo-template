import parser from "@typescript-eslint/parser";
import expoUi from "@mrmeg/eslint-plugin-expo-ui";

export default [
  { ignores: ["node_modules/**", ".expo/**", "client/icons.generated.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    ...expoUi.configs.recommended,
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
