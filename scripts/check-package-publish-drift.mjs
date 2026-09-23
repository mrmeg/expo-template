#!/usr/bin/env node
/**
 * Publish-drift gate: a workspace package whose version is already on npm must
 * still describe what npm has.
 *
 * For every package in `scripts/lib/workspacePackages.mjs`, compares the local
 * manifest's consumer-facing fields (`FIELDS` below) against the manifest inside
 * the published tarball for the same version. Any difference means the package's
 * contents changed without a version bump: consumers of that version would keep
 * resolving the old dependency, peer, or export surface, and the next release of
 * that version number is impossible. Bump the version to fix it.
 *
 * Skipped: private packages, packages npm has never seen, and versions npm does
 * not have yet (a bumped, unreleased version has nothing to drift from).
 *
 * If the registry cannot be reached the gate warns and passes locally, so an
 * offline `bun run verify` still works, but fails in CI (`CI` is set), where a
 * silently skipped gate would read as a pass.
 *
 * Usage:
 *   node scripts/check-package-publish-drift.mjs [<package>...] [--registry <url>] [--root <dir>]
 */
import { resolve } from "node:path";
import {
  fetchPackument,
  fetchPublishedManifest,
  registryFor,
  RegistryUnreachableError,
} from "./lib/npmRegistry.mjs";
import { PACKAGE_KEYS, readManifest, SORTED_PACKAGE_KEYS, WORKSPACE_PACKAGES } from "./lib/workspacePackages.mjs";

/** The manifest fields whose change a consumer can observe without reading the code. */
const FIELDS = ["dependencies", "peerDependencies", "peerDependenciesMeta", "exports", "files"];

const LABEL = "packages:drift-check";

function usage() {
  console.log(`
Usage:
  bun run packages:drift-check [<package>...] [--registry <url>]

Fails when a package version already on npm has local ${FIELDS.join(", ")}
that differ from the published manifest — contents changed without a version bump.
Packages: ${SORTED_PACKAGE_KEYS.join(", ")} (default: all).
`);
}

/**
 * A comparable form of one field. Dependency maps and `files` are unordered;
 * inside `exports`, subpath keys ("." and "./x") are unordered but condition
 * keys ("types", "default", …) are not, because resolution takes the first
 * matching condition.
 */
function canonical(fieldName, value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : fieldName === "files" ? [...value].sort() : value;
  }
  if (typeof value !== "object") return value;

  const keys = Object.keys(value);
  if (keys.length === 0) return undefined;
  const ordered = fieldName === "exports" && !keys.every((key) => key.startsWith("."));
  const out = {};
  for (const key of ordered ? keys : [...keys].sort()) {
    out[key] = canonical(fieldName, value[key]);
  }
  return out;
}

const show = (value) => (value === undefined ? "(absent)" : JSON.stringify(value));

/** One line per differing key, so the message names what moved. */
function describeDifference(fieldName, local, published) {
  const isMap = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (fieldName === "files" || !isMap(local) || !isMap(published)) {
    return [`  ${fieldName}: npm ${show(published)}, local ${show(local)}`];
  }
  const keys = [...new Set([...Object.keys(published), ...Object.keys(local)])].sort();
  return keys
    .filter((key) => JSON.stringify(published[key]) !== JSON.stringify(local[key]))
    .map((key) => `  ${fieldName}.${key}: npm ${show(published[key])}, local ${show(local[key])}`);
}

function parseArgs(argv) {
  const options = { root: process.cwd(), registry: undefined, packages: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else if (arg === "--registry" || arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} needs a value`);
      options[arg.slice(2)] = arg === "--root" ? resolve(value) : value;
      index += 1;
    } else if (WORKSPACE_PACKAGES[arg]) {
      options.packages.push(arg);
    } else {
      throw new Error(`unknown package or option "${arg}". Packages: ${SORTED_PACKAGE_KEYS.join(", ")}`);
    }
  }
  if (options.packages.length === 0) options.packages = PACKAGE_KEYS;
  return options;
}

async function checkPackage(key, { root, registry }) {
  const local = readManifest(root, key);
  const id = `${local.name}@${local.version}`;

  if (local.private === true) return { status: "skipped", message: `${local.name} is private` };

  const packument = await fetchPackument(registryFor(local, registry), local.name);
  if (!packument) return { status: "skipped", message: `${local.name} is not on npm yet` };

  const entry = packument.versions?.[local.version];
  if (!entry) return { status: "skipped", message: `${id} is not on npm yet (unreleased version)` };

  const published = await fetchPublishedManifest(entry);
  const details = [];
  const drifted = [];
  for (const fieldName of FIELDS) {
    const localValue = canonical(fieldName, local[fieldName]);
    const publishedValue = canonical(fieldName, published[fieldName]);
    if (JSON.stringify(localValue) !== JSON.stringify(publishedValue)) {
      drifted.push(fieldName);
      details.push(...describeDifference(fieldName, localValue, publishedValue));
    }
  }

  if (drifted.length === 0) return { status: "ok", message: `${id} matches npm` };
  return {
    status: "drift",
    message: [
      `${id} is already on npm, but the local ${drifted.join(", ")} differ from what it shipped:`,
      ...details,
      `  Contents changed without a version bump. Bump ${local.name} (e.g. \`bun run pkg ${key} release -- --patch\`, or set a new version in ${WORKSPACE_PACKAGES[key].dir}/package.json).`,
    ].join("\n"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inCi = Boolean(process.env.CI) && process.env.CI !== "false";
  let failed = false;

  for (const key of options.packages) {
    try {
      const result = await checkPackage(key, options);
      if (result.status === "drift") {
        failed = true;
        console.error(`${LABEL}: FAIL ${result.message}`);
      } else {
        console.log(`${LABEL}: ${result.status === "ok" ? "ok" : "skip"} ${result.message}`);
      }
    } catch (error) {
      if (!(error instanceof RegistryUnreachableError)) throw error;
      if (inCi) {
        failed = true;
        console.error(`${LABEL}: FAIL ${key}: registry unreachable, and CI cannot skip this gate. ${error.message}`);
      } else {
        console.warn(`${LABEL}: WARN ${key}: registry unreachable, drift not checked. ${error.message}`);
      }
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`${LABEL}: ${error.message}`);
  process.exit(1);
});
