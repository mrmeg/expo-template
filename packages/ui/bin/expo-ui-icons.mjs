#!/usr/bin/env node
/**
 * expo-ui-icons — compile an app's icon list into glyph data for
 * `@mrmeg/expo-ui`'s `Icon`.
 *
 * `Icon` draws plain glyph data with renderers the package owns. The package
 * registers the names its own components use; an app lists every other Lucide
 * name it draws in `client/icons.json` and this CLI writes one module with
 * those glyphs (`appIcons`) and the `IconRegistry` augmentation that types
 * them. The root layout calls `registerIcons(appIcons)` once at module scope.
 * `tabs` rasterizes the `tabIcons` subset to template PNGs for a native tab
 * bar.
 *
 * The glyphs come from the Lucide snapshot the package ships
 * (`dist/icons/lucide.json`, ISC, see `dist/icons/LICENSE.lucide`), so adding
 * a name needs no package release. Node >= 20, no dependencies.
 *
 * Usage: expo-ui-icons [generate|add|init|tabs] [options]; see --help.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `
Usage:
  expo-ui-icons [generate] [--check]   Write the glyph module from the manifest
  expo-ui-icons add <name...>          Add Lucide names to the manifest and regenerate
  expo-ui-icons init [--force]         Seed the manifest from names used in app/, client/, shared/
  expo-ui-icons tabs [--check]         Rasterize tabIcons to template PNGs (needs rsvg-convert)

Options:
  --manifest <path>  Icon list (default client/icons.json): { "icons": [...], "tabIcons": [...] }
  --out <path>       Generated glyph module (default client/icons.generated.ts)
  --module <spec>    Module to import types from and augment (default @mrmeg/expo-ui/components/Icon)
  --assets <dir>     Tab icon PNGs and manifest.json (default assets/icons/tabs)
  --tabs-out <path>  Generated tab icon module (default client/tabIcons.generated.ts)
  --check            Exit 1 if the output is missing or stale; write nothing
  --force            Let init overwrite an existing manifest
  -h, --help         Usage info

Environment:
  RSVG_CONVERT       Path to rsvg-convert; when set, the only rasterizer tried
`;

const COMMANDS = new Set(["generate", "add", "init", "tabs"]);
const VALUE_OPTIONS = new Set(["--manifest", "--out", "--module", "--assets", "--tabs-out"]);
const FLAG_OPTIONS = new Set(["--check", "--force", "-h", "--help"]);

class CliError extends Error {}

const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function fail(message) {
  throw new CliError(message);
}

/** Paths in messages and headers: relative to the working directory, `/`-separated. */
function label(path) {
  return relative(process.cwd(), path).split(sep).join("/") || ".";
}

