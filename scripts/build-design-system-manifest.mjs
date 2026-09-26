#!/usr/bin/env node
/**
 * Serialize a package's design-system facts into `dist/design-system.json`.
 *
 * The lint plugin reads `packages/ui/src` with `@typescript-eslint/parser` at
 * lint time, which only works where those sources exist. This writes the same
 * facts into the tarball so a project that installed the package from npm gets
 * rule messages that quote the tokens, presets, and sizes of the release it has.
 *
 * Usage:
 *   node scripts/build-design-system-manifest.mjs <ui>
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Packages whose sources the lint plugin understands. */
const PACKAGES = {
  ui: { dir: "packages/ui", sourceDir: "src", output: join("dist", "design-system.json") },
};

const packageNames = Object.keys(PACKAGES).sort();
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packageName = process.argv[2];
const target = PACKAGES[packageName];

if (!target) {
  console.error(
    `build-design-system-manifest: unknown package "${packageName ?? ""}". Expected one of: ${packageNames.join(", ")}`
  );
  console.error("Usage: node scripts/build-design-system-manifest.mjs <ui>");
  process.exit(1);
}

// The extractor and the serializer are the plugin's own CommonJS modules, so the
// manifest cannot describe facts the rules would read differently.
const require = createRequire(import.meta.url);
const { loadDesignSystem } = require(join(root, "packages/lint/lib/source.js"));
const { serializeDesignSystem } = require(join(root, "packages/lint/lib/manifest.js"));

const packageDir = join(root, target.dir);
const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const sourceDir = join(packageDir, target.sourceDir);
const design = loadDesignSystem(sourceDir);

/**
 * An empty fact group means the extractor stopped understanding the sources —
 * a renamed export, a moved file. Shipping that manifest would quietly strip the
 * token names out of every consumer's lint message, so the build fails instead.
 */
const problems = [];
if (!design.loaded) {
  problems.push(`no design-system sources parsed under ${target.dir}/${target.sourceDir}`);
} else {
  if (design.tokens.spacing.entries.length === 0) problems.push("no spacing tokens");
  if (Object.keys(design.palette).length === 0) problems.push("no palette entries");
  if (design.themeTokens.length === 0) problems.push("no theme colors");
  if (!design.fontVariants || design.fontVariants.length === 0) problems.push("no font variants");
  if (Object.keys(design.fonts.families).length === 0) problems.push("no font families");
  if (design.tokens.typography.entries.length === 0) problems.push("no typography sizes");
  if (design.components.size === 0) problems.push("no components");
}

if (problems.length > 0) {
  console.error(`build-design-system-manifest: ${problems.join("; ")}`);
  process.exit(1);
}

const iconNames = JSON.parse(
  await readFile(join(sourceDir, "components", "icon-names.json"), "utf8")
);
if (!Array.isArray(iconNames) || iconNames.length === 0) {
  console.error("build-design-system-manifest: no icon names in components/icon-names.json");
  process.exit(1);
}

const payload = {
  ...serializeDesignSystem(design, {
    packageName: manifest.name,
    version: manifest.version,
  }),
  // The `Icon` registry (`IconName` union), so the lint plugin can validate
  // icon names against an installed release. An added key keeps schemaVersion 1:
  // the plugin's loader ignores keys it does not read.
  icons: { names: iconNames },
};
const outputPath = join(packageDir, target.output);
// `dist` exists when this runs inside the package build; not when run on its own.
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(
  `Wrote ${target.dir}/${target.output} — schemaVersion ${payload.schemaVersion}, ` +
    `${payload.components.length} components, ${payload.tokens.spacing.entries.length} spacing tokens, ` +
    `${payload.tokens.typography.entries.length} typography sizes, ${payload.icons.names.length} icon names`
);
