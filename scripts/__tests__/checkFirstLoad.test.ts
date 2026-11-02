import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { measureChunks, scriptSources } from "../check-first-load";

describe("scriptSources", () => {
  it("lists same-origin script URLs once, in document order, and skips inline and external ones", () => {
    const html = [
      '<link rel="preload" href="/_expo/static/js/web/preloaded.js" as="script"/>',
      '<script defer="" src="/_expo/static/js/web/entry.js"></script>',
      "<script>inline()</script>",
      '<script src="https://cdn.example.com/x.js"></script>',
      '<script defer src="/_expo/static/js/web/route.js"></script>',
      '<script src="/_expo/static/js/web/entry.js"></script>',
    ].join("");

    expect(scriptSources(html)).toEqual(["/_expo/static/js/web/entry.js", "/_expo/static/js/web/route.js"]);
  });
});

describe("measureChunks", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "first-load-"));
    mkdirSync(path.join(dir, "js"));
    writeFileSync(path.join(dir, "js/a.js"), "0123456789");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the raw size and the brotli sibling", () => {
    writeFileSync(path.join(dir, "js/a.js.br"), "012");

    expect(measureChunks(dir, ["/js/a.js"])).toEqual([{ src: "/js/a.js", raw: 10, brotli: 3 }]);
  });

  it("counts a file too small to precompress at its raw size", () => {
    expect(measureChunks(dir, ["/js/a.js"])).toEqual([{ src: "/js/a.js", raw: 10, brotli: 10 }]);
  });

  it("fails loudly when the export was not precompressed", () => {
    writeFileSync(path.join(dir, "js/big.js"), "x".repeat(2048));

    expect(() => measureChunks(dir, ["/js/big.js"])).toThrow("bun run build");
  });
});
