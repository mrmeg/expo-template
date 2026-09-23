/**
 * The publish-drift gate (`bun run packages:drift-check`) against a local fake
 * registry: a package version already on npm must ship the manifest it has
 * locally, compared on dependencies, peers, peer meta, exports, and files.
 *
 * Each case builds a throwaway repo root holding the four workspace package
 * manifests, and a registry that serves packuments and real gzipped tarballs,
 * so the script reads the published manifest the way it does from npm.
 */
import { execFile } from "child_process";
import { createHash } from "crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { gzipSync } from "zlib";

const root = join(__dirname, "..", "..");
const execFileAsync = promisify(execFile);

type Manifest = Record<string, unknown> & { name: string; version: string };

/** A one-file ustar archive, gzipped: what `npm pack` would upload. */
function tarball(manifest: Manifest): Buffer {
  const body = Buffer.from(JSON.stringify(manifest, null, 2));
  const header = Buffer.alloc(512, 0);
  const write = (value: string, offset: number) => header.write(value, offset, "utf8");
  write("package/package.json", 0);
  write("0000644\0", 100);
  write("0000000\0", 108);
  write("0000000\0", 116);
  write(`${body.length.toString(8).padStart(11, "0")}\0`, 124);
  write("00000000000\0", 136);
  write("        ", 148);
  write("0", 156);
  write("ustar\0", 257);
  write("00", 263);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512, 0);
  return gzipSync(Buffer.concat([header, body, padding, Buffer.alloc(1024, 0)]));
}

const BASE: Record<string, Manifest> = {
  ui: {
    name: "@fixture/ui",
    version: "1.0.0",
    dependencies: { a: "^1.0.0", b: "^2.0.0" },
    peerDependencies: { react: ">=19" },
    exports: {
      ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      "./components/*": { types: "./dist/components/*.d.ts", default: "./dist/components/*.js" },
    },
    files: ["dist", "README.md"],
  },
  media: {
    name: "@fixture/media",
    version: "2.0.0",
    peerDependencies: { expo: ">=55.0.0 <58.0.0" },
    peerDependenciesMeta: { expo: { optional: true } },
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    files: ["dist"],
  },
  purchases: { name: "@fixture/purchases", version: "0.1.0", files: ["dist"] },
  lint: { name: "@fixture/lint", version: "0.2.0", files: ["index.js"] },
};

interface Published {
  /** name -> version -> manifest npm has; a name missing here is a 404. */
  [name: string]: Record<string, Manifest>;
}

let server: Server;
let registry: string;
let published: Published = {};
const tempRoots: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://registry");
    const tarballMatch = /^\/-\/(.+)\/(\d+\.\d+\.\d+)\.tgz$/.exec(url.pathname);
    if (tarballMatch) {
      const manifest = published[decodeURIComponent(tarballMatch[1])]?.[tarballMatch[2]];
      if (!manifest) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.end(tarball(manifest));
      return;
    }

    const name = decodeURIComponent(url.pathname.slice(1));
    const versions = published[name];
    if (!versions) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        name,
        versions: Object.fromEntries(
          Object.entries(versions).map(([version, manifest]) => [
            version,
            {
              ...manifest,
              dist: {
                tarball: `${registry}-/${encodeURIComponent(name)}/${version}.tgz`,
                integrity: `sha512-${createHash("sha512").update(tarball(manifest)).digest("base64")}`,
              },
            },
          ]),
        ),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

/** A repo root whose packages/<key>/package.json are `BASE` with `overrides` applied. */
function repoRoot(overrides: Partial<Record<string, Partial<Manifest>>> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "drift-root-"));
  tempRoots.push(dir);
  for (const [key, manifest] of Object.entries(BASE)) {
    mkdirSync(join(dir, "packages", key), { recursive: true });
    writeFileSync(
      join(dir, "packages", key, "package.json"),
      JSON.stringify({ ...manifest, ...overrides[key] }, null, 2),
    );
  }
  return dir;
}

