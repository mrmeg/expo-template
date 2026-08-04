/**
 * Translation key drift guard.
 *
 * These tests import the translation modules directly rather than exercising a
 * live i18next instance, because `test/setup.ts` mocks `react-i18next` so that
 * `useTranslation().t` is the identity function `(key) => key`.
 */
import fs from "node:fs";
import path from "node:path";

import en from "../translations/en";
import es from "../translations/es";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

/** Directories scanned for `t("...")` / `translate("...")` call sites. */
const SCAN_DIRS = ["app", "client"];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const IGNORED_DIR_NAMES = new Set(["node_modules", "__tests__", "__mocks__"]);

type TranslationTree = { [key: string]: string | TranslationTree };

/** Flattens a nested translation object into dot-separated key paths. */
function flattenKeys(tree: TranslationTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [keyPath] : flattenKeys(value, keyPath);
  });
}

/** Resolves a dot-separated key path against a translation object. */
function resolveKey(tree: TranslationTree, keyPath: string): string | undefined {
  const resolved = keyPath
    .split(".")
    .reduce<string | TranslationTree | undefined>(
      (node, segment) =>
        node && typeof node === "object" ? node[segment] : undefined,
      tree,
    );
  return typeof resolved === "string" ? resolved : undefined;
}

/** Recursively collects `.ts`/`.tsx` files under `dir`. */
function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIR_NAMES.has(entry.name) ? [] : collectSourceFiles(entryPath);
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      return [];
    }
    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
      return [];
    }
    return [entryPath];
  });
}

/**
 * Static-literal `t()` / `translate()` call sites. Only double-quoted string
 * literals are matched; dynamic keys are out of scope for this guard.
 */
const TRANSLATE_CALL = /\b(?:t|translate)\(\s*"([^"\\]+)"/g;

/**
 * Removes block and line comments so documentation examples (e.g. the
 * `t("a.b")` sample in `client/features/i18n/index.ts`) aren't treated as real
 * call sites. Newlines are preserved so nothing else shifts.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\w])\/\/[^\n]*/g, (match, prefix) => prefix);
}

type CallSite = { key: string; file: string };

function collectCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const scanDir of SCAN_DIRS) {
    for (const file of collectSourceFiles(path.join(REPO_ROOT, scanDir))) {
      const contents = stripComments(fs.readFileSync(file, "utf8"));
      for (const match of contents.matchAll(TRANSLATE_CALL)) {
        const key = match[1];
        // Skip non-key arguments (URLs, paths, sentences) — translation keys are
        // dot-separated identifiers.
        if (!/^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/.test(key)) {
          continue;
        }
        sites.push({ key, file: path.relative(REPO_ROOT, file) });
      }
    }
  }
  return sites;
}

describe("translation locales", () => {
  it("en and es have identical key paths", () => {
    const enKeys = flattenKeys(en as TranslationTree).sort();
    const esKeys = flattenKeys(es as TranslationTree).sort();

    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]);
    expect(esKeys).toEqual(enKeys);
  });

  it("has no empty translation strings", () => {
    for (const [locale, tree] of [
      ["en", en],
      ["es", es],
    ] as const) {
      for (const keyPath of flattenKeys(tree as TranslationTree)) {
        expect(resolveKey(tree as TranslationTree, keyPath)?.trim()).not.toBe("");
        expect(`${locale}.${keyPath}`).toBeTruthy();
      }
    }
  });
});

describe("referenced translation keys", () => {
  const callSites = collectCallSites();

  it("finds translation call sites to check", () => {
    expect(callSites.length).toBeGreaterThan(0);
    expect(callSites.some((site) => site.file.includes("client/features/auth"))).toBe(
      true,
    );
  });

  it("every referenced key is defined in en", () => {
    const missing = callSites
      .filter((site) => resolveKey(en as TranslationTree, site.key) === undefined)
      .map((site) => `${site.key} (${site.file})`)
      .sort();

    expect(missing).toEqual([]);
  });

  it("every referenced key is defined in es", () => {
    const missing = callSites
      .filter((site) => resolveKey(es as TranslationTree, site.key) === undefined)
      .map((site) => `${site.key} (${site.file})`)
      .sort();

    expect(missing).toEqual([]);
  });

  it("interpolation placeholders match between en and es", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

    for (const keyPath of flattenKeys(en as TranslationTree)) {
      const enValue = resolveKey(en as TranslationTree, keyPath);
      const esValue = resolveKey(es as TranslationTree, keyPath);
      if (enValue === undefined || esValue === undefined) {
        continue;
      }
      expect({ keyPath, placeholders: placeholders(esValue) }).toEqual({
        keyPath,
        placeholders: placeholders(enValue),
      });
    }
  });
});
