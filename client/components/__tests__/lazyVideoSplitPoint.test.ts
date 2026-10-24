/**
 * Single-split-point guard for `Video` (web bundle layout).
 *
 * Metro hoists any module reachable from two or more async chunks into the
 * eagerly loaded `__common` chunk. The media tab's `VideoPlayer` and the
 * showcase cluster (previews, Media Lab) are separate async chunks that both
 * play video, so a static import of `@mrmeg/expo-ui/components/Video` from both
 * would drag `expo-video`, the custom controls and the scrubber into the first
 * download of every route. Nothing at runtime catches that: it renders fine.
 * So both reach `Video` through `client/components/LazyVideo.tsx`, which holds
 * the one `import()`, and this test reads the sources to keep it that way.
 * `client/showcase/__tests__/gallerySplitPoint.test.ts` is the same idea for the
 * showcase cluster.
 */
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SPLIT_POINT = "client/components/LazyVideo.tsx";
const VIDEO = "@mrmeg/expo-ui/components/Video";
/** The media components that only `Video` should drag in. A second chunk reaching them re-hoists them. */
const VIDEO_ONLY = ["@mrmeg/expo-ui/components/MediaScrubber", "expo-video"];

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
const requires = (source: string, specifier: string) =>
  [...source.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]).filter((found) => found === specifier);

describe("Video split point", () => {
  it("LazyVideo holds the only import() of Video, and no static import of it", () => {
    const source = read(SPLIT_POINT);

    expect(dynamicImports(source)).toEqual([VIDEO]);
    expect(staticValueImports(source, VIDEO)).toEqual([]);
  });

  it("nothing else in app, client, server or shared imports Video as a value", () => {
    const offenders = sources()
      .filter((file) => file !== SPLIT_POINT)
      .filter((file) => {
        const source = read(file);
        return staticValueImports(source, VIDEO).length > 0 || requires(source, VIDEO).length > 0 || dynamicImports(source).includes(VIDEO);
      });

    expect(offenders).toEqual([]);
  });

  it("nothing outside the split point reaches the modules only Video needs", () => {
    const offenders = sources()
      .filter((file) => file !== SPLIT_POINT)
      .filter((file) => VIDEO_ONLY.some((specifier) => staticValueImports(read(file), specifier).length > 0));

    expect(offenders).toEqual([]);
  });

  it("the consumers use LazyVideo", () => {
    for (const consumer of [
      "client/features/media/components/VideoPlayer.tsx",
      "client/showcase/previews.tsx",
      "client/showcase/MediaLabVideo.tsx",
    ]) {
      expect(staticValueImports(read(consumer), "@/client/components/LazyVideo")).toEqual(["@/client/components/LazyVideo"]);
    }
  });
});
