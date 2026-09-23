/**
 * @jest-environment node
 */

/**
 * `scripts/precompress.mjs` — the build step that writes the `.br` / `.gz`
 * siblings `server/http/staticFiles.ts` serves. Runs the real script, the
 * way `bun run build` does, against a fixture export.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

const SCRIPT = path.resolve(__dirname, "../../../scripts/precompress.mjs");

let clientDir: string;

function write(relative: string, contents: string | Uint8Array): void {
  const filePath = path.join(clientDir, relative);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function has(relative: string): boolean {
  return existsSync(path.join(clientDir, relative));
}

function noise(bytes: number): Uint8Array {
  // Deterministic but incompressible enough that neither encoding wins.
  let state = 0x9e3779b9;
  return new Uint8Array(bytes).map(() => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state & 0xff;
  });
}

const JS = "export const answer = () => 42; // padding padding padding\n".repeat(200);

beforeEach(() => {
  clientDir = mkdtempSync(path.join(tmpdir(), "precompress-"));
  write("_expo/static/js/web/entry-abc.js", JS);
  write("_expo/static/css/app-abc.css", ".row{display:flex;gap:8px}\n".repeat(200));
  write("_expo/static/js/web/entry-abc.js.map", JSON.stringify({ mappings: "A".repeat(4_096) }));
  write("_expo/static/js/web/tiny-abc.js", "console.log(1);");
  write("assets/fonts/Inter.abc.ttf", "glyf".repeat(2_048));
  write("assets/images/logo.abc.png", noise(4_096));
  write("assets/data/noise.abc.wasm", noise(4_096));
  write("favicon.ico", "\0\0\u0001\0".repeat(1_024));
});

afterEach(() => {
  rmSync(clientDir, { recursive: true, force: true });
});

function run(): string {
  return execFileSync(process.execPath, [SCRIPT, clientDir], { encoding: "utf8" });
}

describe("scripts/precompress.mjs", () => {
  it("writes brotli and gzip siblings that decode to the original", () => {
    const output = run();

    for (const file of ["_expo/static/js/web/entry-abc.js", "_expo/static/css/app-abc.css", "assets/fonts/Inter.abc.ttf"]) {
      const original = readFileSync(path.join(clientDir, file));
      expect(brotliDecompressSync(readFileSync(path.join(clientDir, `${file}.br`))).equals(original)).toBe(true);
      expect(gunzipSync(readFileSync(path.join(clientDir, `${file}.gz`))).equals(original)).toBe(true);
    }
    expect(output).toMatch(/^precompress: 3 files under /);
  });

  it("skips source maps, tiny files, incompressible formats, and unhashed directories", () => {
    run();
    for (const file of [
      "_expo/static/js/web/entry-abc.js.map",
      "_expo/static/js/web/tiny-abc.js",
      "assets/images/logo.abc.png",
      "favicon.ico",
    ]) {
      expect(has(`${file}.br`)).toBe(false);
      expect(has(`${file}.gz`)).toBe(false);
    }
  });

  it("writes no sibling that would not be smaller, and removes a stale one", () => {
    write("assets/data/noise.abc.wasm.br", "stale");
    run();
    expect(has("assets/data/noise.abc.wasm.br")).toBe(false);
    expect(has("assets/data/noise.abc.wasm.gz")).toBe(false);
  });

  it("is safe to run twice", () => {
    run();
    const first = readFileSync(path.join(clientDir, "_expo/static/js/web/entry-abc.js.br"));
    const output = run();
    expect(readFileSync(path.join(clientDir, "_expo/static/js/web/entry-abc.js.br")).equals(first)).toBe(true);
    expect(has("_expo/static/js/web/entry-abc.js.br.br")).toBe(false);
    expect(output).toMatch(/^precompress: 3 files/);
  });

  it("fails when the export directory is missing", () => {
    const result = spawnSync(process.execPath, [SCRIPT, path.join(clientDir, "nope")], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not a directory");
  });
});
