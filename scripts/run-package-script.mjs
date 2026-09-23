#!/usr/bin/env node
/**
 * Generic workspace-package script runner: the one way to run a package task.
 *
 * Every package in `scripts/lib/workspacePackages.mjs` gets every task below, so
 * adding a package needs no new root scripts. The release script, the publish
 * workflow, `verify`, and the package READMEs all call `bun run pkg <package>
 * <task>`. The root `lint` and `lint:ui` scripts are unrelated: they run ESLint,
 * not the lint package's tasks (`bun run pkg lint <task>`).
 *
 * Usage:
 *   bun run pkg <ui|media|purchases|lint> <typecheck|test|build|pack|consumer-smoke|release> [...args]
 *   bun run pkg ui release -- --patch --publish
 *   bun run pkg --print media test          # print the resolved command, run nothing
 */
import { spawnSync } from "node:child_process";
import { SORTED_PACKAGE_KEYS, WORKSPACE_PACKAGES } from "./lib/workspacePackages.mjs";

/**
 * Task -> command factory. Each returns `[command, ...args]` so no task has to
 * think about shell quoting.
 *
 * `pack` maps to the package's own `publish:dry-run` (the file list, nothing
 * written); `consumer-smoke` and `release` map to parameterized scripts under
 * `scripts/` that take the package name as their first argument.
 */
const TASKS = {
  typecheck: ({ dir }) => ["bun", "run", "--cwd", dir, "typecheck"],
  test: ({ dir }) => ["bun", "run", "--cwd", dir, "test"],
  build: ({ dir }) => ["bun", "run", "--cwd", dir, "build"],
  pack: ({ dir }) => ["bun", "run", "--cwd", dir, "publish:dry-run"],
  "consumer-smoke": ({ key }) => ["node", "scripts/check-package-consumer.mjs", key],
  release: ({ key }) => ["node", "scripts/release-package.mjs", key],
};

const taskNames = Object.keys(TASKS).sort();

function usage() {
  console.log(`
Usage:
  bun run pkg <package> <task> [...args]

Packages:
  ${SORTED_PACKAGE_KEYS.join(", ")}

Tasks:
  ${taskNames.join(", ")}

Examples:
  bun run pkg ui typecheck
  bun run pkg media test
  bun run pkg ui consumer-smoke -- --tarball ./mrmeg-expo-ui-0.27.1.tgz
  bun run pkg ui release -- --patch --publish

Options:
  --print       Print the resolved command instead of running it
  -h, --help    Usage info
`);
}

function fail(message) {
  console.error(`run-package-script: ${message}`);
  usage();
  process.exit(1);
}

const argv = process.argv.slice(2);

// Only leading flags belong to the runner. Anything after `<package> <task>` is
// the task's: `bun run pkg ui release -- --help` must reach the release script's
// own usage text, not print this file's.
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

if (!packageName) fail(`missing package. Expected one of: ${SORTED_PACKAGE_KEYS.join(", ")}`);

const target = WORKSPACE_PACKAGES[packageName];
if (!target) {
  fail(`unknown package "${packageName}". Expected one of: ${SORTED_PACKAGE_KEYS.join(", ")}`);
}

if (!taskName) fail(`missing task. Expected one of: ${taskNames.join(", ")}`);

const task = TASKS[taskName];
if (!task) fail(`unknown task "${taskName}". Expected one of: ${taskNames.join(", ")}`);

const [command, ...args] = task({ key: packageName, ...target });
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
