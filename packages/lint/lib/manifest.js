/**
 * The design-system facts as data, for the projects that have no sources.
 *
 * `lib/source.js` reads `packages/ui/src` at lint time, which only exists where
 * the design system itself is checked out. The UI package's build serializes the
 * same facts into `dist/design-system.json` (see
 * `scripts/build-design-system-manifest.mjs`), and this module reads them back,
 * so a project that installed `@mrmeg/expo-ui` from npm gets messages that quote
 * the tokens, presets, and sizes of the release it installed.
 *
 * Only `entries` are stored per token group: `values` and `nameByValue` are
 * derived on load, exactly as the source loader derives them, so the two loaders
 * cannot disagree about what a value's token is.
 */

const fs = require("node:fs");

const { emptyDesignSystem } = require("./source");

/**
 * Bumped when the payload shape changes; a version this plugin does not know
 * is rejected. Version 2 added `tokens.typography` (with `lineHeight` per
 * entry) and `fonts.families`; a version 1 manifest still loads, with those two
 * empty, and `no-raw-typography` says so once per file.
 */
const MANIFEST_SCHEMA_VERSION = 2;

/** Every schema version the loader reads, oldest first. */
const SUPPORTED_MANIFEST_SCHEMA_VERSIONS = [1, 2];

/** Where a consumer's manifest lives, resolved through the UI package's exports. */
const DEFAULT_MANIFEST_SPECIFIER = "@mrmeg/expo-ui/design-system.json";

/**
 * Same window and reason as `lib/source.js`: every rule asks once per file, and
 * the manifest changes between lint runs, not during one.
 */
const MTIME_CHECK_INTERVAL_MS = 2000;

/**
 * @typedef {object} DesignSystemManifest
 * @property {number} schemaVersion
 * @property {string} package the package that shipped the manifest
 * @property {string} version that package's version
 * @property {Record<string, {entries: {name: string, value: number, lineHeight?: number}[]}>} tokens
 * @property {Record<string, string>} palette
 * @property {string[]} themeTokens
 * @property {Record<string, {paletteKey: string | null, value: string | null}>} lightTheme
 * @property {Record<string, {paletteKey: string | null, value: string | null}>} darkTheme
 * @property {string[] | null} fontVariants
 * @property {{families: import("./source").FontFamilies}} fonts
 * @property {import("./source").ComponentInfo[]} components
 */

/** @type {Map<string, {signature: string, checkedAt: number, data: import("./source").DesignSystem}>} */
const cache = new Map();

/**
 * @param {import("./source").DesignSystem} design a loaded design system
 * @param {{packageName: string, version: string}} about the package it came from
 * @returns {DesignSystemManifest}
 */
function serializeDesignSystem(design, { packageName, version }) {
  if (!design || !design.loaded) {
    // A manifest of nothing would make every consumer's messages quote nothing,
    // and the build that wrote it would look like it succeeded.
    throw new Error("Cannot serialize a design system that was not loaded");
  }

  /** @type {Record<string, {entries: {name: string, value: number, lineHeight?: number}[]}>} */
  const tokens = {};
  for (const group of Object.keys(design.tokens)) {
    tokens[group] = {
      entries: design.tokens[group].entries.map((entry) =>
        typeof entry.lineHeight === "number"
          ? { name: entry.name, value: entry.value, lineHeight: entry.lineHeight }
          : { name: entry.name, value: entry.value },
      ),
    };
  }

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    package: packageName,
    version,
    tokens,
    palette: { ...design.palette },
    themeTokens: [...design.themeTokens],
    lightTheme: { ...design.lightTheme },
    darkTheme: { ...design.darkTheme },
    fontVariants: design.fontVariants ? [...design.fontVariants] : null,
    fonts: { families: copyFamilies(design.fonts && design.fonts.families) },
    // Extractor order, so the manifest reads like the source it came from.
    components: [...design.components.values()].map((info) => ({
      name: info.name,
      file: info.file,
      hasSize: info.hasSize,
      variantProp: info.variantProp,
      variantValues: info.variantValues,
      sizeValues: info.sizeValues,
    })),
  };
}

/**
 * @param {string} manifestPath absolute path to a `design-system.json`
 * @returns {import("./source").DesignSystem} loaded facts, or an empty design
 *   system whose `origin.error` says why it could not be read
 */
function loadDesignSystemFromManifest(manifestPath) {
  const now = Date.now();
  const cached = cache.get(manifestPath);
  if (cached && now - cached.checkedAt < MTIME_CHECK_INTERVAL_MS) return cached.data;

  const signature = String(mtimeOf(manifestPath));
  if (cached && cached.signature === signature) {
    cached.checkedAt = now;
    return cached.data;
  }

  const data = readManifest(manifestPath);
  cache.set(manifestPath, { signature, checkedAt: now, data });
  return data;
}

/**
 * @param {string} file
 * @returns {number} mtime in ms, or -1 when the file is unreadable
 */
