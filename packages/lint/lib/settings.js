/**
 * Shared rule settings, read from `settings["expo-ui"]` in the flat config, plus
 * the resolution order that decides where the design-system facts come from.
 *
 * - `manifestPath` (optional): a `design-system.json` to read instead of any
 *   sources. Absolute as written; a relative path is searched upward from the
 *   ESLint working directory and then the linted file's directory.
 * - `uiSourceDir`: where the design-system sources live. An absolute path is
 *   used as written; a relative one is resolved by walking up from the ESLint
 *   working directory — and then from the linted file's directory — until a
 *   directory exists at that relative path. Without the walk, a lint run
 *   started anywhere but the repo root would silently load nothing and every
 *   rule would degrade to a no-op. Defaults to `packages/ui/src`.
 * - `componentImports`: regex strings matched against an import source to
 *   decide whether a JSX element is a design-system component. Defaults to
 *   `@mrmeg/expo-ui` and its subpaths.
 *
 * With neither setting pointing anywhere, an installed `@mrmeg/expo-ui` is asked
 * for its manifest, which is what makes the rules work in a project that never
 * has the sources on disk.
 */

const fs = require("node:fs");
const path = require("node:path");

const { DEFAULT_MANIFEST_SPECIFIER, loadDesignSystemFromManifest } = require("./manifest");

const DEFAULT_UI_SOURCE_DIR = "packages/ui/src";
const DEFAULT_COMPONENT_IMPORTS = ["^@mrmeg/expo-ui(/|$)"];

/** Named in messages when a manifest was read but does not say who shipped it. */
const DEFAULT_UI_PACKAGE = DEFAULT_MANIFEST_SPECIFIER.split("/").slice(0, 2).join("/");

/**
 * Keyed on the raw settings object, then on the directories the search starts
 * from, because two files linted in one run can start from different places.
 *
 * @type {WeakMap<object, Map<string, Settings>>}
 */
const cache = new WeakMap();

/**
 * @param {string[]} patterns
 * @returns {RegExp[]} compiled patterns; invalid patterns are dropped
 */
function compilePatterns(patterns) {
  /** @type {RegExp[]} */
  const compiled = [];
  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern));
    } catch {
      // An unparseable pattern degrades to "matches nothing" rather than
      // crashing the lint run.
    }
  }
  return compiled;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves `uiSourceDir` to an absolute path.
 *
 * An absolute setting is taken as written. A relative one is looked for from
 * each start directory upwards, so `packages/ui/src` resolves whether ESLint
 * runs at the repo root, in `app/`, or from an editor whose working directory
 * is some other folder. When no candidate exists, the first start directory
 * wins so the not-found diagnostic can name a concrete path.
 *
 * @param {string} uiSourceDir the configured value
 * @param {(string | undefined)[]} startDirs directories to search from, in order
 * @returns {string} an absolute path
 */
