/**
 * Web font guardrails for `app/+html.tsx`.
 *
 * Allo (the default sans), Inter (opt-in) and Newsreader (the serif preset)
 * are self-hosted from `public/fonts/` so that no third-party stylesheet
 * blocks first paint. What must keep holding:
 *   - every font file the document references exists in `public/` and is
 *     byte-identical to the file it was copied from: `@mrmeg/expo-ui`'s
 *     `fonts/allo/web/` for Allo, the pinned `@fontsource-variable/{inter,newsreader}`
 *     for the others (a regenerated cut or a package bump without re-copying
 *     fails here);
 *   - only Allo's Latin file is preloaded (Inter is not), as a CORS font preload so the
 *     browser reuses it for the @font-face fetch;
 *   - the @font-face rules sit inline in an element whose id is the one
 *     `@mrmeg/expo-ui`'s `useResources` checks, so the package never injects
 *     its fallback stylesheet on top (fonts loaded twice);
 *   - `font-display: optional`, which is what rules out a late swap (layout
 *     shift) when the font misses the first frame.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

import { alloWebFonts, getAlloFontFaceCss, sansStylesheetIds } from "@mrmeg/expo-ui/constants";

const root = join(__dirname, "..");
const html = readFileSync(join(root, "app/+html.tsx"), "utf8");

const referenced = Array.from(
  new Set(Array.from(html.matchAll(/\/fonts\/inter\/([\w.-]+\.woff2)/g), (match) => match[1])),
);

describe("self-hosted Allo (the default sans)", () => {
  const servedDir = join(root, "public/fonts/allo");
  const sourceDir = join(root, "packages/ui/src/fonts/allo");
  const files = [alloWebFonts.allo.latin, alloWebFonts.allo.ext];

  it("serves exactly the sharp cut's two files and the license", () => {
    expect(readdirSync(servedDir).sort()).toEqual(["LICENSE.txt", ...files].sort());
  });

  it.each(files)("serves %s from public/, unchanged from the package", (file) => {
    expect(readFileSync(join(servedDir, file)).equals(readFileSync(join(sourceDir, "web", file)))).toBe(true);
  });

  it("ships the font's license with the files, unchanged from the package", () => {
    expect(
      readFileSync(join(servedDir, "LICENSE.txt")).equals(readFileSync(join(sourceDir, "OFL.txt"))),
    ).toBe(true);
  });

  it("writes rules that point at the served files, never swapping the font in late", () => {
    const css = getAlloFontFaceCss("allo");

    for (const file of files) expect(css).toContain(`url(/fonts/allo/${file})`);
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).not.toMatch(/font-display:(?!optional)/);
    expect(html).toContain('const ALLO_FONT_FACES = getAlloFontFaceCss("allo");');
  });

  it("preloads only the Latin file, as a CORS font request", () => {
    expect(html.match(/rel="preload"/g)).toHaveLength(1);
    expect(html).toContain("const ALLO_PRELOAD_URL = `/fonts/allo/${alloWebFonts.allo.latin}`;");
    expect(html).toMatch(
      /rel="preload"\s+href=\{ALLO_PRELOAD_URL\}\s+as="font"\s+type="font\/woff2"\s+crossOrigin="anonymous"/,
    );
  });

  it("marks the fonts with the id @mrmeg/expo-ui checks before injecting its own", () => {
    expect(sansStylesheetIds.allo).toBe("mrmeg-expo-ui-allo");
    expect(html).toContain("<style id={sansStylesheetIds.allo}>{ALLO_FONT_FACES}</style>");
  });

  it("never loads a third-party font stylesheet", () => {
    expect(html).toContain("font-display:optional");
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/);
  });
});

describe("self-hosted Inter (opt-in classic sans)", () => {
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

  it("is not preloaded (only Allo, the default, is)", () => {
    expect(html).not.toContain("INTER_PRELOAD_URL");
    expect(html).not.toMatch(/href="\/fonts\/inter/);
  });

  it("marks the fonts with the id @mrmeg/expo-ui checks before injecting its own", () => {
    expect(sansStylesheetIds.inter).toBe("mrmeg-expo-ui-inter");
    expect(html).toContain(`<style id="${sansStylesheetIds.inter}">{INTER_FONT_FACES}</style>`);
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
