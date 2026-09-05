/**
 * Guardrails for the local CI-parity story.
 *
 * `bun run verify` only earns trust if it stays in lockstep with the gates
 * `.github/workflows/ci.yml` actually runs. These tests read both files and
 * fail when they drift — adding a CI step without adding it to `verify` (or
 * vice versa) is the exact regression that sends contributors back to
 * "push and wait for CI".
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
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

const packageJson = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
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
      "gen:blocks:check",
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

describe("ci.yml guards the generated registries", () => {
  const workflow = read(".github/workflows/ci.yml");

  it("runs gen:templates:check", () => {
    expect(workflow).toContain("bun run gen:templates:check");
  });

  it("runs gen:blocks:check", () => {
    expect(workflow).toContain("bun run gen:blocks:check");
  });

  it("runs them before the LLM docs freshness check", () => {
    const docsIndex = workflow.indexOf("bun run docs:llms:check");

    expect(workflow.indexOf("bun run gen:templates:check")).toBeLessThan(docsIndex);
    expect(workflow.indexOf("bun run gen:blocks:check")).toBeLessThan(docsIndex);
  });
});
