import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import semver from "semver";

const root = process.cwd();
const packageDir = join(root, "packages/media");
const packageJsonPath = join(packageDir, "package.json");

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

function usage() {
  console.log(`
Usage:
  bun run media:release -- [patch|minor|major|x.y.z] [--publish] [--allow-dirty]
  bun run media:release -- --patch [--publish] [--allow-dirty]

Examples:
  bun run media:release
  bun run media:release -- --patch --publish
  bun run media:release -- minor
  bun run media:release -- 0.3.0 --publish

Defaults:
  - version bump: patch
  - publish: false

The command updates packages/media/package.json and bun.lock, then runs:
  bun run packages:peer-check
  bun run media:typecheck
  bun run media:test
  bun run media:build
  bun run media:pack
  bun run media:consumer-smoke

Pass --publish to run npm publish --access public after all gates pass.
`);
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const publish = args.includes("--publish");
const allowDirty = args.includes("--allow-dirty");
const bumpFlags = args.filter((arg) => ["--patch", "--minor", "--major"].includes(arg));
const positional = args.filter((arg) => !arg.startsWith("-"));

if (positional.length > 1) {
  usage();
  throw new Error(`Expected at most one version argument, received: ${positional.join(", ")}`);
}

if (bumpFlags.length > 1 || (bumpFlags.length === 1 && positional.length === 1)) {
  usage();
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
  console.error("  git add -A && git commit -m \"chore: prepare media package release\"");
  console.error(`  bun run media:release -- --${bump} ${publish ? "--publish" : ""}`.trimEnd());
  console.error("");
  console.error("Or intentionally release from local changes:");
  console.error(`  bun run media:release -- --${bump} ${publish ? "--publish " : ""}--allow-dirty`);
  throw new Error("Working tree has uncommitted changes.");
}

const mediaPackage = JSON.parse(await readFile(packageJsonPath, "utf8"));
const currentVersion = mediaPackage.version;
const nextVersion = semver.valid(bump) ?? semver.inc(currentVersion, bump);

if (!nextVersion) {
  usage();
  throw new Error(`Invalid version bump "${bump}". Use patch, minor, major, or an exact x.y.z version.`);
}

if (semver.lte(nextVersion, currentVersion)) {
  throw new Error(`Next version ${nextVersion} must be greater than current version ${currentVersion}.`);
}

const alreadyPublished = capture("npm", ["view", `${mediaPackage.name}@${nextVersion}`, "version"], {
  stdio: ["ignore", "pipe", "pipe"],
});

if (alreadyPublished.status === 0 && alreadyPublished.stdout.trim() === nextVersion) {
  throw new Error(`${mediaPackage.name}@${nextVersion} is already published.`);
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

mediaPackage.version = nextVersion;
await writeFile(packageJsonPath, `${JSON.stringify(mediaPackage, null, 2)}\n`);
console.log(`Updated ${mediaPackage.name}: ${currentVersion} -> ${nextVersion}`);

run("bun", ["install", "--lockfile-only"]);
run("bun", ["run", "packages:peer-check"]);
run("bun", ["run", "media:typecheck"]);
run("bun", ["run", "media:test"]);
run("bun", ["run", "media:build"]);
run("bun", ["run", "media:pack"]);
run("bun", ["run", "media:consumer-smoke"]);

if (publish) {
  run("npm", ["publish", "--access", "public"], { cwd: packageDir });
  run("npm", ["view", `${mediaPackage.name}@${nextVersion}`, "version"]);
  console.log(`Published ${mediaPackage.name}@${nextVersion}`);
} else {
  console.log(`Release dry run passed for ${mediaPackage.name}@${nextVersion}.`);
  console.log("Rerun with --publish to publish this version.");
}
