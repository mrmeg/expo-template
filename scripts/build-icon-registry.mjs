#!/usr/bin/env node
/**
 * Lucide snapshot and builtin-icon generator for `@mrmeg/expo-ui`.
 *
 * `Icon` renders plain glyph data — `[tag, attrs]` pairs on a 24×24 grid — with
 * renderers the package owns, so no icon runtime ships with it. This script
 * reads that data from the exactly pinned `lucide-static` devDependency and
 * writes three artifacts, byte-stably:
 *
 * - `packages/ui/src/components/iconBuiltins.generated.ts` — `BUILTIN_ICONS`,
 *   the glyphs for the names in `icon-names.json` (the ones the package's own
 *   components draw), and the `BuiltinIconName` union.
 * - `packages/ui/src/icons/lucide.json` — the whole snapshot (every icon, plus
 *   the alias map, derived from Lucide's font codepoints plus the names whose
 *   glyph file is identical to a canonical icon's), which the
 *   `expo-ui-icons` CLI compiles an app's `client/icons.json` against. The
 *   package build copies it to `dist/icons/`.
 * - `packages/ui/src/icons/LICENSE.lucide` — Lucide's license, verbatim.
 *
 * Usage:
 *   bun run ui:icons          # write the artifacts
 *   bun run ui:icons --check  # exit 1 if any artifact is stale (CI guard)
 *
 * Bumping Lucide: change the exact `lucide-static` version in the root
 * `package.json`, `bun install`, run `bun run ui:icons` and `bun run icons`,
 * and review the glyph diff — Lucide renames names and sometimes redraws a
 * glyph under a stable name.
 *
 * Paths resolve from this file, not the working directory: the UI package's
 * `build` script runs it from `packages/ui`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = join(root, "packages", "ui", "src", "components");
const iconsDir = join(root, "packages", "ui", "src", "icons");
const namesPath = join(componentsDir, "icon-names.json");
const builtinsPath = join(componentsDir, "iconBuiltins.generated.ts");
const snapshotPath = join(iconsDir, "lucide.json");
const licensePath = join(iconsDir, "LICENSE.lucide");
const label = (path) => relative(root, path);

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
Usage:
  bun run ui:icons [--check]

Reads lucide-static (an exact root devDependency) and ${label(namesPath)}, and writes
${label(builtinsPath)}, ${label(snapshotPath)}, and ${label(licensePath)}.

Options:
  --check     Exit 1 if any artifact is missing or stale; write nothing
  -h, --help  Usage info
`);
  process.exit(0);
}

const unknownArgs = argv.filter((arg) => arg !== "--check");
if (unknownArgs.length > 0) {
  console.error(`build-icon-registry: unknown argument(s) ${unknownArgs.join(" ")}`);
  process.exit(1);
}

const checkOnly = argv.includes("--check");

function fail(message) {
  console.error(`build-icon-registry: ${message}`);
  process.exit(1);
}

// --- Read lucide-static ------------------------------------------------------

/** The only element tags the renderers draw. */
const TAGS = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);

const require = createRequire(join(root, "package.json"));
let lucideDir;
try {
  lucideDir = dirname(require.resolve("lucide-static/package.json"));
} catch {
  fail("lucide-static is not installed; run `bun install`");
}

const readLucide = (file) => readFileSync(join(lucideDir, file), "utf8");
const lucideVersion = JSON.parse(readLucide("package.json")).version;
const iconNodes = JSON.parse(readLucide("icon-nodes.json"));
const codepoints = JSON.parse(readLucide(join("font", "codepoints.json")));
const license = readLucide("LICENSE");