function parseArgs(argv) {
  const options = {
    manifest: "client/icons.json",
    out: "client/icons.generated.ts",
    module: "@mrmeg/expo-ui/components/Icon",
    assets: "assets/icons/tabs",
    "tabs-out": "client/tabIcons.generated.ts",
  };
  const flags = new Set();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (VALUE_OPTIONS.has(key)) {
      const value = inlineValue ?? argv[(index += 1)];
      if (!value || value.startsWith("--")) fail(`${key} needs a value`);
      options[key.slice(2)] = value;
    } else if (FLAG_OPTIONS.has(key) && inlineValue === undefined) {
      flags.add(key);
    } else if (arg.startsWith("-")) {
      fail(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  const command = COMMANDS.has(positional[0]) ? positional.shift() : "generate";
  return { command, names: positional, options, flags };
}

// --- Snapshot ------------------------------------------------------------------

const binDir = dirname(fileURLToPath(import.meta.url));

/**
 * The published package ships `dist/icons/lucide.json`. In the package's own
 * repository `src/icons/lucide.json` is the source of truth (a `dist` there may
 * predate a snapshot bump), so it wins when present.
 */
function loadSnapshot() {
  const candidates = [join(binDir, "..", "src", "icons", "lucide.json"), join(binDir, "..", "dist", "icons", "lucide.json")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) fail(`no Lucide snapshot next to this CLI (looked for ${candidates.join(", ")}); reinstall @mrmeg/expo-ui`);
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  if (typeof snapshot.lucide !== "string" || !snapshot.icons || !snapshot.aliases) fail(`${path} is not a Lucide snapshot`);
  return snapshot;
}

// --- Manifest ------------------------------------------------------------------

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function readManifest(path, { allowMissing = false } = {}) {
  if (!existsSync(path)) {
    if (allowMissing) return { icons: [], tabIcons: [] };
    fail(`${label(path)} not found. Run \`expo-ui-icons init\` to seed it, or \`expo-ui-icons add <name>\`.`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label(path)} is not valid JSON: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail(`${label(path)} must be an object: { "icons": [...], "tabIcons": [...] }`);
  const extra = Object.keys(manifest).filter((key) => key !== "icons" && key !== "tabIcons");
  if (extra.length > 0) fail(`${label(path)} has unknown key(s) ${extra.join(", ")}; expected "icons" and "tabIcons"`);
  const icons = manifest.icons ?? [];
  const tabIcons = manifest.tabIcons ?? [];
  for (const [key, list] of [["icons", icons], ["tabIcons", tabIcons]]) {
    if (!Array.isArray(list) || list.some((name) => typeof name !== "string")) fail(`${label(path)}: "${key}" must be an array of strings`);
  }
  return { icons, tabIcons };
}

/** Every problem with one name list: shape, order, duplicates, and names outside the snapshot. */
function listProblems(list, key, snapshot) {
  const problems = [];
  const duplicates = [...new Set(list.filter((name, index) => list.indexOf(name) !== index))];
  if (duplicates.length > 0) problems.push(`"${key}" lists the same name twice: ${duplicates.join(", ")}`);
  const sorted = [...list].sort();
  const firstOutOfOrder = list.find((name, index) => name !== sorted[index]);
  if (firstOutOfOrder !== undefined) problems.push(`"${key}" must be sorted (first out-of-order entry: "${firstOutOfOrder}")`);
  for (const name of list) {
    if (name in snapshot.icons) continue;
    if (snapshot.aliases[name]) {
      problems.push(`"${name}" is an alias; use the canonical name: ${name} → ${snapshot.aliases[name]}`);
    } else if (!KEBAB.test(name)) {
      problems.push(`"${name}" is not a kebab-case icon name`);
    } else {
      problems.push(`"${name}" is not a Lucide ${snapshot.lucide} icon (search https://lucide.dev/icons)`);
    }
  }
  return problems;
}

function validateManifest(manifest, path, snapshot) {
  const problems = [...listProblems(manifest.icons, "icons", snapshot), ...listProblems(manifest.tabIcons, "tabIcons", snapshot)];
  if (problems.length > 0) fail(`${label(path)}:\n  ${problems.join("\n  ")}`);
}

function writeManifest(path, manifest) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ icons: manifest.icons, tabIcons: manifest.tabIcons }, null, 2)}\n`);
}

// --- Glyph module ----------------------------------------------------------------

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyKey = (key) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

/** One glyph as a TypeScript literal: `[["path", { d: "…" }], …]`. */
function glyphLiteral(glyph) {
  const nodes = glyph.map(([tag, attrs]) => {
    const fields = Object.entries(attrs).map(([key, value]) => `${propertyKey(key)}: ${JSON.stringify(value)}`);
    return `[${JSON.stringify(tag)}, { ${fields.join(", ")} }]`;
  });
  return `[${nodes.join(", ")}]`;
}

function renderGlyphModule(manifest, manifestPath, moduleName, snapshot) {
  return [
    "/* eslint-disable */",
    `// GENERATED by \`bun run icons\` from ${label(manifestPath)} (lucide ${snapshot.lucide}). Do not edit.`,
    `import type { IconGlyph } from ${JSON.stringify(moduleName)};`,
    "",
    "export const appIcons = {",
    ...manifest.icons.map((name) => `  ${JSON.stringify(name)}: ${glyphLiteral(snapshot.icons[name])},`),
    "} as const satisfies Record<string, IconGlyph>;",
    "",
    `declare module ${JSON.stringify(moduleName)} {`,
    "  interface IconRegistry {",
    ...manifest.icons.map((name) => `    ${JSON.stringify(name)}: true;`),
    "  }",
    "}",
    "",
  ].join("\n");
}

