#!/usr/bin/env node
/**
 * The quality gates, in order: what CI's `validate` job runs (`bun run verify`,
 * nothing else) and what a contributor runs before pushing. One list, so CI and
 * local runs cannot drift. Prints per-gate timing and a summary table.
 *
 * The web build + bundle-size delta (ci.yml's `bundle-size` job) is not a gate
 * here: it needs an 8 GB-heap Expo export. Run `bun run build && bun run
 * bundle-size` when you touch dependencies or anything bundle-shaped.
 *
 * Must pass on a fresh clone with no `.env`: every optional feature (auth,
 * billing, media, Sentry) fails closed when its env vars are missing. The one
 * gate that needs the network, `packages:drift-check`, warns instead of failing
 * when the npm registry is unreachable — except in CI.
 *
 * Usage:
 *   bun run verify
 *   bun run verify --list             # print "<name>\t<command>" per gate, run nothing
 *   bun run verify --bail             # stop at the first failing gate
 *   bun run verify --max-workers 2    # cap jest's workers (shared machines)
 */
import { spawnSync } from "node:child_process";
import { PACKAGE_KEYS } from "./lib/workspacePackages.mjs";

/** Ordered gates. Each is a root script, so every gate reruns as its own command. */
const GATES = [
  { name: "packages:peer-check", command: ["bun", "run", "packages:peer-check"] },
  { name: "packages:drift-check", command: ["bun", "run", "packages:drift-check"] },
  { name: "typecheck", command: ["bun", "run", "typecheck"] },
  // Each package against its own tsconfig (its rootDir, no root path aliases),
  // which the root typecheck does not apply.
  ...PACKAGE_KEYS.map((key) => ({
    name: `pkg ${key} typecheck`,
    command: ["bun", "run", "pkg", key, "typecheck"],
  })),
  { name: "lint", command: ["bun", "run", "lint"] },
  { name: "check:features", command: ["bun", "run", "check:features"] },
  // Every committed generated artifact: registries, icon registry, LLM docs.
  { name: "gen --check", command: ["bun", "run", "gen", "--check"] },
  { name: "docs:versions:check", command: ["bun", "run", "docs:versions:check"] },
  { name: "test:ci", command: ["bun", "run", "test:ci"] },
];

const argv = process.argv.slice(2);

function usage() {
  console.log(`
Usage:
  bun run verify [--list] [--bail] [--max-workers <n>]

Runs every gate CI's \`validate\` job runs, in order:
${GATES.map((gate) => `  ${gate.name.padEnd(24)} ${gate.command.join(" ")}`).join("\n")}

Options:
  --list             Print each gate as "<name>\\t<command>" without running anything
  --bail             Stop at the first failure instead of running every gate
  --max-workers <n>  Pass --maxWorkers=<n> to jest in the test:ci gate
  -h, --help         Usage info

Not covered: the web build + bundle-size delta (ci.yml's \`bundle-size\` job).
Run \`bun run build && bun run bundle-size\` for that.
`);
}

let bail = false;
let list = false;
let maxWorkers = null;
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  } else if (arg === "--list") {
    list = true;
  } else if (arg === "--bail") {
    bail = true;
  } else if (arg === "--max-workers" || arg.startsWith("--max-workers=")) {
    maxWorkers = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[(index += 1)];
    if (!/^\d+%?$/.test(maxWorkers ?? "")) {
      console.error(`verify: --max-workers needs a count or percentage, got "${maxWorkers ?? ""}"`);
      process.exit(1);
    }
  } else {
    console.error(`verify: unknown argument "${arg}"`);
    usage();
    process.exit(1);
  }
}

if (maxWorkers) {
  GATES.find((gate) => gate.name === "test:ci").command.push(`--maxWorkers=${maxWorkers}`);
}

if (list) {
  for (const gate of GATES) {
    console.log(`${gate.name}\t${gate.command.join(" ")}`);
  }
  process.exit(0);
}

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
