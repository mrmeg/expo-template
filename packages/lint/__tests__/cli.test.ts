/**
 * The CLI is the only surface a person types, so it is pinned end to end: a real
 * `node` process, the real flat config, the real design system. `--doctor` is
 * the important one — it fails when the plugin stops resolving, the config stops
 * enabling the rules, or `packages/ui/src` stops parsing, which is exactly the
 * silent breakage the rules cannot report themselves.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CLI = path.join(ROOT, "packages", "lint", "bin", "cli.js");
const TIMEOUT = 60000;

/**
 * @param args CLI arguments
 */
function run(args: string[]) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: TIMEOUT,
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

describe("expo-ui-lint", () => {
  it(
    "lists every rule with `--rules`",
    () => {
      const { status, stdout } = run(["--rules"]);
      expect(status).toBe(0);
      for (const rule of [
        "expo-ui/no-raw-colors",
        "expo-ui/no-arbitrary-values",
        "expo-ui/no-restyle",
        "expo-ui/no-raw-primitives",
      ]) {
        expect(stdout).toContain(rule);
      }
    },
    TIMEOUT,
  );

  it(
    "reports a healthy plugin, config, and design system with `--doctor`",
    () => {
      const { status, stdout, stderr } = run(["--doctor"]);
      expect(stderr).toBe("");
      // In this repo the facts come from the sources, not from a manifest.
      expect(stdout).toContain(`design system: sources at ${path.join(ROOT, "packages", "ui", "src")}`);
      // The fixture trips all four rules; the counts are the wiring check.
      expect(stdout).toContain("= 1/1/2/2 (expected 1/1/2/2)");
      expect(stdout).not.toContain("FAIL");
      expect(status).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "reads the config off the file named after `--doctor`",
    () => {
      const { status, stdout } = run(["--doctor", "app/_layout.tsx"]);
      expect(stdout).toContain("config: app/_layout.tsx");
      expect(stdout).not.toContain("FAIL");
      expect(status).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "documents the flags with `--help`",
    () => {
      const { status, stdout } = run(["--help"]);
      expect(status).toBe(0);
      expect(stdout).toContain("--changed");
      expect(stdout).toContain("--doctor");
    },
    TIMEOUT,
  );

  it(
    "rejects an unknown flag with exit 2",
    () => {
      const { status, stderr } = run(["--bogus"]);
      expect(status).toBe(2);
      expect(stderr).toContain("--bogus");
    },
    TIMEOUT,
  );
});