function generate({ options, flags }, snapshot) {
  const manifestPath = resolve(options.manifest);
  const outPath = resolve(options.out);
  const manifest = readManifest(manifestPath);
  validateManifest(manifest, manifestPath, snapshot);
  const content = renderGlyphModule(manifest, manifestPath, options.module, snapshot);
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
  const summary = `${count(manifest.icons.length, "icon")}, lucide ${snapshot.lucide}`;

  if (flags.has("--check")) {
    if (current === content) {
      console.log(`${label(outPath)} is up to date (${summary}).`);
      return 0;
    }
    console.error(
      `expo-ui-icons: ${label(outPath)} is ${current === null ? "missing" : "stale"}. Run \`bun run icons\` and commit the result.`
    );
    return 1;
  }
  if (current === content) {
    console.log(`${label(outPath)} already up to date (${summary}).`);
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content);
    console.log(`Wrote ${label(outPath)} (${summary}).`);
  }
  return 0;
}

// --- add -------------------------------------------------------------------------

function add(args, snapshot) {
  if (args.names.length === 0) fail("add needs at least one icon name: expo-ui-icons add archive bell");
  const manifestPath = resolve(args.options.manifest);
  const manifest = readManifest(manifestPath, { allowMissing: true });
  validateManifest(manifest, manifestPath, snapshot);

  const problems = [];
  const added = [];
  for (const requested of args.names) {
    let name = requested;
    if (!(name in snapshot.icons)) {
      if (snapshot.aliases[name]) {
        name = snapshot.aliases[name];
        console.log(`"${requested}" is an alias: adding the canonical name (${requested} → ${name}).`);
      } else {
        problems.push(`"${requested}" is not a Lucide ${snapshot.lucide} icon (search https://lucide.dev/icons)`);
        continue;
      }
    }
    if (!manifest.icons.includes(name) && !added.includes(name)) added.push(name);
  }
  if (problems.length > 0) fail(problems.join("\n  "));

  manifest.icons = [...manifest.icons, ...added].sort();
  writeManifest(manifestPath, manifest);
  console.log(added.length > 0 ? `Added ${added.join(", ")} to ${label(manifestPath)}.` : `${label(manifestPath)} already lists them.`);
  return generate({ ...args, flags: new Set() }, snapshot);
}

// --- init ------------------------------------------------------------------------

const SCAN_DIRS = ["app", "client", "shared"];
const SCAN_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_FILES = /(\.test\.|\.spec\.|\.generated\.ts$)/;
const SKIP_DIRS = new Set(["node_modules", "__tests__", "__mocks__"]);
const ICON_LITERAL = /\b(name|icon)\s*[=:]\s*\{?\s*"([a-z0-9-]+)"/g;

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) || entry.name.startsWith(".") ? [] : sourceFiles(path);
    return SCAN_EXTENSIONS.test(entry.name) && !SKIP_FILES.test(entry.name) ? [path] : [];
  });
}

function init(args, snapshot) {
  const manifestPath = resolve(args.options.manifest);
  let tabIcons = [];
  if (existsSync(manifestPath)) {
    if (!args.flags.has("--force")) fail(`${label(manifestPath)} already exists; pass --force to overwrite it.`);
    try {
      tabIcons = readManifest(manifestPath).tabIcons;
    } catch {
      tabIcons = [];
    }
  }

  const files = SCAN_DIRS.flatMap((dir) => sourceFiles(resolve(dir)));
  const found = new Set();
  const aliasHits = new Map();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(ICON_LITERAL)) {
      const name = match[2];
      if (name in snapshot.icons) found.add(name);
      else if (snapshot.aliases[name]) aliasHits.set(name, snapshot.aliases[name]);
    }
  }

  // An overwritten manifest keeps its tab icons, which must also be in "icons".
  const manifest = { icons: [...new Set([...found, ...tabIcons])].sort(), tabIcons };
  writeManifest(manifestPath, manifest);
  console.log(`Seeded ${label(manifestPath)} with ${count(manifest.icons.length, "name")} found in ${count(files.length, "file")} under ${SCAN_DIRS.join("/, ")}/.`);
  if (aliasHits.size > 0) {
    console.log("Skipped alias names (if they are icons, use the canonical name and `expo-ui-icons add` it):");
    for (const [alias, canonical] of aliasHits) console.log(`  ${alias} → ${canonical}`);
  }
  const status = generate({ ...args, flags: new Set() }, snapshot);
  console.log(
    "Next: typecheck and `expo-ui-icons add` any name it reports (names built at runtime are not found by the scan), " +
      "and call `registerIcons(appIcons)` at module scope in the root layout."
  );
  return status;
}

