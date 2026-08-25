#!/usr/bin/env node
/**
 * Release a workspace package: bump the version, run every gate, optionally publish.
 *
 * Replaces the copy-pasted pair of per-package release scripts with one script
 * plus a per-package table, in the same spirit as
 * `scripts/run-package-script.mjs`.
 *
 * Usage:
 *   node scripts/release-package.mjs <ui|media> [patch|minor|major|x.y.z] [--publish] [--allow-dirty]
 *
 * The `bun run ui:release -- --patch` ergonomics are unchanged: the
 * `run-package-script` table supplies the leading package-name argument.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import semver from "semver";

/** Per-package differences: nothing but the directory and a docs example version. */
const PACKAGES = {
  ui: { dir: "packages/ui", exampleVersion: "0.2.0" },
  media: { dir: "packages/media", exampleVersion: "0.3.0" },
};

/**
 * Gates run in order after the version bump. Each is a `<package>:<task>` root
 * alias from package.json, so this list doubles as the usage text's gate list —
 * keeping the documented flow and the executed flow from drifting apart.
 */
const GATES = ["typecheck", "test", "build", "pack", "consumer-smoke"];

const packageNames = Object.keys(PACKAGES).sort();
const root = process.cwd();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function capture(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function usage(packageName) {
  const target = PACKAGES[packageName];
  const slug = target ? packageName : `<${packageNames.join("|")}>`;
  const dir = target?.dir ?? "packages/<package>";
  const exampleVersion = target?.exampleVersion ?? "1.2.3";

  console.log(`
Usage:
  bun run ${slug}:release -- [patch|minor|major|x.y.z] [--publish] [--allow-dirty]
  bun run ${slug}:release -- --patch [--publish] [--allow-dirty]

Examples:
  bun run ${slug}:release
  bun run ${slug}:release -- --patch --publish
  bun run ${slug}:release -- minor
  bun run ${slug}:release -- ${exampleVersion} --publish

Defaults:
  - version bump: patch
  - publish: false

The command updates ${dir}/package.json and bun.lock, then runs:
  bun run packages:peer-check
${GATES.map((gate) => `  bun run ${slug}:${gate}`).join("\n")}

Pass --publish to run npm publish --access public after all gates pass.
`);
}

const argv = process.argv.slice(2);
const [packageName, ...args] = argv;

if (argv.includes("--help") || argv.includes("-h")) {
  usage(packageName);
  process.exit(0);
}

const target = PACKAGES[packageName];

if (!target) {
  usage(packageName);
  throw new Error(
    `Unknown package "${packageName ?? ""}". Expected one of: ${packageNames.join(", ")}.`
  );
}

const packageDir = join(root, target.dir);
const packageJsonPath = join(packageDir, "package.json");

const publish = args.includes("--publish");
const allowDirty = args.includes("--allow-dirty");
const bumpFlags = args.filter((arg) => ["--patch", "--minor", "--major"].includes(arg));
const positional = args.filter((arg) => !arg.startsWith("-"));

if (positional.length > 1) {
  usage(packageName);
  throw new Error(`Expected at most one version argument, received: ${positional.join(", ")}`);
}

if (bumpFlags.length > 1 || (bumpFlags.length === 1 && positional.length === 1)) {
  usage(packageName);
  throw new Error("Use only one version bump: patch, minor, major, --patch, --minor, --major, or x.y.z.");
}

const bump = positional[0] ?? bumpFlags[0]?.slice(2) ?? "patch";

const status = capture("git", ["status", "--short"]);
if (status.status !== 0) {
  throw new Error("Could not inspect git status.");
}

if (!allowDirty && status.stdout.trim()) {
  console.error("Working tree has uncommitted changes:");
  console.error(status.stdout.trim());
  console.error("");
  console.error("Commit current changes first, then rerun:");
  console.error(`  git add -A && git commit -m "chore: prepare ${packageName} package release"`);
  console.error(`  bun run ${packageName}:release -- --${bump} ${publish ? "--publish" : ""}`.trimEnd());
  console.error("");
  console.error("Or intentionally release from local changes:");
  console.error(`  bun run ${packageName}:release -- --${bump} ${publish ? "--publish " : ""}--allow-dirty`);
  throw new Error("Working tree has uncommitted changes.");
}

const manifest = JSON.parse(await readFile(packageJsonPath, "utf8"));
const currentVersion = manifest.version;
const nextVersion = semver.valid(bump) ?? semver.inc(currentVersion, bump);

if (!nextVersion) {
  usage(packageName);
  throw new Error(`Invalid version bump "${bump}". Use patch, minor, major, or an exact x.y.z version.`);
}

if (semver.lte(nextVersion, currentVersion)) {
  throw new Error(`Next version ${nextVersion} must be greater than current version ${currentVersion}.`);
}

const alreadyPublished = capture("npm", ["view", `${manifest.name}@${nextVersion}`, "version"], {
  stdio: ["ignore", "pipe", "pipe"],
});

if (alreadyPublished.status === 0 && alreadyPublished.stdout.trim() === nextVersion) {
  throw new Error(`${manifest.name}@${nextVersion} is already published.`);
}

if (publish) {
  const npmUser = capture("npm", ["whoami"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (npmUser.status !== 0) {
    throw new Error("npm auth is not configured. Run npm login, then retry.");
  }

  console.log(`Publishing as npm user: ${npmUser.stdout.trim()}`);
}

manifest.version = nextVersion;
await writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated ${manifest.name}: ${currentVersion} -> ${nextVersion}`);

run("bun", ["install", "--lockfile-only"]);
run("bun", ["run", "packages:peer-check"]);
for (const gate of GATES) {
  run("bun", ["run", `${packageName}:${gate}`]);
}

if (publish) {
  run("npm", ["publish", "--access", "public"], { cwd: packageDir });
  run("npm", ["view", `${manifest.name}@${nextVersion}`, "version"]);
  console.log(`Published ${manifest.name}@${nextVersion}`);
} else {
  console.log(`Release dry run passed for ${manifest.name}@${nextVersion}.`);
  console.log("Rerun with --publish to publish this version.");
}
