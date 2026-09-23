/**
 * The repo-only `@mrmeg/source` export condition.
 *
 * `@mrmeg/expo-ui`, `@mrmeg/expo-media` and `@mrmeg/expo-purchases` list it
 * first in each `exports` entry, pointing at `src`; tsconfig.json, Metro, and
 * Jest enable it, so the template builds and tests the workspace sources through
 * the same export maps consumers resolve. These pin both halves of that:
 *
 * - with the condition on, every module a subpath pattern exposes resolves to a
 *   source file that exists. Metro takes an export target literally — no
 *   extension or platform probing — so a `.ts` module under a `*.tsx` pattern
 *   needs its own exact key, and a missing one fails the template's bundle;
 * - with it off, what a consumer resolves is unchanged: only `dist` targets, and
 *   every exact key added for the source condition resolves exactly like the
 *   pattern it shadows.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const SOURCE_CONDITION = "@mrmeg/source";

type ExportTarget = string | { [condition: string]: ExportTarget } | null;
type ExportsMap = Record<string, ExportTarget>;

const PACKAGES = [
  { dir: "packages/ui", name: "@mrmeg/expo-ui" },
  { dir: "packages/media", name: "@mrmeg/expo-media" },
  { dir: "packages/purchases", name: "@mrmeg/expo-purchases" },
];

function readExports(dir: string): ExportsMap {
  return JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")).exports;
}

/** Node's condition matching: the first key, in object order, that is enabled. */
function pickTarget(target: ExportTarget, conditions: Set<string>): string | null {
  if (typeof target === "string" || target === null) return target;
  for (const [condition, value] of Object.entries(target)) {
    if (condition !== "default" && !conditions.has(condition)) continue;
    const picked = pickTarget(value, conditions);
    if (picked !== null) return picked;
  }
  return null;
}

/** Node's subpath matching: an exact key first, then the most specific pattern. */
function resolveSubpath(exportsMap: ExportsMap, subpath: string, conditions: string[]): string | null {
  const enabled = new Set(conditions);
  if (subpath in exportsMap && !subpath.includes("*")) {
    return pickTarget(exportsMap[subpath], enabled);
  }
  const patterns = Object.keys(exportsMap)
    .filter((key) => key.includes("*"))
    .sort((a, b) => b.indexOf("*") - a.indexOf("*") || b.length - a.length);
  for (const key of patterns) {
    const [prefix, suffix] = key.split("*");
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;
    const match = subpath.slice(prefix.length, subpath.length - suffix.length);
    const target = pickTarget(exportsMap[key], enabled);
    return target === null ? null : target.replace("*", match);
  }
  return null;
}

/** Every string target an entry can produce, per condition path. */
function targetsOf(target: ExportTarget, path: string[] = []): { path: string[]; target: string }[] {
  if (typeof target === "string") return [{ path, target }];
  if (target === null) return [];
  return Object.entries(target).flatMap(([condition, value]) => targetsOf(value, [...path, condition]));
}

const MODULE = /\.(ts|tsx)$/;
const PLATFORM_VARIANT = /\.(native|web|ios|android)\.(ts|tsx)$/;

describe.each(PACKAGES)("$name exports", ({ dir }) => {
  const exportsMap = readExports(dir);

  it("lists the source condition first wherever it appears", () => {
    for (const [key, target] of Object.entries(exportsMap)) {
      if (typeof target !== "object" || target === null || !(SOURCE_CONDITION in target)) continue;
      expect([key, Object.keys(target)[0]]).toEqual([key, SOURCE_CONDITION]);
    }
  });

  it("points the source condition at files that exist under src", () => {
    for (const [key, target] of Object.entries(exportsMap)) {
      if (key.includes("*") || typeof target !== "object" || target === null) continue;
      const source = target[SOURCE_CONDITION];
      if (source === undefined) continue;
      for (const { target: file } of targetsOf(source)) {
        expect([key, file.startsWith("./src/"), existsSync(join(root, dir, file))]).toEqual([key, true, true]);
      }
    }
  });

  it("gives consumers dist targets only", () => {
    for (const [key, target] of Object.entries(exportsMap)) {
      for (const { path, target: file } of targetsOf(target)) {
        if (path[0] === SOURCE_CONDITION) continue;
        expect([key, file.startsWith("./dist/")]).toEqual([key, true]);
      }
    }
  });

  it("resolves every module a pattern exposes, with and without the condition", () => {
    const consumer = ["import", "types"];
    for (const key of Object.keys(exportsMap).filter((entry) => entry.includes("*"))) {
      const [prefix] = key.split("*");
      const sourceDir = join(root, dir, "src", prefix.slice(2));
      for (const file of readdirSync(sourceDir)) {
        if (!MODULE.test(file) || PLATFORM_VARIANT.test(file) || file.endsWith(".d.ts")) continue;
        const name = file.replace(MODULE, "");
        const subpath = `${prefix}${name}`;

        // Through the source condition: the module itself.
        const source = resolveSubpath(exportsMap, subpath, [SOURCE_CONDITION, "import"]);
        expect([subpath, source]).toEqual([subpath, `./src/${prefix.slice(2)}${file}`]);

        // Without it: what the pattern alone gives a consumer.
        const withoutExact = Object.fromEntries(
          Object.entries(exportsMap).filter(([entry]) => entry === key || entry !== subpath),
        );
        expect([subpath, resolveSubpath(exportsMap, subpath, consumer)]).toEqual([
          subpath,
          resolveSubpath(withoutExact, subpath, consumer),
        ]);
      }
    }
  });
});

describe("@mrmeg/expo-ui platform-split exact keys", () => {
  it("keeps native resolution for keyboardController through the condition", () => {
    const exportsMap = readExports("packages/ui");
    expect(
      resolveSubpath(exportsMap, "./components/keyboardController", [SOURCE_CONDITION, "react-native"]),
    ).toBe("./src/components/keyboardController.native.ts");
    expect(resolveSubpath(exportsMap, "./components/keyboardController", [SOURCE_CONDITION, "browser"])).toBe(
      "./src/components/keyboardController.ts",
    );
    expect(resolveSubpath(exportsMap, "./components/keyboardController", ["react-native", "import"])).toBe(
      "./dist/components/keyboardController.js",
    );
  });
});
