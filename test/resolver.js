/**
 * Jest resolver: the React Native preset's own resolver, plus the repo-only
 * `@mrmeg/source` export condition.
 *
 * `@mrmeg/expo-ui`, `@mrmeg/expo-media` and `@mrmeg/expo-purchases` declare
 * that condition first in each `exports` entry, pointing at `src`. With it
 * enabled, a test imports a workspace package through the same export map a
 * consumer uses — an unexported subpath fails here too — while reading sources,
 * not a build. tsconfig.json (`customConditions`) and metro.config.js
 * (`unstable_conditionNames`) enable the same condition.
 *
 * It has to be added here: `testEnvironmentOptions.customExportConditions`
 * does nothing under `@react-native/jest-preset`, whose environment pins its
 * conditions (`require`, `react-native`) as a class field that overwrites the
 * option.
 */
const presetResolver = require("@react-native/jest-preset/jest/resolver");

const SOURCE_CONDITION = "@mrmeg/source";

module.exports = (path, options) =>
  presetResolver(path, {
    ...options,
    // No conditions means a Jest-internal lookup, which keeps its defaults.
    conditions: Array.isArray(options.conditions)
      ? [...options.conditions, SOURCE_CONDITION]
      : options.conditions,
  });