const problems = [];
for (const [name, glyph] of Object.entries(iconNodes)) {
  if (!Array.isArray(glyph) || glyph.length === 0) {
    problems.push(`${name}: not a non-empty node list`);
    continue;
  }
  for (const node of glyph) {
    const [tag, attrs] = Array.isArray(node) ? node : [];
    if (!TAGS.has(tag)) problems.push(`${name}: unsupported tag ${JSON.stringify(tag)}`);
    if (!attrs || typeof attrs !== "object" || Object.values(attrs).some((value) => typeof value !== "string")) {
      problems.push(`${name}: attributes must be an object of strings`);
    }
  }
}
if (problems.length > 0) {
  fail(`lucide-static@${lucideVersion} has glyphs the renderers cannot draw:\n  ${problems.slice(0, 20).join("\n  ")}`);
}

const canonicalNames = Object.keys(iconNodes).sort();

// A name in the font's codepoint table that is not an icon is a renamed icon's
// old name: Lucide keeps those reachable. Most share a real icon's codepoint.
const canonicalByCodepoint = new Map();
for (const name of canonicalNames) {
  const codepoint = codepoints[name];
  if (codepoint === undefined) continue;
  if (canonicalByCodepoint.has(codepoint)) {
    fail(`codepoint ${codepoint} is shared by icons ${canonicalByCodepoint.get(codepoint)} and ${name}`);
  }
  canonicalByCodepoint.set(codepoint, name);
}
const aliases = {};
const unresolved = [];
for (const name of Object.keys(codepoints).sort()) {
  if (name in iconNodes) continue;
  const canonical = canonicalByCodepoint.get(codepoints[name]);
  if (canonical) aliases[name] = canonical;
  else unresolved.push(name);
}

// The rest have a codepoint of their own, but their glyph file is a canonical
// icon's, byte for byte once Lucide's license comment and `class` attribute are
// stripped (`trash-2` is `trash`). Matching the drawing finds them.
const normalizedSvg = (name) =>
  readLucide(join("icons", `${name}.svg`))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+class="[^"]*"/g, "")
    .trim();
const canonicalBySvg = new Map();
if (unresolved.length > 0) {
  for (const name of canonicalNames) {
    const svg = normalizedSvg(name);
    const known = canonicalBySvg.get(svg);
    canonicalBySvg.set(svg, known === undefined ? [name] : [...known, name]);
  }
}
const unnamed = [];
for (const name of unresolved) {
  // The font table still lists names Lucide has dropped (the brand glyphs
  // `github` and `chrome`, among others): no glyph file, and lucide-react does
  // not export them, so there is nothing to resolve.
  if (!existsSync(join(lucideDir, "icons", `${name}.svg`))) continue;
  const svg = normalizedSvg(name);
  const matches = canonicalBySvg.get(svg) ?? [];
  if (matches.length > 1) fail(`${name} draws the same glyph as icons ${matches.join(" and ")}; it cannot be one alias`);
  if (matches.length === 1) aliases[name] = matches[0];
  else unnamed.push(name);
}
// Every name with a glyph file must be an icon or an alias of one. A release
// that adds a name this cannot place must be looked at, not skipped: the four
// names that went missing between Lucide 1.55 and 1.57 passed unnoticed.
if (unnamed.length > 0) {
  fail(
    `lucide-static@${lucideVersion} has glyph files that are neither icons nor identical to one: ${unnamed.join(", ")}`,
  );
}
// Codepoint matches and glyph matches arrive in separate passes: write sorted.
for (const [name, canonical] of Object.entries(aliases).sort(([a], [b]) => (a < b ? -1 : 1))) {
  delete aliases[name];
  aliases[name] = canonical;
}

// --- Read and validate the builtin name list ---------------------------------

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let names;
try {
  names = JSON.parse(readFileSync(namesPath, "utf8"));
} catch (error) {
  fail(`could not read ${label(namesPath)}: ${error.message}`);
}

if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
  fail(`${label(namesPath)} must be a JSON array of strings`);
}
if (names.length === 0) fail(`${label(namesPath)} is empty; the package needs at least one icon`);

const malformed = names.filter((name) => !KEBAB.test(name));
if (malformed.length > 0) fail(`${label(namesPath)} has names that are not kebab-case: ${malformed.join(", ")}`);

