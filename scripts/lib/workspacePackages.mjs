/**
 * The publishable workspace packages, keyed by the short name every package
 * tool takes on its command line (`bun run pkg <name> <task>`).
 *
 * This is the one list. The `pkg` runner, the release script, `verify`'s
 * package typecheck gates, the publish-drift gate, and the publish workflow's
 * plan all read it, so adding a package is one entry here. (The package also
 * needs a consumer-smoke fixture in `scripts/check-package-consumer.mjs`, which
 * refuses a package it has none for — the publish workflow runs that smoke.)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const WORKSPACE_PACKAGES = {
  ui: { dir: "packages/ui" },
  media: { dir: "packages/media" },
  purchases: { dir: "packages/purchases" },
  lint: { dir: "packages/lint" },
};

/** Short names in table order: the order gates and plans run in. */
export const PACKAGE_KEYS = Object.keys(WORKSPACE_PACKAGES);

/** Short names sorted, for error messages and usage text. */
export const SORTED_PACKAGE_KEYS = [...PACKAGE_KEYS].sort();

/** @returns {{ name: string, version: string } & Record<string, any>} */
export function readManifest(root, key) {
  return JSON.parse(readFileSync(join(root, WORKSPACE_PACKAGES[key].dir, "package.json"), "utf8"));
}

/**
 * Git tag for a release: the package name without its scope, `-v`, the version.
 * `@mrmeg/expo-ui@0.1.2` is `expo-ui-v0.1.2`, the one tag that predates this.
 */
export function releaseTag(name, version) {
  return `${name.replace(/^@[^/]+\//, "")}-v${version}`;
}

/** The file `bun pm pack` writes: `@mrmeg/expo-ui@0.27.1` is `mrmeg-expo-ui-0.27.1.tgz`. */
export function tarballName(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}
