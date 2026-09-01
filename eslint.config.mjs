import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "android/**/*",
      "ios/**/*",
      "dist/**/*",
      "drizzle/**/*",
      "node_modules/**/*",
      // Deployable Cloudflare Workers: workerd globals, no React, and their own
      // tsconfig. This config's browser globals and React rules do not apply.
      "workers/**/*",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
  ),
  // React Compiler is enabled (app.config.ts `experiments.reactCompiler`), so
  // Rules-of-React violations now decide whether a component gets memoized.
  // `recommended-latest` bundles the compiler diagnostics with the classic
  // hooks rules; keep it ahead of the local block so overrides below win.
  reactHooks.configs.flat["recommended-latest"],
  {
    plugins: {
      react,
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.entries(globals.browser).filter(([key]) => key.trim() === key),
        ),
      },

      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },

    settings: {
      react: {
        // Pinned instead of "detect" because eslint-plugin-react 7.37.x
        // calls context.getFilename() during version detection, which was
        // removed in ESLint 10 and crashes rule loading.
        version: "19.2",
      },
    },

    rules: {
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "react/no-unescaped-entities": "off",
      "@/indent": ["warn", 2],
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      indent: "off",
      "linebreak-style": "off",
      quotes: ["warn", "double"],
      semi: ["error", "always"],
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];
