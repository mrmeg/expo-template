/**
 * Source-level guardrails for the web SSR hydration path.
 *
 * Why this file exists
 * -------------------
 * The server-rendered HTML shell paints correctly only while four invariants
 * hold, and every one of them lives in a comment rather than a type:
 *
 * 1. `app/+html.tsx` drops the framework's `<style id="react-native-stylesheet">`
 *    snapshot from `headNodes` and renders one EMPTY element with that id, after
 *    the remaining head nodes and before any script, for react-native-web to
 *    adopt as its client sheet.
 * 2. `SsrStyleFlush` is the LAST child of the root layout, so it serializes the
 *    complete sheet after the whole subtree has rendered.
 * 3. The flushed atomics carry two-class specificity so react-native-web's
 *    client-sheet resets cannot outrank them while an async route chunk is
 *    still downloading.
 * 4. `@expo/router-server` is patched so bootstrap chunks execute in order
 *    instead of racing as `<script async>`; the patch is pinned to the installed
 *    version and must be re-created when that version changes.
 *
 * Each is a plausible "simplification" for a later edit, and each fails
 * silently: the page still renders, just wrong for the first few hundred
 * milliseconds. Cheap source checks catch that before a browser has to.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { hardenFlushedSheet } from "@/client/features/app/SsrStyleFlush";

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("app/+html.tsx adopts the client sheet deliberately", () => {
  const html = read("app/+html.tsx");
  const ANCHOR = '<style id="react-native-stylesheet" />';

  it("filters the framework's react-native-stylesheet snapshot out of headNodes", () => {
    expect(html).toMatch(/props\.id === "react-native-stylesheet"/);
    expect(html).toContain("{filteredHeadNodes}");
    // Rendering the raw list would reintroduce the incomplete snapshot and a
    // duplicate id, so RNW's getElementById could adopt the wrong node.
    expect(html).not.toContain("{headNodes}");
  });

  it("renders exactly one empty anchor for react-native-web to adopt", () => {
    expect(html.match(/<style id="react-native-stylesheet"/g)).toHaveLength(1);
    // Must stay empty: RNW hydrates group records from the element's rules and
    // throws on any rule without a preceding [stylesheet-group] marker.
    expect(html).toContain(ANCHOR);
  });

  it("orders the head: filtered nodes, then the anchor, then scripts", () => {
    const filtered = html.indexOf("{filteredHeadNodes}");
    const anchor = html.indexOf(ANCHOR);
    const firstScript = html.indexOf("<script>");

    expect(filtered).toBeGreaterThan(-1);
    expect(anchor).toBeGreaterThan(filtered);
    expect(firstScript).toBeGreaterThan(anchor);
  });
});

describe("RootLayout renders SsrStyleFlush last", () => {
  it("has nothing but closing tags after <SsrStyleFlush />", () => {
    const layout = read("client/features/app/RootLayout.tsx");
    const marker = "<SsrStyleFlush />";
    const at = layout.lastIndexOf(marker);
    expect(at).toBeGreaterThan(-1);

    const end = layout.indexOf(");", at);
    const tail = layout
      .slice(at + marker.length, end)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // JSX comments
      .replace(/<\/[\w.]+>/g, "") // closing tags
      .trim();

    expect(tail).toBe("");
  });
});

describe("hardenFlushedSheet", () => {
  it("doubles atomic selectors so they outrank single-class client resets", () => {
    expect(hardenFlushedSheet(".r-1udh08x{padding:8px;}")).toBe(".r-1udh08x.r-1udh08x{padding:8px;}");
  });

  it("keeps pseudo-element and child suffixes attached to the doubled selector", () => {
    expect(hardenFlushedSheet(".r-633pao>*{flex:1;}")).toBe(".r-633pao.r-633pao>*{flex:1;}");
    expect(hardenFlushedSheet(".r-6taxm2::placeholder{color:red;}")).toBe(
      ".r-6taxm2.r-6taxm2::placeholder{color:red;}"
    );
  });

  it("leaves resets, markers, element rules, and keyframes at their specificity", () => {
    const sheet = [
      '[stylesheet-group="0"]{}',
      "body{margin:0;}",
      "button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}",
      '[stylesheet-group="1"]{}',
      ".css-g5y9jx{padding:0px;margin:0px;}",
      "@-webkit-keyframes r-11cv4x{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}",
    ].join("\n");

    // Classic resets in particular must stay single-class: the client sheet's
    // atomics beat them by order, and doubling would flip that.
    expect(hardenFlushedSheet(sheet)).toBe(sheet);
  });

  it("only rewrites selectors at the start of a line", () => {
    const sheet = ".css-g5y9jx{padding:0px;}\n.r-1udh08x{padding:8px;}\n.r-abc{color:.r-not-a-selector;}";
    expect(hardenFlushedSheet(sheet)).toBe(
      ".css-g5y9jx{padding:0px;}\n.r-1udh08x.r-1udh08x{padding:8px;}\n.r-abc.r-abc{color:.r-not-a-selector;}"
    );
  });
});

describe("@expo/router-server bootstrap-order patch", () => {
  const pkg = JSON.parse(read("package.json")) as { patchedDependencies?: Record<string, string> };
  const installed = JSON.parse(read("node_modules/@expo/router-server/package.json")) as { version: string };
  const key = `@expo/router-server@${installed.version}`;

  it(`is pinned to the installed version (${installed.version})`, () => {
    // A version bump without `bun patch` silently drops the patch: bun only
    // applies it to the exact version in the key.
    const patchPath = pkg.patchedDependencies?.[key];
    expect(patchPath).toBeDefined();
    expect(existsSync(join(root, patchPath as string))).toBe(true);
  });

  it("is applied to the installed streaming renderer", () => {
    const renderer = read("node_modules/@expo/router-server/build/server/renderStreamingContent.js");
    expect(renderer).toContain("getOrderedBootstrapScriptContents");
    // The async race comes back the moment React is handed the chunk list.
    expect(renderer).not.toMatch(/bootstrapScripts:\s*options\?\.assets\?\.js/);
  });
});