function resolveUiSourceDir(uiSourceDir, startDirs) {
  if (path.isAbsolute(uiSourceDir)) return path.normalize(uiSourceDir);

  /** @type {string[]} */
  const starts = [];
  for (const start of startDirs) {
    if (typeof start === "string" && start) starts.push(path.resolve(start));
  }
  if (starts.length === 0) starts.push(process.cwd());

  for (const start of starts) {
    let dir = start;
    for (;;) {
      const candidate = path.join(dir, uiSourceDir);
      if (isDirectory(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return path.resolve(starts[0], uiSourceDir);
}

/**
 * Resolves a configured `manifestPath` the same way `resolveUiSourceDir` resolves
 * a directory, so a relative path works from wherever ESLint was started.
 *
 * @param {string} manifestPath the configured value
 * @param {(string | undefined)[]} startDirs directories to search from, in order
 * @returns {string} an absolute path, existing or not
 */
function resolveManifestPath(manifestPath, startDirs) {
  if (path.isAbsolute(manifestPath)) return path.normalize(manifestPath);

  /** @type {string[]} */
  const starts = [];
  for (const start of startDirs) {
    if (typeof start === "string" && start) starts.push(path.resolve(start));
  }
  if (starts.length === 0) starts.push(process.cwd());

  for (const start of starts) {
    let dir = start;
    for (;;) {
      const candidate = path.join(dir, manifestPath);
      if (isFile(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // Nothing exists: name the first candidate so the diagnostic points somewhere.
  return path.resolve(starts[0], manifestPath);
}

/**
 * @typedef {object} DesignSystemOrigin
 * @property {"source" | "manifest" | "none"} kind
 * @property {string} [path] the sources directory, or the manifest file
 * @property {boolean} [missing] a configured `manifestPath` that is not there
 * @property {string} [uiSourceDir] the directory that was tried, for the message
 * @property {string} [package] the package that shipped a loaded manifest
 * @property {string} [version] that package's version
 * @property {string} [error] why a manifest could not be read
 */

/**
 * Where this lint run's design-system facts come from, in the order a project is
 * most likely to mean: an explicit manifest, then sources on disk, then whatever
 * `@mrmeg/expo-ui` is installed.
 *
 * @param {{rawSettings?: object, cwd?: string, filename?: string}} input
 * @returns {DesignSystemOrigin}
 */
function resolveOrigin({ rawSettings, cwd, filename }) {
  const raw = rawSettings || {};
  const base = cwd || process.cwd();
  const fileDir = filename ? path.dirname(path.resolve(base, filename)) : "";
  const startDirs = [base, fileDir];

  // 1. An explicit manifest is an answer, right or wrong: a typo must be
  // reported rather than quietly fall through to some other design system.
  if (typeof raw.manifestPath === "string" && raw.manifestPath) {
    const resolved = resolveManifestPath(raw.manifestPath, startDirs);
    return isFile(resolved)
      ? { kind: "manifest", path: resolved }
      : { kind: "manifest", path: resolved, missing: true };
  }

  // 2. Sources on disk: this repo, or a project that vendors `packages/ui/src`.
  const uiSourceDir = resolveUiSourceDir(raw.uiSourceDir || DEFAULT_UI_SOURCE_DIR, startDirs);
  if (isDirectory(uiSourceDir)) return { kind: "source", path: uiSourceDir };

  // 3. An installed release ships the manifest. The linted file's directory goes
  // first so the nearest install wins, the way Node would resolve the import.
  const paths = [fileDir, base].filter(Boolean);
  try {
    return { kind: "manifest", path: require.resolve(DEFAULT_MANIFEST_SPECIFIER, { paths }) };
  } catch {
    // Not installed, or installed without the manifest export.
  }

  return { kind: "none", uiSourceDir };
}

/**
 * How the design system is spelled in messages: a repo-relative directory for
 * sources, the shipping package's name for a manifest — so a consumer reads
 * `@mrmeg/expo-ui/components/Button.tsx` where this repo reads
 * `packages/ui/src/components/Button.tsx`, from the same message template.
 *
 * @param {DesignSystemOrigin} origin
 * @param {string} cwd
 * @returns {string}
 */
function labelFor(origin, cwd) {
  if (origin.kind === "manifest") {
    const design = loadDesignSystemFromManifest(origin.path);
    const shipped = design.origin && design.origin.package;
    return typeof shipped === "string" && shipped ? shipped : DEFAULT_UI_PACKAGE;
  }
  const dir = origin.path || origin.uiSourceDir || DEFAULT_UI_SOURCE_DIR;
  const relative = path.relative(cwd, dir).split(path.sep).join("/");
  return relative && !relative.startsWith("..") ? relative : DEFAULT_UI_SOURCE_DIR;
}

/**
 * @typedef {object} Settings
 * @property {string} uiSourceDir the sources directory, resolved or attempted
 * @property {string} uiSourceLabel how the design system is named in messages
 * @property {RegExp[]} componentImports
 * @property {DesignSystemOrigin} origin
 */

/**
 * @param {import("eslint").Rule.RuleContext} context
 * @returns {Settings}
 */
function readSettings(context) {
  const raw = (context.settings && context.settings["expo-ui"]) || {};
  const cwd = context.cwd || process.cwd();
  const filename = typeof context.filename === "string" ? context.filename : "";
  const fileDir = filename ? path.dirname(path.resolve(cwd, filename)) : "";
  const key = cwd + "|" + fileDir;

  let byStart = cache.get(raw);
  if (byStart) {
    const cached = byStart.get(key);
    if (cached) return cached;
  } else {
    byStart = new Map();
    cache.set(raw, byStart);
  }

  const origin = resolveOrigin({ rawSettings: raw, cwd, filename });
  const resolved = {
    // Still resolved for a manifest origin: the not-found text names the
    // directory that was looked for.
    uiSourceDir:
      origin.kind === "source"
        ? origin.path
        : origin.uiSourceDir ||
          resolveUiSourceDir(raw.uiSourceDir || DEFAULT_UI_SOURCE_DIR, [cwd, fileDir]),
    uiSourceLabel: labelFor(origin, cwd),
    componentImports: compilePatterns(
      Array.isArray(raw.componentImports) && raw.componentImports.length > 0
        ? raw.componentImports
        : DEFAULT_COMPONENT_IMPORTS,
    ),
    origin,
  };
  byStart.set(key, resolved);
  return resolved;
}

module.exports = {
  DEFAULT_UI_SOURCE_DIR,
  DEFAULT_COMPONENT_IMPORTS,
  readSettings,
  resolveOrigin,
  resolveUiSourceDir,
};
