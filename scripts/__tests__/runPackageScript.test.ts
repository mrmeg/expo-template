/**
 * Guardrails for the generic workspace-package script runner.
 *
 * `bun run pkg <package> <task>` is the way to run a package task: every
 * caller in this repo (the release script, the publish workflow, `verify`, the
 * docs) uses the runner. The `ui:*`/`media:*`/`purchases:*`/`lint:*` root
 * aliases stay only as shims over the same runner, because automation outside
 * the repo still calls them. These tests pin the resolved command for every
 * (package, task) pair — if the table drifts, a publish silently runs the wrong
 * thing — pin each shim to its runner call, and fail when a repo caller uses a
 * shim instead of `pkg`.
 */
import { execFileSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
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

const PACKAGE_SLUGS = ["ui", "media", "purchases", "lint"];
const TASK_NAMES = ["typecheck", "test", "build", "pack", "consumer-smoke", "release"];

/**
 * Every `<package>:<task>` alias mentioned in a file. The task half is pinned to
 * the runner's task names rather than any word, because `lint` also prefixes two
 * unrelated root scripts: `lint` (expo lint) and `lint:ui` (the design-system
 * CLI), which are not package tasks.
 */
function aliasesIn(source: string): string[] {
  const pattern = new RegExp(`\\b(${PACKAGE_SLUGS.join("|")}):(${TASK_NAMES.join("|")})\\b`, "g");
  return [...source.matchAll(pattern)].map((match) => `${match[1]}:${match[2]}`);
}

/**
 * The command each (package, task) pair resolves to: the same commands the
 * removed aliases ran, so moving callers to `pkg` changed nothing they execute.
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
  "purchases typecheck": "bun run --cwd packages/purchases typecheck",
  "purchases test": "bun run --cwd packages/purchases test",
  "purchases build": "bun run --cwd packages/purchases build",
  "purchases pack": "bun run --cwd packages/purchases publish:dry-run",
  "purchases consumer-smoke": "node scripts/check-package-consumer.mjs purchases",
  "purchases release": "node scripts/release-package.mjs purchases",
  "lint typecheck": "bun run --cwd packages/lint typecheck",
  "lint test": "bun run --cwd packages/lint test",
  "lint build": "bun run --cwd packages/lint build",
  "lint pack": "bun run --cwd packages/lint publish:dry-run",
  "lint consumer-smoke": "node scripts/check-package-consumer.mjs lint",
  "lint release": "node scripts/release-package.mjs lint",
};

describe("run-package-script resolves every package task", () => {
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
    expect(print(["ui", "consumer-smoke", "--tarball", "/tmp/x.tgz"])).toBe(
      "node scripts/check-package-consumer.mjs ui --tarball /tmp/x.tgz",
    );
  });

  it("forwards trailing --help to the task instead of swallowing it", () => {
    // `bun run pkg ui release -- --help` is documented in the release script's
    // own usage text. The runner must not intercept flags that come after the task.
    expect(print(["ui", "release", "--help"])).toBe("node scripts/release-package.mjs ui --help");
    expect(print(["media", "release", "-h"])).toBe("node scripts/release-package.mjs media -h");
  });
});

describe("run-package-script forwards --help to the real release script", () => {
  it("prints the release script's usage, not the runner's", () => {
    const result = resolve(["ui", "release", "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("bun run pkg ui release --");
    expect(result.stdout).toContain("--allow-dirty");
    expect(result.stdout).not.toContain("bun run pkg <package> <task>");
  });
});

describe("run-package-script argument validation", () => {
  it("rejects an unknown package and names the valid ones", () => {
    const result = resolve(["nope", "typecheck"]);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/unknown package "nope"/i);
    expect(`${result.stdout}${result.stderr}`).toContain("lint, media, purchases, ui");
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

/** Tracked text files outside generated output that could name a script. */
function callerFiles(): string[] {
  const files = [
    "README.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "workers/media/README.md",
    ...readdirSync(join(root, ".github/workflows")).map((name) => `.github/workflows/${name}`),
    ...readdirSync(join(root, "docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `docs/${name}`),
    ...readdirSync(join(root, "scripts"))
      .filter((name) => /\.(mjs|js|ts)$/.test(name))
      .map((name) => `scripts/${name}`),
  ];
  for (const pkg of PACKAGE_SLUGS) {
    for (const name of readdirSync(join(root, "packages", pkg))) {
      if (/\.(md|txt)$/.test(name)) files.push(`packages/${pkg}/${name}`);
    }
  }
  return files;
}

describe("the per-package aliases are folded into `pkg`", () => {
  it.each(PACKAGE_SLUGS.flatMap((pkg) => TASK_NAMES.map((task) => [pkg, task])))(
    "keeps %s:%s as a shim over `pkg`",
    (pkg, task) => {
      expect(packageJson.scripts[`${pkg}:${task}`]).toBe(
        `node scripts/run-package-script.mjs ${pkg} ${task}`
      );
    }
  );

  it("no package.json script calls a shim", () => {
    expect(aliasesIn(Object.values(packageJson.scripts).join("\n"))).toEqual([]);
  });

  it("exposes the generic runner as `pkg`", () => {
    expect(packageJson.scripts.pkg).toBe("node scripts/run-package-script.mjs");
  });

  it("does not mistake the root lint scripts for package tasks", () => {
    // `lint` runs expo lint and `lint:ui` runs the design-system CLI: neither is
    // a package task, and both stay.
    expect(aliasesIn("bun run lint\nbun run lint:ui --doctor")).toEqual([]);
    expect(aliasesIn("bun run lint:test")).toEqual(["lint:test"]);
    expect(packageJson.scripts.lint).toBe("expo lint");
    expect(packageJson.scripts["lint:ui"]).toBeDefined();
  });

  it.each(callerFiles())("%s calls `pkg`, not a shim", (file) => {
    expect(aliasesIn(read(file))).toEqual([]);
  });

  it("every documented `bun run pkg <package> <task>` resolves", () => {
    const calls = new Set<string>();
    for (const file of callerFiles()) {
      for (const match of read(file).matchAll(/bun run pkg ([a-z]+) ([a-z-]+)/g)) {
        calls.add(`${match[1]} ${match[2]}`);
      }
    }

    expect(calls.size).toBeGreaterThan(0);
    for (const call of calls) {
      expect([call, resolve(["--print", ...call.split(" ")]).status]).toEqual([call, 0]);
    }
  });
});
