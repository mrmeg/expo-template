#!/usr/bin/env node
/**
 * Release a workspace package: set the version, run every gate, pack once,
 * smoke-test that tarball, and optionally publish that same tarball.
 *
 * One script for every package in `scripts/lib/workspacePackages.mjs`, run
 * locally (`bun run pkg <package> release`) and by
 * `.github/workflows/publish-packages.yml`, which publishes the tarball this
 * script leaves in `--pack-destination` with provenance.
 *
 * Usage:
 *   node scripts/release-package.mjs <package> [patch|minor|major|x.y.z] [--publish] [--allow-dirty] [--pack-destination <dir>]
 *
 * An exact version equal to the committed one releases it as is, without a
 * bump: the way to retry a release whose bump already landed. `--registry <url>`
 * points the "already published?" check at another registry (tests use it).
 *
 * In GitHub Actions the script also writes `name`, `dir`, `version`, `tag`,
 * `tarball`, `bumped`, and `prerelease` to `$GITHUB_OUTPUT` once every gate passed.
 */
import { appendFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import semver from "semver";
import { fetchPackument, registryFor, RegistryUnreachableError } from "./lib/npmRegistry.mjs";
import { releaseTag, SORTED_PACKAGE_KEYS, tarballName, WORKSPACE_PACKAGES } from "./lib/workspacePackages.mjs";

/** `bun run pkg <package> <gate>` gates, in order, before the one pack. */
const GATES = ["typecheck", "test", "build"];

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

/** The version a bump argument resolves to, or null when it is not one. */
function nextVersionFor(currentVersion, bump) {
  return semver.valid(bump) ?? semver.inc(currentVersion, bump);
}

async function usage(packageName) {
  const target = WORKSPACE_PACKAGES[packageName];
  const slug = target ? packageName : "<package>";
  const dir = target?.dir ?? "packages/<package>";
  let current = "x.y.z";
  let next = "x.y.z";
  if (target) {
    current = JSON.parse(await readFile(join(root, dir, "package.json"), "utf8")).version;
    next = semver.inc(current, "minor") ?? next;
  }

  console.log(`
Usage:
  bun run pkg ${slug} release -- [patch|minor|major|x.y.z] [--publish] [--allow-dirty] [--pack-destination <dir>]

Packages: ${SORTED_PACKAGE_KEYS.join(", ")}

Examples:
  bun run pkg ${slug} release
  bun run pkg ${slug} release -- --patch --publish
  bun run pkg ${slug} release -- minor
  bun run pkg ${slug} release -- ${next} --publish
  bun run pkg ${slug} release -- ${current}        # the committed version: no bump (retry a release)

Defaults:
  - version bump: patch
  - publish: false

The command sets the version in ${dir}/package.json and bun.lock, then runs:
  bun run packages:peer-check
${GATES.map((gate) => `  bun run pkg ${slug} ${gate}`).join("\n")}
  bun pm pack                                      (in ${dir}: the one tarball)
  bun run pkg ${slug} consumer-smoke -- --tarball <that tarball>

Pass --publish to run npm publish <that tarball> --access public after every gate
passes. --pack-destination keeps the tarball in <dir> instead of a temp directory.
`);
}

function parseArgs(args) {
  const options = { publish: false, allowDirty: false, packDestination: null, registry: undefined, positional: [], bumpFlags: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--publish") options.publish = true;
    else if (arg === "--allow-dirty") options.allowDirty = true;
    else if (["--patch", "--minor", "--major"].includes(arg)) options.bumpFlags.push(arg.slice(2));
    else if (arg === "--pack-destination" || arg === "--registry") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`${arg} needs a value.`);
      if (arg === "--registry") options.registry = value;
      else options.packDestination = resolve(value);
      index += 1;
    } else if (arg === "--") continue;
    else if (arg.startsWith("-")) throw new Error(`Unknown option "${arg}".`);
    else options.positional.push(arg);
  }
  return options;
}

/** Append `key=value` lines to the step's outputs when running in GitHub Actions. */
function writeActionsOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
}

const argv = process.argv.slice(2);
const [packageName, ...args] = argv;

if (argv.includes("--help") || argv.includes("-h")) {
  await usage(packageName);
  process.exit(0);
}

const target = WORKSPACE_PACKAGES[packageName];

if (!target) {
  await usage(packageName);
  throw new Error(
    `Unknown package "${packageName ?? ""}". Expected one of: ${SORTED_PACKAGE_KEYS.join(", ")}.`
  );
}

const packageDir = join(root, target.dir);
const packageJsonPath = join(packageDir, "package.json");
const options = parseArgs(args);

