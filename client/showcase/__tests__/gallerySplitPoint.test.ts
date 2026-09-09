/**
 * Single-split-point guard for the showcase cluster (web bundle layout).
 *
 * Metro hoists any module reachable from two or more async route chunks into the
 * eagerly loaded `__common` chunk. The Explore tab and the five gallery routes
 * all render the same live previews, so the 36 previewed `@mrmeg/expo-ui`
 * components (and their Radix / vaul / floating-ui web engines) stay off every
 * other route's first-render download only while ALL of those consumers reach
 * the cluster through the one `import()` in `client/showcase/lazyGallery.tsx`.
 *
 * Nothing at runtime catches a regression: a static import of `previews.tsx`
 * from a route renders fine and silently drags the cluster back into
 * `__common`. So this test reads the sources and asserts the layout invariant.
 * `client/features/auth/components/__tests__/authComponentsSplitPoint.test.ts`
 * is the same idea for the auth forms.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLUSTER_DIR = "client/showcase";
const SPLIT_POINT = "client/showcase/lazyGallery.tsx";
const GALLERY_SPECIFIER = "@/client/showcase/gallery";

/**
 * Modules that belong to the cluster: anything outside `client/showcase/` that
 * imports one of these statically re-attaches the whole preview graph to its
 * own chunk. `registry`, `filters` and `GalleryChips` are deliberately NOT here:
 * they are the small data/chrome modules the Explore tab and templates gallery
 * need eagerly, and they render no previews.
 */
const CLUSTER_MODULES = [
  "gallery",
  "previews",
  "blockStages",
  "details",
  "ComponentsGalleryScreen",
  "ComponentDetailScreen",
  "BlocksGalleryScreen",
  "ShowcaseScreen",
  "ThemedShowcaseScreen",
  "Section",
  "SubSection",
  "ThemeToggle",
  "index",
];

/** Route files that must be one-line shells over `GalleryRoute`. */
const GALLERY_ROUTES: Record<string, string> = {
  "app/(main)/(demos)/showcase/index.tsx": "ShowcaseScreen",
  "app/(main)/(demos)/themed-showcase.tsx": "ThemedShowcaseScreen",
  "app/(main)/(demos)/components/index.tsx": "ComponentsGalleryScreen",
  "app/(main)/(demos)/components/[id].tsx": "ComponentDetailScreen",
  "app/(main)/(demos)/blocks/index.tsx": "BlocksGalleryScreen",
};

const SOURCE_TREES = ["app", "client", "server", "shared"];

const read = (relativePath: string) =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");

const staticImportSpecifiers = (source: string) =>
  [...source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?from\s+"([^"]+)"/g)].map(
    (match) => match[1],
  );

const dynamicImportSpecifiers = (source: string) =>
  [...source.matchAll(/import\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);

const clusterSpecifiers = new Set([
  "@/client/showcase",
  ...CLUSTER_MODULES.map((name) => `@/client/showcase/${name}`),
]);

const touchesCluster = (specifier: string) => clusterSpecifiers.has(specifier);

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const outsideCluster = () =>
  SOURCE_TREES.flatMap((tree) => walkSources(path.join(REPO_ROOT, tree)))
    .map((file) => path.relative(REPO_ROOT, file))
    .filter((file) => !file.startsWith(`${CLUSTER_DIR}/`));

describe("showcase gallery split point", () => {
  it("lazyGallery holds the only import() of the gallery barrel", () => {
    const source = read(SPLIT_POINT);

    expect(dynamicImportSpecifiers(source)).toEqual([GALLERY_SPECIFIER]);
    expect(staticImportSpecifiers(source).filter(touchesCluster)).toEqual([]);
  });

  it("nothing outside client/showcase imports the cluster statically", () => {
    const offenders = outsideCluster().filter((file) =>
      staticImportSpecifiers(read(file)).some(touchesCluster),
    );

    expect(offenders).toEqual([]);
  });

  it("nothing outside client/showcase adds a second import() of the cluster", () => {
    const offenders = outsideCluster().filter((file) =>
      dynamicImportSpecifiers(read(file)).some(
        (specifier) => specifier.startsWith("@/client/showcase"),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(GALLERY_ROUTES))(
    "%s is a lazy shell over GalleryRoute",
    (route, screen) => {
      const source = read(route);

      expect(staticImportSpecifiers(source)).toEqual(["@/client/showcase/lazyGallery"]);
      expect(source).toContain(`<GalleryRoute screen="${screen}" />`);
    },
  );

  it("the Explore tab reaches previews only through lazyGallery", () => {
    const specifiers = staticImportSpecifiers(read("app/(main)/(tabs)/index.tsx"));

    expect(specifiers).toContain("@/client/showcase/lazyGallery");
    expect(specifiers.filter(touchesCluster)).toEqual([]);
  });

  it("the gallery barrel exports every screen the routes name", () => {
    const barrel = read("client/showcase/gallery.tsx");

    for (const screen of new Set(Object.values(GALLERY_ROUTES))) {
      expect(barrel).toContain(`export { default as ${screen} } from "./${screen}"`);
    }
  });
});
