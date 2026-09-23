/**
 * Types for `@mrmeg/eslint-plugin-expo-ui`, for configs written in TypeScript
 * (`eslint.config.ts`). The plugin itself is the CommonJS `index.js` beside this.
 */
import type { ESLint, Linter, Rule } from "eslint";

declare const plugin: ESLint.Plugin & {
  meta: { name: "expo-ui" };
  rules: {
    "no-raw-colors": Rule.RuleModule;
    "no-arbitrary-values": Rule.RuleModule;
    "no-restyle": Rule.RuleModule;
    "no-raw-primitives": Rule.RuleModule;
  };
  configs: {
    /**
     * The four rules at `error` plus the default `settings["expo-ui"]`. Carries
     * no `files` key: spread it into a block that names the paths to govern.
     */
    recommended: Linter.Config;
  };
};

export = plugin;