const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
if (duplicates.length > 0) fail(`${label(namesPath)} lists the same name twice: ${[...new Set(duplicates)].join(", ")}`);

const sortedNames = [...names].sort();
const firstOutOfOrder = names.find((name, index) => name !== sortedNames[index]);
if (firstOutOfOrder !== undefined) {
  fail(`${label(namesPath)} must be sorted (first out-of-order entry: "${firstOutOfOrder}")`);
}

const unknown = names.filter((name) => !(name in iconNodes));
if (unknown.length > 0) {
  const lines = unknown.map((name) =>
    aliases[name] ? `${name} → ${aliases[name]} (an alias; use the canonical name)` : `${name} is not a Lucide ${lucideVersion} icon`
  );
  fail(`${label(namesPath)} has names outside the snapshot:\n  ${lines.join("\n  ")}`);
}

// --- Render ------------------------------------------------------------------

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** One glyph as a TypeScript literal: `[["path", { d: "…" }], …]`. */
function glyphLiteral(glyph) {
  const nodes = glyph.map(([tag, attrs]) => {
    const fields = Object.entries(attrs).map(
      ([key, value]) => `${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(value)}`
    );
    return `[${JSON.stringify(tag)}, { ${fields.join(", ")} }]`;
  });
  return `[${nodes.join(", ")}]`;
}

const builtins = [
  "/* eslint-disable */",
  `// GENERATED by \`bun run ui:icons\` from icon-names.json (lucide ${lucideVersion}). Do not edit.`,
  "// The glyphs the package's own components draw. Apps register every other",
  "// name through `client/icons.json`, `expo-ui-icons`, and `registerIcons`.",
  "",
  'import type { IconGlyph } from "./iconTypes";',
  "",
  "export const BUILTIN_ICONS = {",
  ...names.map((name) => `  ${JSON.stringify(name)}: ${glyphLiteral(iconNodes[name])},`),
  "} as const satisfies Record<string, IconGlyph>;",
  "",
  "export type BuiltinIconName = keyof typeof BUILTIN_ICONS;",
  "",
].join("\n");

const snapshot = [
  "{",
  `  "lucide": ${JSON.stringify(lucideVersion)},`,
  '  "aliases": {',
  Object.entries(aliases)
    .map(([alias, canonical]) => `    ${JSON.stringify(alias)}: ${JSON.stringify(canonical)}`)
    .join(",\n"),
  "  },",
  '  "icons": {',
  canonicalNames.map((name) => `    ${JSON.stringify(name)}: ${JSON.stringify(iconNodes[name])}`).join(",\n"),
  "  }",
  "}",
  "",
].join("\n");

const artifacts = [
  { path: builtinsPath, content: builtins },
  { path: snapshotPath, content: snapshot },
  { path: licensePath, content: license },
];

// --- Write or check ----------------------------------------------------------

const summary = `lucide ${lucideVersion}: ${canonicalNames.length} icons, ${Object.keys(aliases).length} aliases, ${names.length} builtins`;
const stale = artifacts.filter(({ path, content }) => !existsSync(path) || readFileSync(path, "utf8") !== content);

if (checkOnly) {
  if (stale.length === 0) {
    console.log(`Icon builtins and snapshot are up to date (${summary}).`);
    process.exit(0);
  }
  fail(
    `${stale.map(({ path }) => label(path)).join(", ")} ${stale.length === 1 ? "is" : "are"} missing or stale. ` +
      "Run `bun run ui:icons` and commit the result."
  );
}

if (stale.length === 0) {
  console.log(`Icon builtins and snapshot already up to date (${summary}).`);
} else {
  mkdirSync(iconsDir, { recursive: true });
  for (const { path, content } of stale) {
    writeFileSync(path, content);
    console.log(`Wrote ${label(path)}`);
  }
  console.log(`(${summary})`);
}
