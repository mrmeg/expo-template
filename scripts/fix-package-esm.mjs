#!/usr/bin/env node
/**
 * Rewrite a built package's relative import specifiers so the ESM output is
 * resolvable by Node, Metro, and TypeScript's `node16`/`nodenext` resolution
 * (`./foo` -> `./foo.js`, `./bar` -> `./bar/index.js`).
 *
 * Both halves of the build are rewritten. The `.js` files, so Node can load
 * them; and the `.d.ts` files, because a consumer on `moduleResolution:
 * nodenext` resolves a declaration's `./foo` exactly like Node would — it fails,
 * and every symbol that crosses that import silently becomes `any`.
 *
 * One script for every workspace package; the only per-package difference is
 * whether platform-split modules exist, which is config-keyed below.
 *
 * Usage:
 *   node scripts/fix-package-esm.mjs <ui|media|purchases> [--dist <dir>]
 *
 * `--dist` rewrites a build emitted somewhere other than the package's `dist`
 * (the NodeNext consumer test builds into a temporary directory).
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `platformSuffixes` lists the platform-split module suffixes a package uses. A
 * JS specifier with a platform sibling (`./compress` next to
 * `compress.native.js`) must stay extension-less: Metro resolves an explicit
 * `./compress.js` to that exact file and never considers `compress.native.js`.
 * Declarations are exempt — Metro never reads them, and TypeScript resolves
 * `./compress.js` to `compress.d.ts`. An empty list skips the platform pass
 * entirely instead of paying a stat per specifier.
 */
const PACKAGES = {
  ui: { dist: "packages/ui/dist", platformSuffixes: ["native", "web", "ios", "android"] },
  media: { dist: "packages/media/dist", platformSuffixes: ["native"] },
  purchases: { dist: "packages/purchases/dist", platformSuffixes: ["native"] },
};

const packageNames = Object.keys(PACKAGES).sort();
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [packageName, ...rest] = process.argv.slice(2);
const target = PACKAGES[packageName];

function usageError(message) {
  console.error(message);
  console.error("Usage: node scripts/fix-package-esm.mjs <ui|media|purchases> [--dist <dir>]");
  process.exit(1);
}

if (!target) {
  usageError(
    `fix-package-esm: unknown package "${packageName ?? ""}". Expected one of: ${packageNames.join(", ")}`
  );
}

let distOverride = null;
for (let index = 0; index < rest.length; index += 1) {
  if (rest[index] === "--dist" && rest[index + 1]) {
    distOverride = rest[index + 1];
    index += 1;
  } else {
    usageError(`fix-package-esm: unexpected argument "${rest[index]}"`);
  }
}

const distRoot = distOverride ? resolve(process.cwd(), distOverride) : join(root, target.dist);
const platformSuffixes = target.platformSuffixes;

/**
 * Every relative specifier position the compiler emits: `import … from`,
 * `export … from`, a side-effect `import "…"`, and `import("…")` — a dynamic
 * import in `.js`, an import type in `.d.ts` (`import(".").Foo`). Only
 * specifiers that are `.`/`..` or start with `./`/`../` match, so bare package
 * names are never touched.
 */
const SPECIFIER_PATTERN = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?(?:\/[^"'\n]*)?)\2/g;

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listBuiltFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listBuiltFiles(path) : path;
    })
  );

  return files.flat().filter((path) => path.endsWith(".js") || path.endsWith(".d.ts"));
}

async function hasPlatformVariant(sourceDirectory, specifier) {
  for (const platform of platformSuffixes) {
    if (await isFile(resolve(sourceDirectory, `${specifier}.${platform}.js`))) {
      return true;
    }
  }

  return false;
}

function toRelativeSpecifier(sourceDirectory, absolutePath) {
  const relativePath = relative(sourceDirectory, absolutePath).split(sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

/** Runtime extension -> the declaration TypeScript resolves it to. */
const DECLARATION_EXTENSIONS = [
  [".js", ".d.ts"],
  [".mjs", ".d.mts"],
  [".cjs", ".d.cts"],
];

/**
 * The file a specifier has to find on disk. A declaration names the runtime
 * module (`./foo.js`) and TypeScript resolves that to the `.d.ts` beside it, so
 * the declaration is what has to exist; anything else (`./data.json`) is itself.
 */
function builtFileFor(path, isDeclaration) {
  if (!isDeclaration) return path;
  for (const [runtime, declaration] of DECLARATION_EXTENSIONS) {
    if (path.endsWith(runtime)) return `${path.slice(0, -runtime.length)}${declaration}`;
  }
  return path;
}

/**
 * Resolves one relative specifier to the form Node and `nodenext` accept.
 *
 * Deciding "already has an extension" from `extname()` is what used to leave
 * `./StyledText.context` untouched — `.context` is not an extension, it is part
 * of the module name. So a specifier is kept only when it already names a file
 * that exists, and otherwise gets `.js` or `/index.js` like any other.
 *
 * @returns {Promise<string | null>} the rewritten specifier, or null when
 *   nothing on disk matches (left as written, and reported)
 */
async function resolveRelativeSpecifier(sourceFile, specifier, isDeclaration) {
  const sourceDirectory = dirname(sourceFile);

  // `./foo.js`, `./data.json`: already explicit and pointing at a real file.
  if (extname(specifier) && (await isFile(builtFileFor(resolve(sourceDirectory, specifier), isDeclaration)))) {
    return specifier;
  }

  // Platform-split modules (`foo.native.js` beside `foo.js`) must stay
  // extension-less in JS. Metro only applies platform extension resolution to
  // specifiers without an extension: given `./foo.js` it takes the exact file
  // and every platform would end up on the base (web) module.
  if (!isDeclaration && (await hasPlatformVariant(sourceDirectory, specifier))) {
    return specifier;
  }

  const candidateFile = resolve(sourceDirectory, `${specifier}.js`);
  if (await isFile(builtFileFor(candidateFile, isDeclaration))) {
    return toRelativeSpecifier(sourceDirectory, candidateFile);
  }

  const candidateIndex = resolve(sourceDirectory, specifier, "index.js");
  if (await isFile(builtFileFor(candidateIndex, isDeclaration))) {
    return toRelativeSpecifier(sourceDirectory, candidateIndex);
  }

  return null;
}

/** @type {string[]} */
const unresolved = [];

async function rewriteFile(file) {
  const source = await readFile(file, "utf8");
  const isDeclaration = file.endsWith(".d.ts");

  /** @type {Map<string, string>} */
  const replacements = new Map();
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[3];
    if (replacements.has(specifier)) continue;
    const resolved = await resolveRelativeSpecifier(file, specifier, isDeclaration);
    if (resolved === null) {
      unresolved.push(`${relative(distRoot, file)}: ${specifier}`);
      replacements.set(specifier, specifier);
    } else {
      replacements.set(specifier, resolved);
    }
  }

  const output = source.replace(
    SPECIFIER_PATTERN,
    (fullMatch, prefix, quote, specifier) =>
      `${prefix}${quote}${replacements.get(specifier) ?? specifier}${quote}`
  );

  if (output !== source) {
    await writeFile(file, output);
  }
}

const files = await listBuiltFiles(distRoot);
await Promise.all(files.map(rewriteFile));

if (unresolved.length > 0) {
  // Left as written: a relative import with no built file behind it is broken
  // output, but the build that produced it is the place to fix that.
  console.warn(
    `fix-package-esm: ${unresolved.length} relative specifier(s) match no built file:\n  ${unresolved.sort().join("\n  ")}`
  );
}
