/**
 * Guardrails for the generic workspace-package script runner.
 *
 * `scripts/run-package-script.mjs` replaces twelve copy-pasted `ui:*`/`media:*`
 * scripts with one table, so adding a third workspace package is a one-line
 * change instead of six more scripts. The twelve aliases stay because they are
 * load-bearing: `scripts/release-package.mjs` shells out to them,
 * `.github/workflows/publish-{ui,media}.yml` run them as steps, and the
 * published package READMEs document them.
 *
 * These tests pin the resolved command for every (package, task) pair against
 * the exact commands the aliases ran before the refactor. If the runner's table
 * drifts, a publish workflow silently starts running the wrong thing.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

/** Resolve a runner invocation without executing the underlying command. */
function resolve(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", ["scripts/run-package-script.mjs", ...args], {
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

const print = (args: string[]) => resolve(["--print", ...args]).stdout.trim();

/** Every `<package>:<task>` root alias mentioned in a file or command output. */
function aliasesIn(source: string): string[] {
  return [...source.matchAll(/\b(ui|media):([a-z-]+(?::[a-z-]+)?)\b/g)]
    .map((match) => `${match[1]}:${match[2]}`)
    .filter((script) => !script.endsWith(":dry-run"));
}

/** The release script's own usage text for one package. */
function releaseUsage(pkg: string): string {
  return execFileSync("node", ["scripts/release-package.mjs", pkg, "--help"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * The pre-refactor command for each alias, copied from the `ui:*`/`media:*`
 * entries as they existed before `pkg` was introduced. These are the contract.
 */
const EXPECTED: Record<string, string> = {
  "ui typecheck": "bun run --cwd packages/ui typecheck",
  "ui test": "bun run --cwd packages/ui test",
  "ui build": "bun run --cwd packages/ui build",
  "ui pack": "bun run --cwd packages/ui publish:dry-run",
  "ui consumer-smoke": "node scripts/check-package-consumer.mjs ui",
  "ui release": "node scripts/release-package.mjs ui",
  "media typecheck": "bun run --cwd packages/media typecheck",
  "media test": "bun run --cwd packages/media test",
  "media build": "bun run --cwd packages/media build",
  "media pack": "bun run --cwd packages/media publish:dry-run",
  "media consumer-smoke": "node scripts/check-package-consumer.mjs media",
  "media release": "node scripts/release-package.mjs media",
};

describe("run-package-script resolves the historical alias commands", () => {
  it.each(Object.entries(EXPECTED))("pkg %s -> %s", (pair, command) => {
    expect(print(pair.split(" "))).toBe(command);
  });

  it("forwards extra arguments to the resolved command", () => {
    expect(print(["ui", "release", "--patch", "--publish"])).toBe(
      "node scripts/release-package.mjs ui --patch --publish",
    );
    expect(print(["media", "test", "--runTestsByPath", "src/foo.test.ts"])).toBe(
      "bun run --cwd packages/media test --runTestsByPath src/foo.test.ts",
    );
  });

  it("forwards trailing --help to the task instead of swallowing it", () => {
    // `bun run ui:release -- --help` is documented in scripts/release-package.mjs's
    // own usage text. The runner must not intercept flags that come after the task.
    expect(print(["ui", "release", "--help"])).toBe(
      "node scripts/release-package.mjs ui --help",
    );
    expect(print(["media", "release", "-h"])).toBe(
      "node scripts/release-package.mjs media -h",
    );
  });
});

describe("run-package-script forwards --help to the real release script", () => {
  it("prints the release script's usage, not the runner's", () => {
    const result = resolve(["ui", "release", "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("bun run ui:release --");
    expect(result.stdout).toContain("--allow-dirty");
    expect(result.stdout).not.toContain("bun run pkg <package>");
  });
});

describe("run-package-script argument validation", () => {
  it("rejects an unknown package and names the valid ones", () => {
    const result = resolve(["nope", "typecheck"]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/unknown package "nope"/i);
    expect(`${result.stdout}${result.stderr}`).toContain("media");
    expect(`${result.stdout}${result.stderr}`).toContain("ui");
  });

  it("rejects an unknown task and names the valid ones", () => {
    const result = resolve(["ui", "publish"]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/unknown task "publish"/i);
    expect(`${result.stdout}${result.stderr}`).toContain("consumer-smoke");
  });

  it("rejects a missing task", () => {
    expect(resolve(["ui"]).status).toBe(1);
  });

  it("prints usage for --help and exits 0", () => {
    const result = resolve(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("bun run pkg");
  });
});

describe("package.json wiring", () => {
  it("exposes the generic runner as `pkg`", () => {
    expect(packageJson.scripts.pkg).toBe("node scripts/run-package-script.mjs");
  });

  it("keeps all twelve ui:*/media:* aliases delegating to the runner", () => {
    for (const pair of Object.keys(EXPECTED)) {
      const [pkg, task] = pair.split(" ");
      expect(packageJson.scripts[`${pkg}:${task}`]).toBe(
        `node scripts/run-package-script.mjs ${pkg} ${task}`,
      );
    }
  });

  it("still exposes every alias the publish workflows call", () => {
    // .github/workflows/publish-*.yml invoke these by name; dropping one breaks
    // a publish mid-flight.
    for (const source of [
      ".github/workflows/publish-ui.yml",
      ".github/workflows/publish-media.yml",
    ]) {
      const referenced = aliasesIn(read(source));

      expect(referenced.length).toBeGreaterThan(0);
      for (const script of new Set(referenced)) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    }
  });

  it("still exposes every alias the release script shells out to", () => {
    // scripts/release-package.mjs interpolates the package name into its gate
    // list, so the aliases are read back out of its usage text — which is
    // generated from the same list the script executes.
    for (const pkg of ["ui", "media"]) {
      const referenced = aliasesIn(releaseUsage(pkg));

      expect(referenced).toContain(`${pkg}:consumer-smoke`);
      for (const script of new Set(referenced)) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    }
  });
});
