#!/usr/bin/env node

/**
 * README version-drift guard.
 *
 * `README.md` names the stack in prose ("Expo SDK 57", "React Native 0.86",
 * …). Those claims have silently drifted behind `package.json` before, which
 * costs real debugging time for anyone starting a project from this template.
 *
 * This check re-derives every version it can from `package.json` and asserts
 * the README's prose agrees. It only compares the significance the README
 * actually claims — the expo major, not the full `~57.0.8` pin — so routine
 * patch bumps never require a docs edit.
 *
 * Usage:
 *   node scripts/check-readme-versions.mjs      # via `bun run docs:versions:check`
 *
 * Exit code: 0 when every claim matches, 1 on the first mismatch set.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const readme = readFileSync(join(root, "README.md"), "utf8");

/** Resolve a declared dependency range to a concrete SemVer. */
function resolve(name) {
  const range =
    manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  if (!range) {
    throw new Error(`${name} is not a dependency of package.json`);
  }
  const version = semver.coerce(range);
  if (!version) {
    throw new Error(`Cannot parse a version out of ${name}@${range}`);
  }
  return version;
}

const major = (name) => String(resolve(name).major);
const majorMinor = (name) => {
  const v = resolve(name);
  return `${v.major}.${v.minor}`;
};

/**
 * Each claim is a prose pattern in README.md plus the value package.json says
 * it should be. `required` claims must appear at least once — the README is
 * expected to state the SDK and RN version it targets.
 */
const CLAIMS = [
  {
    label: "Expo SDK major",
    source: "expo",
    pattern: /Expo SDK (\d+)/g,
    expected: () => major("expo"),
    required: true,
  },
  {
    label: "React Native minor",
    source: "react-native",
    // "React Native Web 0.21" and "React Native `Animated`" don't match:
    // a digit has to follow the name directly.
    pattern: /(?:React Native|RN) (\d+\.\d+)/g,
    expected: () => majorMinor("react-native"),
    required: true,
  },
  {
    label: "Expo Router major",
    source: "expo-router",
    pattern: /Expo Router (\d+)/g,
    expected: () => major("expo-router"),
    required: false,
  },
  {
    label: "RNTL major",
    source: "@testing-library/react-native",
    pattern: /RNTL (\d+)/g,
    expected: () => major("@testing-library/react-native"),
    required: false,
  },
];

function lineNumberOf(index) {
  return readme.slice(0, index).split("\n").length;
}

const problems = [];

for (const claim of CLAIMS) {
  const expected = claim.expected();
  const matches = [...readme.matchAll(claim.pattern)];

  if (matches.length === 0) {
    if (claim.required) {
      problems.push(
        `${claim.label}: README.md never states it (expected "${expected}" from ${claim.source})`,
      );
    }
    continue;
  }

  for (const match of matches) {
    if (match[1] === expected) continue;
    problems.push(
      `README.md:${lineNumberOf(match.index)} says "${match[0]}" but ` +
        `package.json pins ${claim.source} at ${expected} (${claim.label})`,
    );
  }
}

if (problems.length > 0) {
  console.error("✗ README.md version claims are out of date:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nUpdate README.md to match package.json (or vice versa).");
  process.exit(1);
}

console.log(`✓ README.md version claims match package.json (${CLAIMS.length} checked).`);
