/**
 * Shared rule settings, read from `settings["expo-ui"]` in the flat config.
 *
 * - `uiSourceDir`: where the design-system sources live. An absolute path is
 *   used as written; a relative one is resolved by walking up from the ESLint
 *   working directory — and then from the linted file's directory — until a
 *   directory exists at that relative path. Without the walk, a lint run
 *   started anywhere but the repo root would silently load nothing and every
 *   rule would degrade to a no-op. Defaults to `packages/ui/src`.
 * - `componentImports`: regex strings matched against an import source to
 *   decide whether a JSX element is a design-system component. Defaults to
 *   `@mrmeg/expo-ui` and its subpaths.
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_UI_SOURCE_DIR = "packages/ui/src";
const DEFAULT_COMPONENT_IMPORTS = ["^@mrmeg/expo-ui(/|$)"];

/**
 * Keyed on the raw settings object, then on the directories the search starts
 * from, because two files linted in one run can start from different places.
 *
 * @type {WeakMap<object, Map<string, {uiSourceDir: string, uiSourceLabel: string, componentImports: RegExp[]}>>}
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
 * @param {import("eslint").Rule.RuleContext} context
 * @returns {{uiSourceDir: string, uiSourceLabel: string, componentImports: RegExp[]}}
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

  const uiSourceDir = resolveUiSourceDir(raw.uiSourceDir || DEFAULT_UI_SOURCE_DIR, [cwd, fileDir]);
  const relative = path.relative(cwd, uiSourceDir).split(path.sep).join("/");
  const resolved = {
    uiSourceDir,
    // How the design-system directory is spelled in messages, e.g.
    // `packages/ui/src/constants/colors.ts`.
    uiSourceLabel: relative && !relative.startsWith("..") ? relative : DEFAULT_UI_SOURCE_DIR,
    componentImports: compilePatterns(
      Array.isArray(raw.componentImports) && raw.componentImports.length > 0
        ? raw.componentImports
        : DEFAULT_COMPONENT_IMPORTS,
    ),
  };
  byStart.set(key, resolved);
  return resolved;
}

module.exports = {
  DEFAULT_UI_SOURCE_DIR,
  DEFAULT_COMPONENT_IMPORTS,
  readSettings,
  resolveUiSourceDir,
};