// --- tabs ------------------------------------------------------------------------

const TAB_SCALES = [
  ["", 24],
  ["@2x", 48],
  ["@3x", 72],
];

const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A glyph as a standalone SVG document, black on transparent (tab bars tint it). */
function glyphSvg(glyph) {
  const children = glyph
    .map(([tag, attrs]) => `<${tag}${Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join("")}/>`)
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round">${children}</svg>`
  );
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function renderTabModule(names, tabsOutPath, assetsDir, manifestPath, snapshot) {
  let assetsSpecifier = relative(dirname(tabsOutPath), assetsDir).split(sep).join("/");
  if (!assetsSpecifier.startsWith(".")) assetsSpecifier = `./${assetsSpecifier}`;
  return [
    "/* eslint-disable */",
    `// GENERATED by \`bun run icons:tabs\` from ${label(manifestPath)} (lucide ${snapshot.lucide}). Do not edit.`,
    "// Template PNGs of the tabIcons glyphs for a native tab bar, which tints them.",
    "",
    "export const TAB_ICONS = {",
    ...names.map((name) => `  ${propertyKey(name)}: require(${JSON.stringify(`${assetsSpecifier}/${name}.png`)}),`),
    "} as const;",
    "",
    "export type TabIconName = keyof typeof TAB_ICONS;",
    "",
  ].join("\n");
}

/**
 * Explicit `RSVG_CONVERT` is authoritative; otherwise PATH and the Homebrew
 * prefixes, like the template's brand-asset script.
 */
function findRasterizer() {
  const candidates = process.env.RSVG_CONVERT
    ? [process.env.RSVG_CONVERT]
    : ["rsvg-convert", "/opt/homebrew/bin/rsvg-convert", "/usr/local/bin/rsvg-convert"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next one
    }
  }
  return null;
}

