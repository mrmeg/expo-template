/**
 * Web font guardrails for `app/+html.tsx`.
 *
 * Inter is self-hosted from `public/fonts/inter/` so that no third-party
 * stylesheet blocks first paint. What must keep holding:
 *   - every font file the document references exists in `public/` and is
 *     byte-identical to the pinned `@fontsource-variable/inter` file it was
 *     copied from (a package bump without re-copying fails here);
 *   - only the Latin subset is preloaded, as a CORS font preload so the
 *     browser reuses it for the @font-face fetch;
 *   - the @font-face rules sit inline in an element whose id is the one
 *     `@mrmeg/expo-ui`'s `useResources` checks, so the package never injects
 *     its Google Fonts stylesheet on top (fonts loaded twice);
 *   - `font-display: optional`, which is what rules out a late swap (layout
 *     shift) when the font misses the first frame.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
const html = readFileSync(join(root, "app/+html.tsx"), "utf8");

const referenced = Array.from(
  new Set(Array.from(html.matchAll(/\/fonts\/inter\/([\w.-]+\.woff2)/g), (match) => match[1])),
);

describe("self-hosted Inter", () => {
  it("references the seven unicode-range subsets", () => {
    expect(referenced.sort()).toEqual([
      "inter-cyrillic-ext-wght-normal.woff2",
      "inter-cyrillic-wght-normal.woff2",
      "inter-greek-ext-wght-normal.woff2",
      "inter-greek-wght-normal.woff2",
      "inter-latin-ext-wght-normal.woff2",
      "inter-latin-wght-normal.woff2",
      "inter-vietnamese-wght-normal.woff2",
    ]);
  });

  it.each(referenced)("serves %s from public/, unchanged from the package", (file) => {
    const served = join(root, "public/fonts/inter", file);
    const source = join(root, "node_modules/@fontsource-variable/inter/files", file);

    expect(existsSync(served)).toBe(true);
    expect(readFileSync(served).equals(readFileSync(source))).toBe(true);
  });

  it("ships the font's license with the files", () => {
    expect(existsSync(join(root, "public/fonts/inter/LICENSE.txt"))).toBe(true);
  });

  it("preloads only the Latin subset, as a CORS font request", () => {
    expect(html.match(/rel="preload"/g)).toHaveLength(1);
    expect(html).toContain('const INTER_PRELOAD_URL = "/fonts/inter/inter-latin-wght-normal.woff2";');
    expect(html).toMatch(
      /rel="preload"\s+href=\{INTER_PRELOAD_URL\}\s+as="font"\s+type="font\/woff2"\s+crossOrigin="anonymous"/,
    );
  });

  it("marks the fonts with the id @mrmeg/expo-ui checks before injecting its own", () => {
    const useResources = readFileSync(join(root, "packages/ui/src/hooks/useResources.ts"), "utf8");
    const packageId = useResources.match(/INTER_STYLESHEET_ID = "([^"]+)"/)?.[1];

    expect(packageId).toBe("mrmeg-expo-ui-inter");
    expect(html).toContain(`<style id="${packageId}">{INTER_FONT_FACES}</style>`);
  });

  it("never swaps the font in late and never loads the Google Fonts stylesheet", () => {
    expect(html).toContain("font-display:optional");
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});

const referencedNewsreader = Array.from(
  new Set(Array.from(html.matchAll(/\/fonts\/newsreader\/([\w.-]+\.woff2)/g), (match) => match[1])),
);

describe("self-hosted Newsreader (the kit's serif preset)", () => {
  it("references the three subsets, upright and italic", () => {
    expect(referencedNewsreader.sort()).toEqual([
      "newsreader-latin-ext-wght-italic.woff2",
      "newsreader-latin-ext-wght-normal.woff2",
      "newsreader-latin-wght-italic.woff2",
      "newsreader-latin-wght-normal.woff2",
      "newsreader-vietnamese-wght-italic.woff2",
      "newsreader-vietnamese-wght-normal.woff2",
    ]);
  });

  it.each(referencedNewsreader)("serves %s from public/, unchanged from the package", (file) => {
    const served = join(root, "public/fonts/newsreader", file);
    const source = join(root, "node_modules/@fontsource-variable/newsreader/files", file);

    expect(existsSync(served)).toBe(true);
    expect(readFileSync(served).equals(readFileSync(source))).toBe(true);
  });

  it("ships the font's license with the files", () => {
    expect(existsSync(join(root, "public/fonts/newsreader/LICENSE.txt"))).toBe(true);
  });

  it("marks the faces with the id @mrmeg/expo-ui checks before injecting its own", () => {
    const useResources = readFileSync(join(root, "packages/ui/src/hooks/useResources.ts"), "utf8");
    const packageId = useResources.match(/NEWSREADER_STYLESHEET_ID = "([^"]+)"/)?.[1];

    expect(packageId).toBe("mrmeg-expo-ui-newsreader");
    expect(html).toContain(`<style id="${packageId}">{NEWSREADER_FONT_FACES}</style>`);
    expect(html).toContain('font-family:"Newsreader";font-style:${style}');
  });
});
