/**
 * Guardrails for the parameterized package-tooling scripts.
 *
 * `release-package.mjs`, `check-package-consumer.mjs`, and `fix-package-esm.mjs`
 * replaced six per-package copies. Each now takes the package name as its first
 * argument, supplied by the `scripts/run-package-script.mjs` table. These tests
 * pin that contract: a valid name resolves to the right package, and a
 * missing/unknown one fails loudly instead of silently targeting the wrong
 * package (or, worse, publishing it).
 *
 * Only the pre-mutation paths of the release script are exercised: every case
 * below exits before the version bump is written, so nothing here bumps a
 * version, touches bun.lock, or hits npm.
 */
import { execFileSync } from "child_process";
import { join } from "path";

const root = join(__dirname, "..", "..");

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
  ])("prints %s-specific usage naming %s", (pkg, dir) => {
    const result = release([pkg, "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`bun run ${pkg}:release --`);
    expect(result.stdout).toContain(`${dir}/package.json`);
    expect(result.stdout).toContain(`bun run ${pkg}:consumer-smoke`);
    expect(result.stdout).toContain("--allow-dirty");
  });

  it("does not leak the other package's aliases into usage", () => {
    expect(release(["ui", "--help"]).stdout).not.toContain("media:");
    expect(release(["media", "--help"]).stdout).not.toContain("ui:");
  });

  it("documents every gate it runs, in order", () => {
    const usage = release(["ui", "--help"]).stdout;
    const gates = ["ui:typecheck", "ui:test", "ui:build", "ui:pack", "ui:consumer-smoke"];
    const positions = gates.map((gate) => usage.indexOf(gate));

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
    expect(output(result)).toContain("media, ui");
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
    expect(output(result)).toContain('Invalid version bump "banana"');
  });

  it("rejects a version that is not greater than the current one", () => {
    const result = release(["media", "0.0.1", "--allow-dirty"]);

    expect(result.status).not.toBe(0);
    expect(output(result)).toContain("must be greater than current version");
  });
});

describe("check-package-consumer.mjs package argument", () => {
  it.each([[[]], [["nope"]]])("rejects %p before building anything", (args) => {
    const result = runScript("check-package-consumer.mjs", args);

    expect(result.status).toBe(1);
    expect(output(result)).toMatch(/unknown package/i);
    expect(output(result)).toContain("media, ui");
  });
});

describe("fix-package-esm.mjs package argument", () => {
  it.each([[[]], [["nope"]]])("rejects %p before touching any dist tree", (args) => {
    const result = runScript("fix-package-esm.mjs", args);

    expect(result.status).toBe(1);
    expect(output(result)).toMatch(/unknown package/i);
    expect(output(result)).toContain("media, ui");
  });
});
