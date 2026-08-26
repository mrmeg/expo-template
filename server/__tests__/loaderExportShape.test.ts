/**
 * Loader export-shape guard for production exports.
 *
 * `expo export` decides which routes have loaders with a Babel pass over
 * `app/` (`babel-preset-expo`'s `server-data-loaders-plugin`). Its
 * `ExportNamedDeclaration` visitor bails on `exportKind === "type"` **and on
 * any export with specifiers**, then only recognizes a `loader`
 * `FunctionDeclaration` or a `VariableDeclaration` whose declarator is named
 * `loader`. So a specifier re-export — `export { someLoader as loader } from
 * "…"` or `export { loader } from "…"` — is silently skipped: no loader
 * bundle is emitted and the route gets no `loader` entry in
 * `dist/server/_expo/routes.json`.
 *
 * Nothing at runtime catches this. Development masks it (the dev server marks
 * every HTML route as having a loader) and in production the route degrades
 * quietly: `/_expo/loaders/<route>` 404s and the SSR render falls through to
 * `useLoaderData`'s client fetch, which throws `TypeError: fetch() URL is
 * invalid` inside the route's Suspense boundary. So this test reads the route
 * sources instead and pins the shape the export can actually detect.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const APP_ROOT = path.join(REPO_ROOT, "app");

/** Route files that must keep a detectable `loader` declaration. */
const LOADER_ROUTES = ["app/(main)/(demos)/server-alpha/index.tsx"];

/**
 * Matches an export whose specifier list mentions `loader`, which is exactly
 * what the plugin skips. Mirrors the plugin's `specifiers.length > 0` bail
 * rather than trying to be a parser.
 */
const EXPORT_SPECIFIER_LIST = /export\s+(type\s+)?\{([^}]*)\}/g;

/**
 * Matches the declaration shapes the plugin recognizes:
 * `export const loader = …`, `export function loader…`,
 * `export async function loader…`.
 */
const LOADER_DECLARATION =
  /export\s+(?:const|let|var|(?:async\s+)?function\s*\*?)\s+loader\b/;

/**
 * Comments are dropped before matching so prose about the broken shape (this
 * pitfall is documented in `docs/server-guide.md`) cannot trip the scan.
 * Block comments and comment-only lines cover every realistic case without
 * touching string literals that contain `//`.
 */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");

/** Exported names in every `export { … }` specifier list in a source file. */
export function exportedSpecifierNames(source: string): string[] {
  const names: string[] = [];
  for (const match of stripComments(source).matchAll(EXPORT_SPECIFIER_LIST)) {
    const isTypeExport = Boolean(match[1]);
    if (isTypeExport) continue;
    for (const specifier of match[2].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const exported = (parts.length > 1 ? parts[1] : parts[0]).trim();
      if (exported) names.push(exported.replace(/^type\s+/, "").trim());
    }
  }
  return names;
}

/** Route files (`.ts`/`.tsx`) under `app/`, tests excluded. */
function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const routeFiles = walkRoutes(APP_ROOT).map((file) => path.relative(REPO_ROOT, file));

const read = (relativePath: string) =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");

describe("loader export shape", () => {
  it("scans the whole app router tree", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    expect(routeFiles).toContain("app/(main)/(demos)/server-alpha/index.tsx");
  });

  it("exports no route `loader` through a specifier list", () => {
    const offenders = routeFiles.filter((file) =>
      exportedSpecifierNames(read(file)).includes("loader"),
    );

    expect(offenders).toEqual([]);
  });

  it.each(LOADER_ROUTES)("%s declares its loader in the route file", (route) => {
    expect(read(route)).toMatch(LOADER_DECLARATION);
  });

  /**
   * Same plugin, other direction: it removes a declared `export default` from
   * the loader bundle, but an `export { default } from "…"` line is a specifier
   * export it skips, so the screen graph ships inside the server-side loader
   * bundle (measured on this route: 1.2 MB versus 15 KB). Loader-less routes
   * keep the one-line re-export convention — this only applies to routes that
   * emit a loader bundle.
   */
  it.each(LOADER_ROUTES)("%s declares its default export, not a re-export", (route) => {
    const source = read(route);

    expect(exportedSpecifierNames(source)).not.toContain("default");
    expect(source).toMatch(/export\s+default\s+/);
  });

  it("recognizes the specifier shapes the export plugin skips", () => {
    expect(
      exportedSpecifierNames(`export { serverAlphaLoader as loader } from "./loaders";`),
    ).toContain("loader");
    expect(exportedSpecifierNames(`export { loader } from "./loaders";`)).toContain("loader");
    expect(exportedSpecifierNames(`export {\n  loader,\n  other,\n} from "./loaders";`)).toContain(
      "loader",
    );
  });

  it("does not flag detectable declarations or unrelated exports", () => {
    for (const source of [
      `export const loader = serverAlphaLoader;`,
      `export async function loader(request) { return null; }`,
      `export { serverAlphaLoader } from "./loaders";`,
      `export { default } from "./Screen";`,
      `export type { loader } from "./loaders";`,
      `// export { serverAlphaLoader as loader } from "./loaders";`,
      `/** export { x as loader } — the shape the export plugin skips. */`,
    ]) {
      expect(exportedSpecifierNames(source)).not.toContain("loader");
    }
  });

  it("keeps `export const loader = …` matching the plugin's declaration check", () => {
    expect(`export const loader = serverAlphaLoader;`).toMatch(LOADER_DECLARATION);
    expect(`export async function loader(request, params) {}`).toMatch(LOADER_DECLARATION);
    expect(`export { serverAlphaLoader as loader } from "./loaders";`).not.toMatch(
      LOADER_DECLARATION,
    );
  });
});
