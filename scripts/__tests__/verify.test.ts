/**
 * Guardrails for the local CI-parity story.
 *
 * `bun run verify` only earns trust if it stays in lockstep with the gates
 * `.github/workflows/ci.yml` actually runs. These tests read both files and
 * fail when they drift — adding a CI step without adding it to `verify` (or
 * vice versa) is the exact regression that sends contributors back to
 * "push and wait for CI".
 *
 * The pre-commit hook is checked here too: it must stay cheap (no test run)
 * and there must be no default pre-push hook, so pushing stays fast.
 */
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** The `run: bun run <script>` script names of ci.yml's `validate` job, in order. */
function ciValidateScripts(): string[] {
  const workflow = read(".github/workflows/ci.yml");
  const start = workflow.indexOf("\n  validate:");
  const end = workflow.indexOf("\n  bundle-size:");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const validateJob = workflow.slice(start, end);
  return [...validateJob.matchAll(/^\s*run:\s*bun run (\S+)\s*$/gm)].map((match) => match[1]);
}

/** `node scripts/verify.mjs --list` output parsed into gate name + command. */
function verifyGates(): { name: string; command: string }[] {
  const stdout = execFileSync("node", ["scripts/verify.mjs", "--list"], {
    cwd: root,
    encoding: "utf8",
  });

  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [name, ...rest] = line.split("\t");
      return { name: name.trim(), command: rest.join("\t").trim() };
    });
}

/** Job names and `run:` commands under a top-level lefthook.yml hook key. */
function lefthookJobs(hook: string): { names: string[]; runs: string[] } {
  const config = read("lefthook.yml");
  const hookStart = config.indexOf(`\n${hook}:`);
  if (hookStart === -1) return { names: [], runs: [] };

  const rest = config.slice(hookStart + 1);
  const nextHook = rest.slice(hook.length + 1).search(/^\S/m);
  const section = nextHook === -1 ? rest : rest.slice(0, hook.length + 1 + nextHook);

  return {
    names: [...section.matchAll(/^\s*-?\s*name:\s*(\S+)\s*$/gm)].map((match) => match[1]),
    runs: [...section.matchAll(/^\s*run:\s*(.+?)\s*$/gm)].map((match) => match[1]),
  };
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("bun run verify mirrors the CI validate job", () => {
  it("runs the same gates in the same order as ci.yml", () => {
    expect(verifyGates().map((gate) => gate.name)).toEqual(ciValidateScripts());
  });

  it("keeps the baseline gates, in order, as later gates get added", () => {
    // A subsequence rather than an exact list: adding a CI step should only
    // require editing scripts/verify.mjs, with the drift test above as the guard.
    const baseline = [
      "packages:peer-check",
      "typecheck",
      "lint",
      "check:features",
      "gen:templates:check",
      "docs:llms:check",
      "test:ci",
    ];
    const names = verifyGates().map((gate) => gate.name);

    expect(names.filter((name) => baseline.includes(name))).toEqual(baseline);
  });

  it("runs jest in CI mode but skips coverage, which nothing local reads", () => {
    const testGate = verifyGates().find((gate) => gate.name === "test:ci");

    expect(testGate?.command).toContain("jest");
    expect(testGate?.command).toContain("--ci");
    expect(testGate?.command).not.toContain("--coverage");
    expect(testGate?.command).not.toContain("--watch");
  });

  it("is exposed as a plain `bun run verify` script", () => {
    expect(packageJson.scripts.verify).toBe("node scripts/verify.mjs");
  });
});

describe("ci.yml guards the generated template registry", () => {
  const workflow = read(".github/workflows/ci.yml");

  it("runs gen:templates:check", () => {
    expect(workflow).toContain("bun run gen:templates:check");
  });

  it("runs it before the LLM docs freshness check", () => {
    expect(workflow.indexOf("bun run gen:templates:check")).toBeLessThan(
      workflow.indexOf("bun run docs:llms:check"),
    );
  });
});

describe("lefthook pre-commit hook", () => {
  it("has a committed config", () => {
    expect(existsSync(join(root, "lefthook.yml"))).toBe(true);
  });

  it("is installed for every contributor by bun install", () => {
    expect(packageJson.scripts.prepare).toBe("lefthook install");
    expect(packageJson.devDependencies.lefthook).toBeDefined();
  });

  it("runs only the cheap gates", () => {
    expect(lefthookJobs("pre-commit").runs).toEqual([
      "bun run typecheck",
      "bun run lint",
      "bun run gen:templates:check",
      "bun run docs:llms:check",
    ]);
  });

  it("never runs the test suite on commit", () => {
    const runs = lefthookJobs("pre-commit").runs.join(" ");

    expect(runs).not.toContain("jest");
    expect(runs).not.toContain("test:ci");
    expect(runs).not.toContain("bun run verify");
  });

  it("does not add a pre-push hook, so pushing stays fast", () => {
    expect(read("lefthook.yml")).not.toMatch(/^pre-push:/m);
  });
});
