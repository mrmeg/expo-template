#!/usr/bin/env node
/**
 * Generic workspace-package script runner.
 *
 * Replaces twelve copy-pasted root scripts (`ui:typecheck`, `media:build`, …)
 * with one table, so adding a third workspace package is a single entry here
 * instead of six more near-identical `package.json` lines.
 *
 * Usage:
 *   bun run pkg <ui|media> <typecheck|test|build|pack|consumer-smoke|release> [...args]
 *   bun run pkg ui release -- --patch --publish
 *   bun run pkg --print media test          # print the resolved command, run nothing
 *
 * The twelve `ui:*`/`media:*` aliases still exist and now delegate here. They
 * are load-bearing and must not be removed: `scripts/release-*-package.mjs`
 * shells out to them by name, `.github/workflows/publish-*.yml` runs them as
 * steps, and the published package READMEs document them.
 */
import { spawnSync } from "node:child_process";

/** Workspace packages, keyed by the short name used on the command line. */
const PACKAGES = {
  ui: { dir: "packages/ui", slug: "ui" },
  media: { dir: "packages/media", slug: "media" },
};

/**
 * Task -> command factory. Each returns `[command, ...args]` so no task has to
 * think about shell quoting.
 *
 * `pack` maps to the package's own `publish:dry-run`; `consumer-smoke` and
 * `release` map to the per-package root scripts under `scripts/`, which are
 * genuinely different files rather than a parameterized one.
 */
const TASKS = {
  typecheck: ({ dir }) => ["bun", "run", "--cwd", dir, "typecheck"],
  test: ({ dir }) => ["bun", "run", "--cwd", dir, "test"],
  build: ({ dir }) => ["bun", "run", "--cwd", dir, "build"],
  pack: ({ dir }) => ["bun", "run", "--cwd", dir, "publish:dry-run"],
  "consumer-smoke": ({ slug }) => ["node", `scripts/check-${slug}-package-consumer.mjs`],
  release: ({ slug }) => ["node", `scripts/release-${slug}-package.mjs`],
};

const packageNames = Object.keys(PACKAGES).sort();
const taskNames = Object.keys(TASKS).sort();

function usage() {
  console.log(`
Usage:
  bun run pkg <package> <task> [...args]

Packages:
  ${packageNames.join(", ")}

Tasks:
  ${taskNames.join(", ")}

Examples:
  bun run pkg ui typecheck
  bun run pkg media test
  bun run pkg ui release -- --patch --publish

Options:
  --print       Print the resolved command instead of running it
  -h, --help    Usage info

The \`<package>:<task>\` aliases (\`bun run ui:typecheck\`, …) delegate here and
remain supported — release scripts, publish workflows, and package docs use them.
`);
}

function fail(message) {
  console.error(`run-package-script: ${message}`);
  usage();
  process.exit(1);
}

const argv = process.argv.slice(2);

// Only leading flags belong to the runner. Anything after `<package> <task>` is
// the task's: `bun run ui:release -- --help` must reach the release script's own
// usage text, not print this file's.
const leadingFlags = [];
const positional = [];
for (const arg of argv) {
  if (positional.length < 2 && arg.startsWith("-")) leadingFlags.push(arg);
  else positional.push(arg);
}

if (leadingFlags.includes("-h") || leadingFlags.includes("--help")) {
  usage();
  process.exit(0);
}

const printOnly = leadingFlags.includes("--print");
const [packageName, taskName, ...forwarded] = positional;

if (!packageName) fail(`missing package. Expected one of: ${packageNames.join(", ")}`);

const target = PACKAGES[packageName];
if (!target) {
  fail(`unknown package "${packageName}". Expected one of: ${packageNames.join(", ")}`);
}

if (!taskName) fail(`missing task. Expected one of: ${taskNames.join(", ")}`);

const task = TASKS[taskName];
if (!task) fail(`unknown task "${taskName}". Expected one of: ${taskNames.join(", ")}`);

const [command, ...args] = task(target);
const fullArgs = [...args, ...forwarded];

if (printOnly) {
  console.log([command, ...fullArgs].join(" "));
  process.exit(0);
}

const result = spawnSync(command, fullArgs, { cwd: process.cwd(), stdio: "inherit" });

if (result.error) {
  console.error(`run-package-script: failed to spawn ${command}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
