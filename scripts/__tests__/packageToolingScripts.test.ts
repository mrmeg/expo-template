/**
 * Guardrails for the parameterized package-tooling scripts.
 *
 * `release-package.mjs`, `check-package-consumer.mjs`, and `fix-package-esm.mjs`
 * each take the package name as their first argument, supplied by the
 * `scripts/run-package-script.mjs` table. These tests pin that contract: a valid
 * name resolves to the right package, and a missing/unknown one fails loudly
 * instead of silently targeting the wrong package (or, worse, publishing it).
 *
 * Only the pre-mutation paths of the release script are exercised: every case
 * below exits before the version bump is written, so nothing here bumps a
 * version, touches bun.lock, or hits npm (a local fake registry answers the
 * "already published?" question where one is needed).
 */
import { execFile, execFileSync } from "child_process";
import { readFileSync } from "fs";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { join } from "path";
import { promisify } from "util";

const root = join(__dirname, "..", "..");
const execFileAsync = promisify(execFile);

function runScript(script: string, args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", [`scripts/${script}`, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

const release = (args: string[]) => runScript("release-package.mjs", args);
const output = (result: { stdout: string; stderr: string }) => `${result.stdout}${result.stderr}`;

describe("release-package.mjs package argument", () => {
  it.each([
    ["ui", "packages/ui"],
    ["media", "packages/media"],
    ["purchases", "packages/purchases"],
    ["lint", "packages/lint"],
  ])("prints %s-specific usage naming %s", (pkg, dir) => {
    const result = release([pkg, "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`bun run pkg ${pkg} release --`);
    expect(result.stdout).toContain(`${dir}/package.json`);
    expect(result.stdout).toContain(`bun run pkg ${pkg} consumer-smoke -- --tarball`);
    expect(result.stdout).toContain("--allow-dirty");
    expect(result.stdout).toContain("--pack-destination");
  });

  it("does not leak the other packages' commands into usage", () => {
    expect(release(["ui", "--help"]).stdout).not.toContain("pkg media");
    expect(release(["ui", "--help"]).stdout).not.toContain("pkg lint");
    expect(release(["media", "--help"]).stdout).not.toContain("pkg ui");
    expect(release(["lint", "--help"]).stdout).not.toContain("pkg media");
  });

  it("documents every step it runs, in order: gates, one pack, the smoke of that tarball", () => {
    const usage = release(["ui", "--help"]).stdout;
    const steps = [
      "bun run packages:peer-check",
      "bun run pkg ui typecheck",
      "bun run pkg ui test",
      "bun run pkg ui build",
      "bun pm pack",
      "bun run pkg ui consumer-smoke -- --tarball",
      "npm publish <that tarball>",
    ];
    const positions = steps.map((step) => usage.indexOf(step));

    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("rejects a missing package name", () => {
    const result = release([]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toMatch(/Unknown package/i);
  });

  it("rejects an unknown package name and lists the valid ones", () => {
    const result = release(["nope", "--patch"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toMatch(/Unknown package "nope"/i);
    expect(output(result)).toContain("lint, media, purchases, ui");
  });

  it("treats a leading flag as a missing package instead of releasing a default", () => {
    const result = release(["--patch", "--publish"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toMatch(/Unknown package "--patch"/i);
  });
});

describe("release-package.mjs version argument parsing", () => {
  it("rejects two version arguments", () => {
    const result = release(["ui", "1.2.3", "2.0.0"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("Expected at most one version argument");
  });

  it("rejects two bump flags", () => {
    const result = release(["ui", "--patch", "--minor"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("Use only one version bump");
  });

  it("rejects a bump flag combined with an explicit version", () => {
    const result = release(["media", "--patch", "1.2.3"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("Use only one version bump");
  });

  it("rejects a bump that is neither a release type nor a version", () => {
    const result = release(["ui", "banana", "--allow-dirty"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("Invalid version bump \"banana\"");
  });

  it("rejects a version that is not greater than the current one", () => {
    const result = release(["media", "0.0.1", "--allow-dirty"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("must be greater than current version");
  });

  it("rejects an unknown option instead of ignoring it", () => {
    const result = release(["ui", "--patch", "--publsh"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("Unknown option \"--publsh\"");
  });

  describe("against a registry", () => {
    let server: Server;
    let registry: string;
    const current = JSON.parse(readFileSync(join(root, "packages/media/package.json"), "utf8")) as {
      name: string;
      version: string;
    };

    beforeAll(async () => {
      // Whatever is asked for, the registry "has" exactly the committed media version.
      server = createServer((_request, response) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ name: current.name, versions: { [current.version]: { dist: {} } } }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    async function releaseAsync(args: string[]) {
      try {
        const { stdout, stderr } = await execFileAsync("node", ["scripts/release-package.mjs", ...args], { cwd: root });
        return { status: 0, stdout, stderr };
      } catch (error) {
        const failure = error as { code?: number; stdout?: string; stderr?: string };
        return { status: failure.code ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
      }
    }

    it("accepts the committed version as a no-bump release, and refuses it once npm has it", async () => {
      // Past "must be greater than current": the exact committed version means
      // "release as is". The fake registry says it is published, so the script
      // stops before any gate or write.
      const result = await releaseAsync(["media", current.version, "--allow-dirty", "--registry", registry]);

      expect(result.status).not.toBe(0);
      expect(output(result)).not.toContain("must be greater");
      expect(output(result)).toContain(`${current.name}@${current.version} is already published.`);
    });
  });
});

describe("check-package-consumer.mjs arguments", () => {
  it.each([[[]], [["nope"]]])("rejects %p before building anything", (args) => {
    const result = runScript("check-package-consumer.mjs", args);

    expect(result.status).toBe(1);
    expect(output(result)).toMatch(/unknown package/i);
    expect(output(result)).toContain("lint, media, purchases, ui");
  });

  it("rejects a --tarball that does not exist before building anything", () => {
    const result = runScript("check-package-consumer.mjs", ["ui", "--tarball", "/nonexistent/ui.tgz"]);

    expect(result.status).toBe(1);
    expect(output(result)).toContain("no tarball at /nonexistent/ui.tgz");
  });

  it("rejects an unknown argument", () => {
    const result = runScript("check-package-consumer.mjs", ["ui", "--fast"]);

    expect(result.status).toBe(1);
    expect(output(result)).toContain("unexpected argument \"--fast\"");
  });
});

describe("fix-package-esm.mjs package argument", () => {
  // `media, purchases, ui`: the lint plugin ships unbuilt CommonJS, so it has no
  // dist tree to rewrite and is deliberately not registered there.
  it.each([[[]], [["nope"]]])("rejects %p before touching any dist tree", (args) => {
    const result = runScript("fix-package-esm.mjs", args);

    expect(result.status).toBe(1);
    expect(output(result)).toMatch(/unknown package/i);
    expect(output(result)).toContain("media, purchases, ui");
  });
});
