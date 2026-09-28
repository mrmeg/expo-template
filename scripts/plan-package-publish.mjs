#!/usr/bin/env node
/**
 * Decide what `.github/workflows/publish-packages.yml` publishes.
 *
 * Push to main: every package in `scripts/lib/workspacePackages.mjs` whose
 * version changed in the push (`--before` against the checkout) and is not on
 * npm yet, released as the committed version. A package npm has never seen is
 * skipped on push whatever the credentials: a first publish is a deliberate
 * manual run, because npm trusted publishing cannot be configured for a package
 * that does not exist yet, so it needs the `NPM_TOKEN` secret.
 *
 * Manual run: the one package named, with the requested bump or exact version.
 * Fails early when that exact version is already published, or when a first
 * publish has no `NPM_TOKEN` to publish with.
 *
 * Writes `matrix` (JSON), `count`, and `sha` to `$GITHUB_OUTPUT` when set, and
 * prints the matrix either way.
 *
 * Usage:
 *   node scripts/plan-package-publish.mjs --event push --before <sha>
 *   node scripts/plan-package-publish.mjs --event workflow_dispatch --package <key> --version <bump|x.y.z> [--has-token]
 *   (--registry <url> and --root <dir> exist for tests.)
 */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchPackument, registryFor } from "./lib/npmRegistry.mjs";
import { PACKAGE_KEYS, readManifest, SORTED_PACKAGE_KEYS, WORKSPACE_PACKAGES } from "./lib/workspacePackages.mjs";

const BUMPS = ["patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease"];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parseArgs(argv) {
  const options = {
    event: process.env.GITHUB_EVENT_NAME,
    before: undefined,
    package: undefined,
    version: undefined,
    hasToken: process.env.HAS_NPM_TOKEN === "true",
    registry: undefined,
    root: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--has-token") {
      options.hasToken = true;
      continue;
    }
    const key = { "--event": "event", "--before": "before", "--package": "package", "--version": "version", "--registry": "registry", "--root": "root" }[arg];
    if (!key) throw new Error(`unknown argument "${arg}"`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${arg} needs a value`);
    options[key] = key === "root" ? resolve(value) : value;
    index += 1;
  }
  return options;
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

/** The version `<dir>/package.json` had at `sha`, or null when that cannot be read. */
function versionAt(root, sha, dir) {
  if (!sha || /^0+$/.test(sha)) return null;
  const show = git(root, ["show", `${sha}:${dir}/package.json`]);
  if (show.status !== 0) return null;
  try {
    return JSON.parse(show.stdout).version ?? null;
  } catch {
    return null;
  }
}

async function planPush(options) {
  const matrix = [];
  for (const key of PACKAGE_KEYS) {
    const manifest = readManifest(options.root, key);
    const id = `${manifest.name}@${manifest.version}`;
    if (manifest.private === true) continue;

    const previous = versionAt(options.root, options.before, WORKSPACE_PACKAGES[key].dir);
    if (previous === manifest.version) {
      console.log(`skip ${id}: version unchanged in this push`);
      continue;
    }

    const packument = await fetchPackument(registryFor(manifest, options.registry), manifest.name);
    if (!packument) {
      console.log(
        `::notice::${manifest.name} is not on npm yet, and a first publish never runs on push. ` +
          `Add the NPM_TOKEN secret, then run Publish Packages manually with package=${key} version=${manifest.version}.`,
      );
      continue;
    }
    if (packument.versions?.[manifest.version]) {
      console.log(`skip ${id}: already on npm`);
      continue;
    }

    console.log(`publish ${id}${previous ? ` (was ${previous})` : ""}`);
    matrix.push({ package: key, name: manifest.name, release: manifest.version });
  }
  return matrix;
}

async function planDispatch(options) {
  const key = options.package;
  if (!WORKSPACE_PACKAGES[key]) {
    throw new Error(`unknown package "${key ?? ""}". Expected one of: ${SORTED_PACKAGE_KEYS.join(", ")}`);
  }
  const release = options.version;
  if (!BUMPS.includes(release) && !EXACT_VERSION.test(release ?? "")) {
    throw new Error(`invalid version "${release ?? ""}". Use ${BUMPS.slice(0, 3).join(", ")}, or an exact x.y.z.`);
  }

  const manifest = readManifest(options.root, key);
  const packument = await fetchPackument(registryFor(manifest, options.registry), manifest.name);
  if (!packument && !options.hasToken) {
    throw new Error(
      `${manifest.name} is not on npm yet. A first publish cannot use trusted publishing (npm has no ` +
        "settings page for a package that does not exist): add a repository secret NPM_TOKEN with publish " +
        "access to the scope, rerun this workflow, then configure trusted publishing for publish-packages.yml.",
    );
  }
  if (EXACT_VERSION.test(release) && packument?.versions?.[release]) {
    throw new Error(`${manifest.name}@${release} is already published.`);
  }

  console.log(`release ${manifest.name} ${release} (committed ${manifest.version})`);
  return [{ package: key, name: manifest.name, release }];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let matrix;
  if (options.event === "push") matrix = await planPush(options);
  else if (options.event === "workflow_dispatch") matrix = await planDispatch(options);
  else throw new Error(`--event must be push or workflow_dispatch, got "${options.event ?? ""}"`);

  const sha = git(options.root, ["rev-parse", "HEAD"]).stdout.trim();
  const json = JSON.stringify(matrix);
  console.log(`matrix=${json}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${json}\ncount=${matrix.length}\nsha=${sha}\n`);
  }
}

main().catch((error) => {
  console.error(`plan-package-publish: ${error.message}`);
  process.exit(1);
});
