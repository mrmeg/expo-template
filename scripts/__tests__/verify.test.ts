/**
 * Guardrails for `bun run verify`, the one gate list.
 *
 * CI's `validate` job runs `bun run verify` and nothing else, so CI and a local
 * run cannot drift by construction. What can still drift is the prose: the
 * gate list in CONTRIBUTING.md is the one the other docs link to, and these
 * tests hold it to `verify --list`.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** `node scripts/verify.mjs --list` output parsed into gate name + command. */
function verifyGates(args: string[] = []): { name: string; command: string }[] {
  const stdout = execFileSync("node", ["scripts/verify.mjs", "--list", ...args], {
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

function runVerify(args: string[]): { status: number; output: string } {
  try {
    const stdout = execFileSync("node", ["scripts/verify.mjs", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

/** The `validate` job of ci.yml, as text. */
function validateJob(): string {
  const workflow = read(".github/workflows/ci.yml");
  const start = workflow.indexOf("\n  validate:");
  const end = workflow.indexOf("\n  bundle-size:");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

/** Gate names in the table between CONTRIBUTING.md's verify-gates markers, in order. */
function documentedGates(): string[] {
  const doc = read("CONTRIBUTING.md");
  const start = doc.indexOf("<!-- verify-gates:start -->");
  const end = doc.indexOf("<!-- verify-gates:end -->");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return [...doc.slice(start, end).matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`/gm)].map((match) => match[1]);
}

describe("CI runs bun run verify instead of restating its gates", () => {
  it("has the validate job run `bun run verify`", () => {
    expect(validateJob()).toMatch(/^\s*run:\s*bun run verify\s*$/m);
  });

  it("runs no other gate in the validate job", () => {
    const runs = [...validateJob().matchAll(/^\s*run:\s*(.+)$/gm)].map((match) => match[1].trim());

    expect(runs).toEqual(["bun install --frozen-lockfile", "bun run verify"]);
  });

  it("collects no coverage in CI", () => {
    const testGate = verifyGates().find((gate) => gate.name === "test:ci");

    expect(testGate?.command).toBe("bun run test:ci");
    expect(packageJson.scripts["test:ci"]).toContain("--ci");
    expect(packageJson.scripts["test:ci"]).not.toContain("--coverage");
    expect(packageJson.scripts["test:ci"]).not.toContain("--watch");
  });
});

describe("the gate list", () => {
  it("runs every root and package typecheck, the drift gate, and the generator checks", () => {
    const names = verifyGates().map((gate) => gate.name);
    const expected = [
      "packages:peer-check",
      "packages:drift-check",
      "typecheck",
      "pkg ui typecheck",
      "pkg media typecheck",
      "pkg purchases typecheck",
      "pkg lint typecheck",
      "lint",
      "check:features",
      "gen --check",
      "docs:versions:check",
      "test:ci",
    ];

    expect(names).toEqual(expected);
  });

  it("names each gate after the root script it runs", () => {
    for (const { name, command } of verifyGates()) {
      expect(command).toBe(`bun run ${name}`);
      expect(packageJson.scripts[name.split(" ")[0]]).toBeDefined();
    }
  });

  it("does not include a workers/ typecheck (workers/media is not a workspace gate)", () => {
    expect(verifyGates().some((gate) => gate.command.includes("workers/"))).toBe(false);
  });

  it("forwards --max-workers to jest only", () => {
    const gates = verifyGates(["--max-workers", "2"]);

    expect(gates.find((gate) => gate.name === "test:ci")?.command).toBe("bun run test:ci --maxWorkers=2");
    expect(gates.filter((gate) => gate.command.includes("maxWorkers"))).toHaveLength(1);
    expect(verifyGates(["--max-workers=50%"]).find((gate) => gate.name === "test:ci")?.command).toBe(
      "bun run test:ci --maxWorkers=50%",
    );
  });

  it("rejects unknown arguments and a bad worker count instead of running anything", () => {
    expect(runVerify(["--bial"]).status).toBe(1);
    expect(runVerify(["--bial"]).output).toContain("unknown argument \"--bial\"");
    expect(runVerify(["--max-workers", "lots"]).status).toBe(1);
  });

  it("is exposed as a plain `bun run verify` script", () => {
    expect(packageJson.scripts.verify).toBe("node scripts/verify.mjs");
  });
});

describe("the documented gate list", () => {
  it("CONTRIBUTING.md lists exactly the gates verify --list prints, in order", () => {
    expect(documentedGates()).toEqual(verifyGates().map((gate) => gate.name));
  });

  it.each(["README.md", "AGENTS.md"])("%s links to that list instead of restating it", (doc) => {
    const text = read(doc);

    expect(text).toContain("CONTRIBUTING.md#verify-gates");
    // A restated list would name the gates in order; the old lists did.
    expect(text).not.toMatch(/packages:peer-check`?\s*(?:→|,)\s*`?typecheck/);
  });
});