function mtimeOf(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

/**
 * @param {string} manifestPath
 * @returns {import("./source").DesignSystem}
 */
function readManifest(manifestPath) {
  let text;
  try {
    text = fs.readFileSync(manifestPath, "utf8");
  } catch (error) {
    return rejected(
      manifestPath,
      error && error.code === "ENOENT" ? "no file at that path" : "the file could not be read",
    );
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return rejected(manifestPath, "the file is not valid JSON");
  }

  if (!raw || typeof raw !== "object") {
    return rejected(manifestPath, "the manifest is not a JSON object");
  }
  if (!SUPPORTED_MANIFEST_SCHEMA_VERSIONS.includes(raw.schemaVersion)) {
    return rejected(
      manifestPath,
      `schemaVersion ${JSON.stringify(raw.schemaVersion)} is not supported ` +
        `(this plugin reads ${SUPPORTED_MANIFEST_SCHEMA_VERSIONS.join(" and ")})`,
    );
  }
  if (!raw.tokens || typeof raw.tokens !== "object" || !Array.isArray(raw.components)) {
    return rejected(manifestPath, "the manifest has no `tokens` object or `components` list");
  }

  const design = emptyDesignSystem();
  let tokenEntryCount = 0;
  for (const group of Object.keys(design.tokens)) {
    // A malformed group — no `entries`, or an `entries` that is not a list — is
    // no entries. Iterating it would throw out of the rule's `create()`.
    const rawGroup = raw.tokens[group];
    const entries = Array.isArray(rawGroup && rawGroup.entries) ? rawGroup.entries : [];
    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" || typeof entry.value !== "number") continue;
      design.tokens[group].entries.push(
        typeof entry.lineHeight === "number"
          ? { name: entry.name, value: entry.value, lineHeight: entry.lineHeight }
          : { name: entry.name, value: entry.value },
      );
      if (!design.tokens[group].nameByValue.has(entry.value)) {
        design.tokens[group].nameByValue.set(entry.value, entry.name);
      }
    }
    design.tokens[group].values = [...design.tokens[group].nameByValue.keys()].sort((a, b) => a - b);
    tokenEntryCount += design.tokens[group].entries.length;
  }

  // Well-formed JSON that carries no facts is a dead end, not a design system:
  // loading it would make every rule lint silently against nothing.
  if (tokenEntryCount === 0 && raw.components.length === 0) {
    return rejected(manifestPath, "the manifest has no tokens or components");
  }

  design.palette = objectOrEmpty(raw.palette);
  design.themeTokens = Array.isArray(raw.themeTokens) ? [...raw.themeTokens] : [];
  design.lightTheme = objectOrEmpty(raw.lightTheme);
  design.darkTheme = objectOrEmpty(raw.darkTheme);
  design.fontVariants = Array.isArray(raw.fontVariants) ? [...raw.fontVariants] : null;
  // Absent from a schemaVersion 1 manifest: an empty map, never a throw.
  design.fonts = { families: copyFamilies(raw.fonts && raw.fonts.families) };
  for (const info of raw.components) {
    if (!info || typeof info.name !== "string") continue;
    design.components.set(info.name, {
      name: info.name,
      file: info.file,
      hasSize: Boolean(info.hasSize),
      variantProp: info.variantProp ?? null,
      variantValues: info.variantValues ?? null,
      sizeValues: info.sizeValues ?? null,
    });
  }
  design.loaded = true;
  design.origin = {
    kind: "manifest",
    path: manifestPath,
    package: raw.package,
    version: raw.version,
  };
  return design;
}

/**
 * @param {unknown} value
 * @returns {Record<string, any>} a shallow copy when it is a plain object, and
 *   an empty object for anything else — a string or a number spread as a map
 *   would invent facts the manifest does not state
 */
function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

/**
 * @param {unknown} families a `fonts.families` value, from the loader or a manifest
 * @returns {import("./source").FontFamilies} a copy holding only the well-formed
 *   part: variant → weight → a list of strings (a lone string becomes a list)
 */
function copyFamilies(families) {
  /** @type {import("./source").FontFamilies} */
  const copy = {};
  if (!families || typeof families !== "object" || Array.isArray(families)) return copy;
  for (const variant of Object.keys(families)) {
    const weights = families[variant];
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) continue;
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const weight of Object.keys(weights)) {
      const raw = weights[weight];
      const list = (Array.isArray(raw) ? raw : [raw]).filter((family) => typeof family === "string");
      if (list.length > 0) out[weight] = [...list];
    }
    if (Object.keys(out).length > 0) copy[variant] = out;
  }
  return copy;
}

/**
 * @param {string} manifestPath
 * @param {string} reason one line, ready to be quoted in a diagnostic
 * @returns {import("./source").DesignSystem}
 */
function rejected(manifestPath, reason) {
  const design = emptyDesignSystem();
  design.origin = { kind: "manifest", path: manifestPath, error: reason };
  return design;
}

module.exports = {
  DEFAULT_MANIFEST_SPECIFIER,
  MANIFEST_SCHEMA_VERSION,
  SUPPORTED_MANIFEST_SCHEMA_VERSIONS,
  loadDesignSystemFromManifest,
  serializeDesignSystem,
};
