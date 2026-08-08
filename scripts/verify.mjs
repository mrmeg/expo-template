#!/usr/bin/env node
/**
 * Local CI parity gate.
 *
 * Runs the same checks as the `validate` job in `.github/workflows/ci.yml`, in
 * the same order, so a failure surfaces on the contributor's machine instead of
 * ten minutes into a CI run. Prints per-gate timing and a summary table.
 *
 * Gate names match the CI step's script name, so `scripts/__tests__/verify.test.ts`
 * can diff this list against the workflow and fail when the two drift.
 *
 * Deliberate differences from CI:
 *   - `test:ci`'s `--coverage`/`--forceExit` are dropped; coverage roughly
 *     doubles the run and nothing local reads the report. The gate still runs
 *     jest in `--ci` mode.
 *   - The web build + bundle-size delta (ci.yml's second job) is NOT run — it
 *     needs an 8GB-heap Expo export. Run `bun run build && bun run bundle-size`
 *     when you touch dependencies or anything bundle-shaped.
 *
 * Must pass on a fresh clone with no `.env`: every optional feature (auth,
 * billing, media, Sentry) fails closed when its env vars are missing.
 *
 * Usage:
 *   bun run verify
 *   bun run verify --list    # print "<name>\t<command>" per gate, run nothing
 *   bun run verify --bail    # stop at the first failing gate
 */
import { spawnSync } from "node:child_process";

/** Ordered gates, mirroring ci.yml's `validate` steps. */
const GATES = [
  { name: "packages:peer-check", command: ["bun", "run", "packages:peer-check"] },
  { name: "typecheck", command: ["bun", "run", "typecheck"] },
  { name: "lint", command: ["bun", "run", "lint"] },
  { name: "check:features", command: ["bun", "run", "check:features"] },
  { name: "gen:templates:check", command: ["bun", "run", "gen:templates:check"] },
  { name: "gen:blocks:check", command: ["bun", "run", "gen:blocks:check"] },
  { name: "docs:llms:check", command: ["bun", "run", "docs:llms:check"] },
  { name: "docs:versions:check", command: ["bun", "run", "docs:versions:check"] },
  // Not `bun run test:ci`: local runs skip coverage and --forceExit.
  { name: "test:ci", command: ["bun", "x", "jest", "--ci"] },
];

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(`
Usage:
  bun run verify [--list] [--bail]

Runs the CI \`validate\` gates locally, in CI order:
${GATES.map((gate) => `  ${gate.name.padEnd(20)} ${gate.command.join(" ")}`).join("\n")}

Options:
  --list      Print each gate as "<name>\\t<command>" without running anything
  --bail      Stop at the first failure instead of running every gate
  -h, --help  Usage info

Not covered: the web build + bundle-size delta (ci.yml's second job).
Run \`bun run build && bun run bundle-size\` for that.
`);
  process.exit(0);
}

if (argv.includes("--list")) {
  for (const gate of GATES) {
    console.log(`${gate.name}\t${gate.command.join(" ")}`);
  }
  process.exit(0);
}

const bail = argv.includes("--bail");
const results = [];

for (const [index, gate] of GATES.entries()) {
  console.log(`\n=== [${index + 1}/${GATES.length}] ${gate.name} — ${gate.command.join(" ")}`);

  const startedAt = Date.now();
  const result = spawnSync(gate.command[0], gate.command.slice(1), {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  const seconds = (Date.now() - startedAt) / 1000;

  if (result.error) {
    console.error(`verify: failed to spawn ${gate.command[0]}: ${result.error.message}`);
  }

  const ok = !result.error && result.status === 0;
  results.push({ ...gate, ok, seconds });

  if (!ok && bail) break;
}

const failed = results.filter((result) => !result.ok);
const total = results.reduce((sum, result) => sum + result.seconds, 0);

console.log("\n=== verify summary");
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.seconds.toFixed(1)}s  ${result.name}`);
}
const skipped = GATES.length - results.length;
if (skipped > 0) console.log(`SKIP  ${skipped} gate(s) not run after --bail`);
console.log(`${failed.length === 0 ? "verify passed" : "verify FAILED"} in ${total.toFixed(1)}s`);

if (failed.length > 0) {
  for (const result of failed) {
    console.log(`Rerun: ${result.command.join(" ")}`);
  }
  process.exit(1);
}
