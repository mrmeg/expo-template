#!/usr/bin/env node
/**
 * Icon registry generator for `@mrmeg/expo-ui`.
 *
 * Reads `packages/ui/src/components/icon-names.json` — a sorted list of
 * kebab-case Lucide icon names — verifies each one is a real subpath module of
 * the installed `lucide-react-native`, and writes
 * `packages/ui/src/components/iconRegistry.generated.ts`: one per-icon import,
 * an `ICONS` map keyed by kebab-case name, and the `IconName` union that
 * `Icon` exposes.
 *
 * Per-icon subpath imports (`lucide-react-native/icons/<name>`) are what keep
 * the bundle at the registry's footprint. Importing the package root would pull
 * every glyph and alias — ~1,800 components — into every consumer.
 *
 * Usage:
 *   bun run ui:icons          # write the file
 *   bun run ui:icons --check  # exit 1 if the file is stale (CI guard)
 *
 * Adding an icon: append its kebab-case Lucide name to `icon-names.json`
 * (keep the list sorted) and run `bun run ui:icons`. On an unknown name this
 * prints the alias lines from Lucide's root entry that mention the PascalCase
 * form — Lucide keeps renamed icons reachable under their old name as an alias,
 * so `check-circle` → `circle-check-big` is one read away.
 *
 * Paths resolve from this file, not the working directory: the UI package's
 * `build` script runs it from `packages/ui`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = join(root, "packages", "ui", "src", "components");
const namesPath = join(componentsDir, "icon-names.json");
const outputPath = join(componentsDir, "iconRegistry.generated.ts");
const namesLabel = relative(root, namesPath);
const outputLabel = relative(root, outputPath);

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
Usage:
  bun run ui:icons [--check]

Reads ${namesLabel}, checks every name against the installed
lucide-react-native, and writes ${outputLabel}.

Options:
  --check     Exit 1 if the generated file is missing or stale; write nothing
  -h, --help  Usage info
`);
  process.exit(0);
}

const checkOnly = argv.includes("--check");

function fail(message) {
  console.error(`build-icon-registry: ${message}`);
  process.exit(1);
}

// --- Locate the installed Lucide package -----------------------------------

// Lucide's `exports` map does not expose `./package.json`, so resolve the main
// entry and walk up to the directory that holds the package manifest.
const require = createRequire(join(root, "package.json"));
let lucideRoot;
try {
  let dir = dirname(require.resolve("lucide-react-native"));
  while (!existsSync(join(dir, "package.json")) && dir !== dirname(dir)) dir = dirname(dir);
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (manifest.name !== "lucide-react-native") throw new Error("unexpected package root");
  lucideRoot = dir;
} catch {
  fail("lucide-react-native is not installed; run `bun install`");
}
const lucideIconsDir = join(lucideRoot, "dist", "esm", "icons");
const lucideRootEntry = join(lucideRoot, "dist", "esm", "lucide-react-native.mjs");

// --- Read and validate the name list ---------------------------------------

/** Lucide file names: lowercase words and digits joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let names;
try {
  names = JSON.parse(readFileSync(namesPath, "utf8"));
} catch (error) {
  fail(`could not read ${namesLabel}: ${error.message}`);
}

if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
  fail(`${namesLabel} must be a JSON array of strings`);
}
if (names.length === 0) {
  fail(`${namesLabel} is empty; the registry needs at least one icon`);
}

const malformed = names.filter((name) => !KEBAB.test(name));
if (malformed.length > 0) {
  fail(
    `${namesLabel} has names that are not kebab-case Lucide names: ${malformed.join(", ")}`
  );
}

const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
if (duplicates.length > 0) {
  fail(`${namesLabel} lists the same name twice: ${[...new Set(duplicates)].join(", ")}`);
}

const sorted = [...names].sort();
if (names.some((name, index) => name !== sorted[index])) {
  const firstOutOfOrder = names.find((name, index) => name !== sorted[index]);
  fail(`${namesLabel} must be sorted (first out-of-order entry: "${firstOutOfOrder}")`);
}

// --- Verify every name is an installed Lucide icon -------------------------

/** `circle-check-big` → `CircleCheckBig`, the export name Lucide's root uses. */
function pascalCase(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Alias lines from Lucide's root entry that export the given PascalCase name.
 * A renamed icon keeps its old name as an alias, so these lines are the
 * rename map: `export { default as CheckCircle, … } from './icons/circle-check-big.mjs'`.
 */
function aliasSuggestions(pascalName) {
  if (!existsSync(lucideRootEntry)) return [];
  const pattern = new RegExp(`\\bas (Lucide)?${pascalName}(Icon)?\\b`);
  return readFileSync(lucideRootEntry, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("export { default as") && pattern.test(line))
    .map((line) => line.trim());
}

const unknown = names.filter((name) => !existsSync(join(lucideIconsDir, `${name}.mjs`)));
if (unknown.length > 0) {
  for (const name of unknown) {
    console.error(`build-icon-registry: "${name}" is not an icon in the installed lucide-react-native`);
    const suggestions = aliasSuggestions(pascalCase(name));
    if (suggestions.length > 0) {
      console.error("  Lucide exports that name as an alias of:");
      for (const line of suggestions) console.error(`    ${line}`);
    } else {
      console.error("  No alias matches; search https://lucide.dev/icons for a replacement.");
    }
  }
  fail(`${unknown.length} unknown name(s) in ${namesLabel}`);
}

// --- Render ------------------------------------------------------------------

/** A valid TypeScript identifier for the import binding. */
function identifierFor(name) {
  const pascal = pascalCase(name);
  return /^[0-9]/.test(pascal) ? `Icon${pascal}` : pascal;
}

const identifiers = names.map(identifierFor);
const collisions = identifiers.filter((id, index) => identifiers.indexOf(id) !== index);
if (collisions.length > 0) {
  fail(`import identifiers collide: ${[...new Set(collisions)].join(", ")}`);
}

const lines = [
  "/* eslint-disable */",
  "// GENERATED FILE - do not edit. Rebuild with `bun run ui:icons`.",
  `// Source: ${relative(componentsDir, namesPath)} (${names.length} icons). Each icon is a`,
  "// per-glyph subpath import so consumers bundle only the names listed there.",
  "",
  ...names.map((name, index) => `import ${identifiers[index]} from "lucide-react-native/icons/${name}";`),
  "",
  "export const ICONS = {",
  ...names.map((name, index) => `  "${name}": ${identifiers[index]},`),
  "} as const;",
  "",
  "export type IconName = keyof typeof ICONS;",
  "",
];
const content = lines.join("\n");

// --- Write or check ----------------------------------------------------------

const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : null;

if (checkOnly) {
  if (current === content) {
    console.log(`${outputLabel} is up to date (${names.length} icons).`);
    process.exit(0);
  }
  fail(
    current === null
      ? `${outputLabel} is missing. Run \`bun run ui:icons\` and commit the result.`
      : `${outputLabel} is stale. Run \`bun run ui:icons\` and commit the result.`
  );
}

if (current === content) {
  console.log(`${outputLabel} already up to date (${names.length} icons).`);
} else {
  writeFileSync(outputPath, content);
  console.log(`Wrote ${outputLabel} from ${names.length} icons in ${namesLabel}.`);
}