function tabs({ options, flags }, snapshot) {
  const manifestPath = resolve(options.manifest);
  const assetsDir = resolve(options.assets);
  const tabsOutPath = resolve(options["tabs-out"]);
  const assetManifestPath = join(assetsDir, "manifest.json");
  const manifest = readManifest(manifestPath);
  validateManifest(manifest, manifestPath, snapshot);

  const notListed = manifest.tabIcons.filter((name) => !manifest.icons.includes(name));
  if (notListed.length > 0) {
    fail(`${label(manifestPath)}: every "tabIcons" name must also be in "icons" (missing: ${notListed.join(", ")})`);
  }

  const svgs = Object.fromEntries(manifest.tabIcons.map((name) => [name, glyphSvg(snapshot.icons[name])]));
  const expectedAssetManifest = `${JSON.stringify(
    { lucide: snapshot.lucide, icons: Object.fromEntries(manifest.tabIcons.map((name) => [name, sha256(svgs[name])])) },
    null,
    2
  )}\n`;
  const expectedModule = renderTabModule(manifest.tabIcons, tabsOutPath, assetsDir, manifestPath, snapshot);

  // Freshness from hashes of the SVG source, never PNG bytes: rasterizers
  // differ by version and platform, and CI has none.
  const pngProblems = [];
  const currentAssetManifest = existsSync(assetManifestPath) ? readFileSync(assetManifestPath, "utf8") : null;
  let recorded = null;
  try {
    recorded = currentAssetManifest === null ? null : JSON.parse(currentAssetManifest);
  } catch {
    pngProblems.push(`${label(assetManifestPath)} is not valid JSON`);
  }
  if (currentAssetManifest === null) {
    pngProblems.push(`${label(assetManifestPath)} is missing`);
  } else if (recorded) {
    if (recorded.lucide !== snapshot.lucide) {
      pngProblems.push(`${label(assetManifestPath)} was rendered from lucide ${recorded.lucide}, the snapshot is ${snapshot.lucide}`);
    }
    const recordedIcons = recorded.icons ?? {};
    for (const name of manifest.tabIcons) {
      if (recordedIcons[name] !== sha256(svgs[name])) pngProblems.push(`${name}: hash mismatch (glyph changed or manifest edited)`);
    }
    for (const name of Object.keys(recordedIcons)) {
      if (!manifest.tabIcons.includes(name)) pngProblems.push(`${name}: rendered but no longer in "tabIcons"`);
    }
    if (pngProblems.length === 0 && currentAssetManifest !== expectedAssetManifest) {
      pngProblems.push(`${label(assetManifestPath)} is not in its generated form`);
    }
  }
  for (const name of manifest.tabIcons) {
    for (const [suffix] of TAB_SCALES) {
      const png = join(assetsDir, `${name}${suffix}.png`);
      if (!existsSync(png)) pngProblems.push(`${label(png)} is missing`);
    }
  }
  const currentModule = existsSync(tabsOutPath) ? readFileSync(tabsOutPath, "utf8") : null;
  const moduleStale = currentModule !== expectedModule;
  const summary = `${count(manifest.tabIcons.length, "tab icon")}, lucide ${snapshot.lucide}`;

  if (flags.has("--check")) {
    if (pngProblems.length === 0 && !moduleStale) {
      console.log(`Tab icons are up to date (${summary}).`);
      return 0;
    }
    const problems = [...pngProblems];
    if (moduleStale) problems.push(`${label(tabsOutPath)} is ${currentModule === null ? "missing" : "stale"}`);
    console.error(`expo-ui-icons: tab icons are stale:\n  ${problems.join("\n  ")}\nRun \`bun run icons:tabs\` and commit the result.`);
    return 1;
  }

  if (pngProblems.length === 0 && !moduleStale) {
    console.log(`Tab icons are up to date (${summary}); nothing to rasterize.`);
    return 0;
  }

  if (pngProblems.length > 0) {
    const rasterizer = findRasterizer();
    if (!rasterizer) {
      fail(
        `tab icons need rasterizing (${pngProblems[0]}${pngProblems.length > 1 ? `, and ${pngProblems.length - 1} more` : ""}), ` +
          "but rsvg-convert was not found. Install librsvg (brew install librsvg) or set RSVG_CONVERT."
      );
    }
    mkdirSync(assetsDir, { recursive: true });
    const scratch = mkdtempSync(join(tmpdir(), "expo-ui-icons-"));
    try {
      for (const name of manifest.tabIcons) {
        const svgPath = join(scratch, `${name}.svg`);
        writeFileSync(svgPath, svgs[name]);
        for (const [suffix, px] of TAB_SCALES) {
          execFileSync(rasterizer, ["-w", String(px), "-h", String(px), "-o", join(assetsDir, `${name}${suffix}.png`), svgPath], {
            stdio: "inherit",
          });
        }
        console.log(`Rendered ${name} at ${TAB_SCALES.map(([, px]) => `${px}px`).join(", ")}`);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    for (const name of Object.keys(recorded?.icons ?? {})) {
      if (manifest.tabIcons.includes(name)) continue;
      for (const [suffix] of TAB_SCALES) rmSync(join(assetsDir, `${name}${suffix}.png`), { force: true });
      console.log(`Removed ${name} PNGs (no longer in "tabIcons")`);
    }
    writeFileSync(assetManifestPath, expectedAssetManifest);
    console.log(`Wrote ${label(assetManifestPath)}`);
  }
  if (moduleStale) {
    mkdirSync(dirname(tabsOutPath), { recursive: true });
    writeFileSync(tabsOutPath, expectedModule);
    console.log(`Wrote ${label(tabsOutPath)} (${summary}).`);
  }
  return 0;
}

// --- main ------------------------------------------------------------------------

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("-h") || args.flags.has("--help")) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.command !== "add" && args.names.length > 0) fail(`unexpected argument(s) ${args.names.join(" ")}`);
  if (args.flags.has("--check") && (args.command === "add" || args.command === "init")) fail(`--check does not apply to ${args.command}`);
  const snapshot = loadSnapshot();
  const handlers = { generate, add, init, tabs };
  process.exit(handlers[args.command](args, snapshot));
} catch (error) {
  if (!(error instanceof CliError)) throw error;
  console.error(`expo-ui-icons: ${error.message}`);
  console.error("Run expo-ui-icons --help for usage.");
  process.exit(1);
}