async function drift(args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", ["scripts/check-package-publish-drift.mjs", ...args], {
      cwd: root,
      env: { ...process.env, CI: "", ...env },
    });
    return { status: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { status: failure.code ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

/** npm has ui and media at their base versions; purchases never; lint only an older version. */
function publishBase() {
  published = {
    "@fixture/ui": { "1.0.0": BASE.ui },
    "@fixture/media": { "2.0.0": BASE.media },
    "@fixture/lint": { "0.1.0": { ...BASE.lint, version: "0.1.0" } },
  };
}

describe("packages:drift-check", () => {
  beforeEach(publishBase);

  it("passes when every published version matches, and skips what npm does not have", async () => {
    const result = await drift(["--root", repoRoot(), "--registry", registry]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("ok @fixture/ui@1.0.0 matches npm");
    expect(result.output).toContain("ok @fixture/media@2.0.0 matches npm");
    expect(result.output).toContain("skip @fixture/purchases is not on npm yet");
    expect(result.output).toContain("skip @fixture/lint@0.2.0 is not on npm yet (unreleased version)");
  });

  it("fails when a published version's peers changed without a bump, naming the keys", async () => {
    const result = await drift([
      "--root",
      repoRoot({ media: { peerDependencies: { expo: ">=55.0.0 <59.0.0" } } }),
      "--registry",
      registry,
    ]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("FAIL @fixture/media@2.0.0 is already on npm, but the local peerDependencies differ");
    expect(result.output).toContain("peerDependencies.expo: npm \">=55.0.0 <58.0.0\", local \">=55.0.0 <59.0.0\"");
    expect(result.output).toContain("bun run pkg media release -- --patch");
    expect(result.output).toContain("ok @fixture/ui@1.0.0 matches npm");
  });

  it.each([
    ["dependencies", { dependencies: { a: "^1.0.0" } }],
    ["peerDependenciesMeta", { peerDependenciesMeta: { react: { optional: true } } }],
    ["files", { files: ["dist", "README.md", "CHANGELOG.md"] }],
    [
      "exports",
      { exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" }, "./server": "./dist/server.js" } },
    ],
  ])("fails on a %s change", async (field, override) => {
    const result = await drift(["ui", "--root", repoRoot({ ui: override }), "--registry", registry]);

    expect(result.status).toBe(1);
    expect(result.output).toContain(`the local ${field} differ`);
  });

  it("ignores key order in dependency maps, files, and export subpaths, but not export conditions", async () => {
    const reordered = {
      dependencies: { b: "^2.0.0", a: "^1.0.0" },
      files: ["README.md", "dist"],
      exports: {
        "./components/*": { types: "./dist/components/*.d.ts", default: "./dist/components/*.js" },
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      },
    };
    expect((await drift(["ui", "--root", repoRoot({ ui: reordered }), "--registry", registry])).status).toBe(0);

    const conditionsSwapped = {
      exports: {
        ".": { default: "./dist/index.js", types: "./dist/index.d.ts" },
        "./components/*": { types: "./dist/components/*.d.ts", default: "./dist/components/*.js" },
      },
    };
    const result = await drift(["ui", "--root", repoRoot({ ui: conditionsSwapped }), "--registry", registry]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("the local exports differ");
  });

  it("skips private packages", async () => {
    const result = await drift([
      "media",
      "--root",
      repoRoot({ media: { private: true, peerDependencies: { expo: "*" } } }),
      "--registry",
      registry,
    ]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("skip @fixture/media is private");
  });

  describe("with the registry unreachable", () => {
    let deadRegistry: string;

    beforeAll(async () => {
      // A port that was just free and is closed again: connection refused.
      const probe = createServer();
      await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
      const { port } = probe.address() as AddressInfo;
      await new Promise((resolve) => probe.close(resolve));
      deadRegistry = `http://127.0.0.1:${port}/`;
    });

    it("warns and passes locally", async () => {
      const result = await drift(["ui", "--root", repoRoot(), "--registry", deadRegistry]);

      expect(result.status).toBe(0);
      expect(result.output).toContain("WARN ui: registry unreachable, drift not checked");
    });

    it("fails in CI", async () => {
      const result = await drift(["ui", "--root", repoRoot(), "--registry", deadRegistry], { CI: "true" });

      expect(result.status).toBe(1);
      expect(result.output).toContain("FAIL ui: registry unreachable, and CI cannot skip this gate");
    });
  });

  it("rejects an unknown package", async () => {
    const result = await drift(["nope", "--root", repoRoot(), "--registry", registry]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("unknown package or option \"nope\"");
  });
});
