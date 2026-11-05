/**
 * The pack-and-install helpers every throwaway consumer fixture needs: run a
 * command, pack a workspace package into a tarball once, work out which version
 * a fixture installs a peer at, and write a fixture's files.
 *
 * `scripts/check-package-consumer.mjs` (the consumer smoke) and
 * `scripts/run-agent-evals.mjs` (the agent eval fixture) share these, so the app
 * an agent is graded in is installed from the same freshly packed tarballs the
 * smoke approves.
 */
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tarballName } from "./workspacePackages.mjs";

/** Run a command, inheriting stdio unless `options` says otherwise; throw on a non-zero exit. */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Fixture manifests are written pretty-printed so failures are readable. */
export const json = (value) => JSON.stringify(value, null, 2);

/**
 * Version a fixture should install a peer with. Prefers whatever the template
 * itself is pinned to, then the package's own pins (a devDependency is the
 * version the package was typed and tested against), then the peer range.
 */
export function dependencyVersion(name, rootPackage, manifest) {
  return (
    rootPackage.dependencies?.[name] ??
    rootPackage.devDependencies?.[name] ??
    manifest.dependencies?.[name] ??
    manifest.devDependencies?.[name] ??
    manifest.peerDependencies?.[name]
  );
}

export async function assertFileExists(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing packed file for ${label}: ${path}`);
  }
}

/**
 * Write `files` (relative path to contents) under `dir`, creating directories.
 *
 * @param {string} dir
 * @param {Record<string, string>} files
 */
export async function writeFiles(dir, files) {
  for (const [name, contents] of Object.entries(files)) {
    const file = join(dir, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
}

/**
 * Builds and packs workspace packages, once each.
 *
 * `provided` maps a package directory to a tarball that is used as is, skipping
 * the build and pack: the release flow packs once and hands that file to the
 * smoke, so the file the smoke approved is the file `npm publish` uploads.
 * Every destination directory is pushed to `scratchDirs` for the caller to remove.
 *
 * @param {{ root: string, scratchDirs: string[], provided?: Map<string, string> }} options
 * @returns {(dir: string) => Promise<string>} resolves a package directory
 *   (repo-relative) to the absolute path of its tarball
 */
export function createPackager({ root, scratchDirs, provided = new Map() }) {
  /** Tarballs by package directory, so each one is built and packed once. */
  const tarballs = new Map(provided);

  return async function packWorkspacePackage(dir) {
    const existing = tarballs.get(dir);
    if (existing) return existing;

    const manifest = await readJson(join(root, dir, "package.json"));
    const destination = await mkdtemp(join(tmpdir(), "expo-package-pack-"));
    scratchDirs.push(destination);
    run("bun", ["run", "--cwd", dir, "build"], { cwd: root });
    run("bun", ["pm", "pack", "--destination", destination, "--quiet"], { cwd: join(root, dir) });
    const tarball = join(destination, tarballName(manifest.name, manifest.version));
    await assertFileExists(tarball, `${manifest.name} tarball`);
    tarballs.set(dir, tarball);
    return tarball;
  };
}
