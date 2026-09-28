/**
 * Finds packages a bundle carries more than one physical copy of, from the
 * `sources` of the bundle's source maps.
 *
 * Some packages break at runtime when a bundle holds two copies. React and the
 * DOM renderer hold the hooks dispatcher; react-native-web holds the style
 * registry; Radix and `@rn-primitives` modules hold React contexts and
 * `Symbol("radix.slottable")`, which is `Symbol()` rather than `Symbol.for()` and
 * so unique per copy. Two copies of `@radix-ui/react-slot` is how the web
 * AlertDialog threw `React.Children.only expected to receive a single React
 * element child` (`__tests__/radixSingleton.guardrail.test.ts` has the
 * mechanism). A consumer's install decides whether that happens, so the
 * consumer smoke checks the web bundle it exports.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Package names that must resolve to one copy per bundle. */
export const SINGLETON_PACKAGES = [
  /^react$/,
  /^react-dom$/,
  /^react-native-web$/,
  /^@radix-ui\//,
  /^@rn-primitives\//,
  /^@mrmeg\/expo-ui$/,
];

/**
 * `{ name, root }` for a bundled module path, where `root` is the physical copy
 * (everything up to and including the package directory), or `null` for a
 * module outside `node_modules`. Handles hoisted nesting
 * (`node_modules/a/node_modules/b/…`) and Bun's isolated store
 * (`node_modules/.bun/b@1.0.0/node_modules/b/…`) alike, since the last
 * `node_modules/` segment is always the one that owns the file.
 */
export function packageRootOf(source) {
  const path = source.replace(/\\/g, "/");
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index === -1) return null;

  const [first, second] = path.slice(index + marker.length).split("/");
  if (!first || first.startsWith(".")) return null;
  const name = first.startsWith("@") ? (second ? `${first}/${second}` : null) : first;
  if (!name) return null;
  return { name, root: `${path.slice(0, index + marker.length)}${name}` };
}

/**
 * Singleton packages bundled from more than one root, sorted by name.
 *
 * @param {Iterable<string>} sources
 * @param {RegExp[]} [patterns]
 * @returns {{ name: string, roots: string[] }[]}
 */
export function findDuplicatePackages(sources, patterns = SINGLETON_PACKAGES) {
  const roots = new Map();
  for (const source of sources) {
    const found = packageRootOf(source);
    if (!found || !patterns.some((pattern) => pattern.test(found.name))) continue;
    if (!roots.has(found.name)) roots.set(found.name, new Set());
    roots.get(found.name).add(found.root);
  }
  return [...roots]
    .filter(([, copies]) => copies.size > 1)
    .map(([name, copies]) => ({ name, roots: [...copies].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every package name any source belongs to. */
export function bundledPackages(sources) {
  const names = new Set();
  for (const source of sources) {
    const found = packageRootOf(source);
    if (found) names.add(found.name);
  }
  return names;
}

/**
 * The `sources` of every `.map` file under `dir`, including sectioned (index)
 * maps, which is what Expo writes for web bundles.
 *
 * @returns {Promise<{ maps: number, sources: string[] }>}
 */
export async function readSourceMapSources(dir) {
  const sources = [];
  let maps = 0;

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith(".map")) {
        maps += 1;
        const map = JSON.parse(await readFile(path, "utf8"));
        for (const section of map.sections ?? [{ map }]) {
          sources.push(...(section.map?.sources ?? []));
        }
      }
    }
  }

  await walk(dir);
  return { maps, sources };
}
