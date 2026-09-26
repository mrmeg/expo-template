/**
 * Without the design system every rule loses its facts: `no-arbitrary-values`
 * goes silent, the others fall back to messages that name no token. That is
 * indistinguishable from a clean file, so each rule says so once per file.
 *
 * These lint through `Linter` rather than `RuleTester` because the state under
 * test is "nothing to load anywhere": `RuleTester` always lints at
 * `process.cwd()`, which in this repo can resolve a built
 * `@mrmeg/expo-ui/design-system.json` through the workspace link and load the
 * facts after all. A working directory outside the repo has no such package
 * above it, so the resolution order really does run out of options.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Linter } = require("eslint");
const tsParser = require("@typescript-eslint/parser");

const plugin = require("../index.js");

const UI_SRC = path.resolve(__dirname, "../../ui/src");

const OUTSIDE_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "expo-ui-lint-no-design-system-"));
const LINTED_FILE = path.join(OUTSIDE_REPO, "file.tsx");

const NOT_FOUND =
  "Design-system facts were not found: no sources at `/nonexistent/dir` and no manifest resolvable as `@mrmeg/expo-ui/design-system.json`. Install an @mrmeg/expo-ui release that ships the manifest, or set `settings[\"expo-ui\"].uiSourceDir` or `settings[\"expo-ui\"].manifestPath`.";

// A file with nothing to report: the only diagnostic left is the missing
// design system itself, so "exactly one error" is the assertion.
const CLEAN = 'import { Button } from "@mrmeg/expo-ui/components";\nconst x = <Button />;';

const RULE_NAMES = [
  "no-raw-colors",
  "no-arbitrary-values",
  "no-restyle",
  "no-raw-primitives",
  "no-raw-typography",
];

/**
 * @param {string} rule
 * @param {object} expoUi the `settings["expo-ui"]` block under test
 */
function configFor(rule, expoUi) {
  return {
    // A flat config only lints a file some entry claims by glob.
    files: ["**/*.tsx"],
    plugins: { "expo-ui": plugin },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { "expo-ui": expoUi },
    rules: { [`expo-ui/${rule}`]: "error" },
  };
}

afterAll(() => {
  fs.rmSync(OUTSIDE_REPO, { recursive: true, force: true });
});

describe("no design system", () => {
  const linter = new Linter({ cwd: OUTSIDE_REPO });

  it.each(RULE_NAMES)("%s reports the not-found message once per file", (rule) => {
    const messages = linter.verify(
      CLEAN,
      configFor(rule, { uiSourceDir: "/nonexistent/dir" }),
      LINTED_FILE,
    );
    expect(messages.map((message) => message.message)).toEqual([NOT_FOUND]);
    expect(messages[0].ruleId).toBe(`expo-ui/${rule}`);
  });

  it.each(RULE_NAMES)("%s reports nothing on the same file with the sources", (rule) => {
    const messages = linter.verify(CLEAN, configFor(rule, { uiSourceDir: UI_SRC }), LINTED_FILE);
    expect(messages).toEqual([]);
  });
});
