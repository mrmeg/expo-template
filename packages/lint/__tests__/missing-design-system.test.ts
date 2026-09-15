/**
 * Without the design system every rule loses its facts: `no-arbitrary-values`
 * goes silent, the others fall back to messages that name no token. That is
 * indistinguishable from a clean file, so each rule says so once per file.
 */
const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { "expo-ui": { uiSourceDir: "/nonexistent/dir" } },
});

const NOT_FOUND =
  'Design-system sources were not found at `/nonexistent/dir`; the expo-ui rules need `packages/ui/src` (or `settings["expo-ui"].uiSourceDir`) to point at the @mrmeg/expo-ui sources.';

// A file with nothing to report: the only diagnostic left is the missing
// design system itself, so "exactly one error" is the assertion.
const CLEAN = 'import { Button } from "@mrmeg/expo-ui/components";\nconst x = <Button />;';

const RULES = {
  "no-raw-colors": require("../rules/no-raw-colors"),
  "no-arbitrary-values": require("../rules/no-arbitrary-values"),
  "no-restyle": require("../rules/no-restyle"),
  "no-raw-primitives": require("../rules/no-raw-primitives"),
};

for (const name of Object.keys(RULES)) {
  ruleTester.run(name, RULES[name], {
    valid: [
      // The same file with the design system in place reports nothing.
      { code: CLEAN, settings: { "expo-ui": { uiSourceDir: "packages/ui/src" } } },
    ],
    invalid: [{ code: CLEAN, errors: [{ message: NOT_FOUND }] }],
  });
}
