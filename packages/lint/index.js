/**
 * `@mrmeg/eslint-plugin-expo-ui` — the design-system rules of
 * `@mrmeg/expo-ui`, written as ESLint diagnostics instead of prose.
 *
 * Every message names the token, variant, or component to use instead, so the
 * report is the instruction. No message suggests changing the lint config.
 */

const { DEFAULT_UI_SOURCE_DIR } = require("./lib/settings");

const rules = {
  "no-raw-colors": require("./rules/no-raw-colors"),
  "no-arbitrary-values": require("./rules/no-arbitrary-values"),
  "no-restyle": require("./rules/no-restyle"),
  "no-raw-primitives": require("./rules/no-raw-primitives"),
};

/** @type {{meta: {name: string}, rules: object, configs: object}} */
const plugin = {
  meta: { name: "expo-ui" },
  rules,
  configs: {},
};

// No `files` key: the consuming config decides which paths the design system
// governs, and spreads this config into that block.
plugin.configs.recommended = {
  plugins: { "expo-ui": plugin },
  settings: {
    "expo-ui": { uiSourceDir: DEFAULT_UI_SOURCE_DIR },
  },
  rules: {
    "expo-ui/no-raw-colors": "error",
    "expo-ui/no-arbitrary-values": "error",
    "expo-ui/no-restyle": "error",
    "expo-ui/no-raw-primitives": "error",
  },
};

module.exports = plugin;
