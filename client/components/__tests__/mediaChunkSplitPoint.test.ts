/**
 * Single-split-point guard for the kit's media components (web bundle layout).
 *
 * Metro hoists any module reachable from two or more async chunks into the
 * eagerly loaded `__common` chunk. `Video` and `MediaViewer` (which draws a
 * `Video` for each video page) are reached from the media tab and from the
 * showcase cluster, which are separate async chunks. Giving each its own
 * `import()` target does not help: the two chunks would share `Video`, and
 * `expo-video`, the custom controls and the scrubber would be hoisted into the
 * first download of every route. Nothing at runtime catches that: it renders
 * fine. So the app reaches both through one module, `mediaChunk.ts`, which only
 * `LazyVideo` and `LazyMediaViewer` import, and this test reads the sources to
 * keep it that way. `client/showcase/__tests__/gallerySplitPoint.test.ts` is the
 * same idea for the showcase cluster.
 */
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CHUNK = "client/components/mediaChunk.ts";
const CHUNK_SPECIFIER = "@/client/components/mediaChunk";
const LAZY_WRAPPERS = ["client/components/LazyVideo.tsx", "client/components/LazyMediaViewer.tsx"];
const VIDEO = "@mrmeg/expo-ui/components/Video";
const VIEWER = "@mrmeg/expo-ui/components/MediaViewer";
/** What only `Video` and the viewer should drag in. A second chunk reaching them re-hoists them. */
const MEDIA_ONLY = [VIDEO, VIEWER, "@mrmeg/expo-ui/components/MediaScrubber", "expo-video"];

const SOURCE_TREES = ["app", "client", "server", "shared"];

const read = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const sources = () =>
  SOURCE_TREES.flatMap((tree) => walkSources(path.join(REPO_ROOT, tree))).map((file) => path.relative(REPO_ROOT, file));

/** Value imports and re-exports of `specifier`: `import type` is erased and does not create a chunk edge. */
const staticValueImports = (source: string, specifier: string) =>
  [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((found) => found === specifier || found.startsWith(`${specifier}/`));

const dynamicImports = (source: string) => [...source.matchAll(/import\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
const requires = (source: string) => [...source.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);

/** Every way a file can load `specifier` at runtime (static, dynamic, `require`). */
const loads = (source: string, specifier: string) =>
  staticValueImports(source, specifier).length > 0 ||
  dynamicImports(source).some((found) => found === specifier || found.startsWith(`${specifier}/`)) ||
  requires(source).some((found) => found === specifier || found.startsWith(`${specifier}/`));

describe("media components split point", () => {
  it("mediaChunk re-exports Video and MediaViewer, and nothing else", () => {
    const source = read(CHUNK);

    expect(staticValueImports(source, VIDEO)).toEqual([VIDEO]);
    expect(staticValueImports(source, VIEWER)).toEqual([VIEWER]);
    expect(source.match(/(?:^|\n)\s*(?:import|export)\s[^;]*from\s+"[^"]+"/g)).toHaveLength(2);
    expect(dynamicImports(source)).toEqual([]);
  });

  it("each lazy wrapper holds one import() of the chunk, and no static import of it or of the components", () => {
    for (const wrapper of LAZY_WRAPPERS) {
      const source = read(wrapper);

      expect(dynamicImports(source)).toEqual([CHUNK_SPECIFIER]);
      expect(staticValueImports(source, CHUNK_SPECIFIER)).toEqual([]);
      for (const specifier of MEDIA_ONLY) expect(staticValueImports(source, specifier)).toEqual([]);
    }
  });

  it("only the lazy wrappers load the chunk", () => {
    const offenders = sources()
      .filter((file) => file !== CHUNK && !LAZY_WRAPPERS.includes(file))
      .filter((file) => loads(read(file), CHUNK_SPECIFIER) || /["'](?:\.\.?\/)+(?:components\/)?mediaChunk["']/.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("nothing in app, client, server or shared loads Video, MediaViewer, the scrubber or expo-video as a value", () => {
    const offenders = sources()
      .filter((file) => file !== CHUNK)
      .filter((file) => MEDIA_ONLY.some((specifier) => loads(read(file), specifier)));

    expect(offenders).toEqual([]);
  });

  it("the consumers use the lazy wrappers", () => {
    for (const consumer of ["client/showcase/previews.tsx", "client/showcase/MediaLabVideo.tsx"]) {
      expect(staticValueImports(read(consumer), "@/client/components/LazyVideo")).toEqual(["@/client/components/LazyVideo"]);
    }
    for (const consumer of [
      "app/(main)/(tabs)/media.tsx",
      "client/showcase/previews.tsx",
      "client/showcase/MediaLabViewer.tsx",
    ]) {
      expect(staticValueImports(read(consumer), "@/client/components/LazyMediaViewer")).toEqual([
        "@/client/components/LazyMediaViewer",
      ]);
    }
  });
});
