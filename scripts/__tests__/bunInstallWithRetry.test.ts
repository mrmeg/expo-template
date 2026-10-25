/**
 * `bunInstallWithRetry` (scripts/lib/bunInstallWithRetry.mjs): a stalled install
 * is killed and retried from a clean fixture; a real failure is not retried.
 * Each case drives the helper through node with `node` standing in for `bun`,
 * because the helper is an ES module and Jest here loads CommonJS.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const helper = join(__dirname, "..", "lib", "bunInstallWithRetry.mjs");

/** Runs the helper with `node <script>` as the install and returns its outcome. */
function runHelper(cwd: string, script: string, options: Record<string, unknown>) {
  const driver = [
    `import { bunInstallWithRetry } from ${JSON.stringify(helper)};`,
    "try {",
    `  const attempt = bunInstallWithRetry([${JSON.stringify(script)}], ${JSON.stringify(cwd)}, ${JSON.stringify({ command: "node", ...options })});`,
    "  console.log(JSON.stringify({ ok: true, attempt }));",
    "} catch (error) {",
    "  console.log(JSON.stringify({ ok: false, message: error.message }));",
    "}",
  ].join("\n");
  const stdout = execFileSync("node", ["--input-type=module", "-e", driver], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(stdout.trim().split("\n").pop()!) as { ok: boolean; attempt?: number; message?: string };
}

let fixture: string;

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "bun-install-retry-"));
});

afterEach(() => {
  rmSync(fixture, { recursive: true, force: true });
});

/** A fake install that counts its runs in `count`, then behaves per `behaviour(run)`. */
function fakeInstall(behaviour: string) {
  const script = join(fixture, "fake-install.cjs");
  writeFileSync(
    script,
    [
      "const fs = require('fs');",
      "const n = (fs.existsSync('count') ? Number(fs.readFileSync('count', 'utf8')) : 0) + 1;",
      "fs.writeFileSync('count', String(n));",
      "fs.mkdirSync('node_modules', { recursive: true });",
      "fs.writeFileSync('bun.lock', 'partial');",
      behaviour,
    ].join("\n"),
  );
  return script;
}

const runs = () => Number(readFileSync(join(fixture, "count"), "utf8"));

it("returns on the first clean exit", () => {
  const result = runHelper(fixture, fakeInstall("process.exit(0);"), { timeoutMs: 5_000 });
  expect(result).toEqual({ ok: true, attempt: 1 });
  expect(runs()).toBe(1);
});

it("kills a stalled install and retries it from a clean fixture", () => {
  // Stalls on the first run, exits cleanly on the second.
  const script = fakeInstall("if (n === 1) setInterval(() => {}, 1000); else process.exit(0);");
  const result = runHelper(fixture, script, { timeoutMs: 1_500, attempts: 3 });
  expect(result).toEqual({ ok: true, attempt: 2 });
  expect(runs()).toBe(2);
});

it("gives up after the last stalled attempt", () => {
  const result = runHelper(fixture, fakeInstall("setInterval(() => {}, 1000);"), { timeoutMs: 1_000, attempts: 2 });
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/stalled past 1 s on all 2 attempts/);
  expect(runs()).toBe(2);
});

it("does not retry a real failure", () => {
  const result = runHelper(fixture, fakeInstall("process.exit(1);"), { timeoutMs: 5_000, attempts: 3 });
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/failed with status 1/);
  expect(runs()).toBe(1);
});

it("clears node_modules and bun.lock before a retry", () => {
  // The first run leaves partial state and stalls; the second records whether it was cleared.
  const checker = join(fixture, "fake-install-check.cjs");
  writeFileSync(
    checker,
    [
      "const fs = require('fs');",
      "const n = (fs.existsSync('count') ? Number(fs.readFileSync('count', 'utf8')) : 0) + 1;",
      "fs.writeFileSync('count', String(n));",
      "if (n === 1) { fs.mkdirSync('node_modules', { recursive: true }); fs.writeFileSync('bun.lock', 'partial'); setInterval(() => {}, 1000); }",
      "else { fs.writeFileSync('clean', String(!fs.existsSync('node_modules') && !fs.existsSync('bun.lock'))); process.exit(0); }",
    ].join("\n"),
  );
  const result = runHelper(fixture, checker, { timeoutMs: 1_500, attempts: 2 });
  expect(result).toEqual({ ok: true, attempt: 2 });
  expect(existsSync(join(fixture, "clean"))).toBe(true);
  expect(readFileSync(join(fixture, "clean"), "utf8")).toBe("true");
});