if (options.positional.length > 1) {
  await usage(packageName);
  throw new Error(`Expected at most one version argument, received: ${options.positional.join(", ")}`);
}

if (options.bumpFlags.length > 1 || (options.bumpFlags.length === 1 && options.positional.length === 1)) {
  await usage(packageName);
  throw new Error("Use only one version bump: patch, minor, major, --patch, --minor, --major, or x.y.z.");
}

const bump = options.positional[0] ?? options.bumpFlags[0] ?? "patch";

const status = capture("git", ["status", "--short"]);
if (status.status !== 0) {
  throw new Error("Could not inspect git status.");
}

const releaseCommand = `bun run pkg ${packageName} release -- ${semver.valid(bump) ? bump : `--${bump}`}${options.publish ? " --publish" : ""}`;
if (!options.allowDirty && status.stdout.trim()) {
  console.error("Working tree has uncommitted changes:");
  console.error(status.stdout.trim());
  console.error("");
  console.error("Commit current changes first, then rerun:");
  console.error(`  git add -A && git commit -m "chore: prepare ${packageName} package release"`);
  console.error(`  ${releaseCommand}`);
  console.error("");
  console.error("Or intentionally release from local changes:");
  console.error(`  ${releaseCommand} --allow-dirty`);
  throw new Error("Working tree has uncommitted changes.");
}

const manifest = JSON.parse(await readFile(packageJsonPath, "utf8"));
const currentVersion = manifest.version;
const nextVersion = nextVersionFor(currentVersion, bump);

if (!nextVersion) {
  await usage(packageName);
  throw new Error(`Invalid version bump "${bump}". Use patch, minor, major, or an exact x.y.z version.`);
}

const bumped = nextVersion !== currentVersion;
if (bumped && semver.lte(nextVersion, currentVersion)) {
  throw new Error(`Next version ${nextVersion} must be greater than current version ${currentVersion}.`);
}

try {
  const packument = await fetchPackument(registryFor(manifest, options.registry), manifest.name);
  if (packument?.versions?.[nextVersion]) {
    throw new Error(`${manifest.name}@${nextVersion} is already published.`);
  }
} catch (error) {
  if (!(error instanceof RegistryUnreachableError)) throw error;
  if (options.publish) {
    throw new Error(`Cannot confirm ${manifest.name}@${nextVersion} is unpublished: ${error.message}`, { cause: error });
  }
  console.warn(`Could not reach the registry, so not checking whether ${nextVersion} is taken: ${error.message}`);
}

if (options.publish) {
  const npmUser = capture("npm", ["whoami"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (npmUser.status !== 0) {
    throw new Error("npm auth is not configured. Run npm login, then retry.");
  }

  console.log(`Publishing as npm user: ${npmUser.stdout.trim()}`);
}

if (bumped) {
  manifest.version = nextVersion;
  await writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${manifest.name}: ${currentVersion} -> ${nextVersion}`);
  run("bun", ["install", "--lockfile-only"]);
} else {
  console.log(`Releasing the committed ${manifest.name}@${nextVersion} (no bump).`);
}

const packDestination = options.packDestination ?? (await mkdtemp(join(tmpdir(), "expo-package-release-")));
const tarball = join(packDestination, tarballName(manifest.name, nextVersion));

try {
  run("bun", ["run", "packages:peer-check"]);
  for (const gate of GATES) {
    run("bun", ["run", "pkg", packageName, gate]);
  }

  // The one pack: the consumer smoke installs this file and --publish uploads it.
  await mkdir(packDestination, { recursive: true });
  run("bun", ["pm", "pack", "--destination", packDestination, "--quiet"], { cwd: packageDir });
  run("bun", ["run", "pkg", packageName, "consumer-smoke", "--tarball", tarball]);

  writeActionsOutputs({
    name: manifest.name,
    dir: target.dir,
    version: nextVersion,
    tag: releaseTag(manifest.name, nextVersion),
    tarball,
    bumped: String(bumped),
    prerelease: String(semver.prerelease(nextVersion) !== null),
  });

  if (options.publish) {
    const distTag = semver.prerelease(nextVersion) ? ["--tag", "next"] : [];
    run("npm", ["publish", tarball, "--access", "public", ...distTag]);
    run("npm", ["view", `${manifest.name}@${nextVersion}`, "version"]);
    console.log(`Published ${manifest.name}@${nextVersion}`);
  } else {
    console.log(`Every gate passed for ${manifest.name}@${nextVersion}; the tarball is ${tarball}.`);
    console.log("Not published: rerun with --publish to upload that tarball.");
  }
} finally {
  if (!options.packDestination) await rm(packDestination, { recursive: true, force: true });
}
