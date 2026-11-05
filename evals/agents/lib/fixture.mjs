/**
 * The app an agent works in: a minimal Expo Router consumer installed from
 * freshly packed tarballs of `@mrmeg/expo-ui`, `expo-media`, `expo-purchases`
 * and the lint plugin, the way a real app installs them.
 *
 * Built once per run (`buildFixture`), then cloned into a fresh temp directory
 * for every trial (`cloneFixture`), so a trial starts from the same installed
 * tree and can never see another trial's work. The pack and install helpers are
 * the consumer smoke's (`scripts/lib/packageConsumer.mjs`).
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { bunInstallWithRetry } from "../../../scripts/lib/bunInstallWithRetry.mjs";
import { createPackager, dependencyVersion, json, readJson, run, writeFiles } from "../../../scripts/lib/packageConsumer.mjs";

const FIXTURE_SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "fixture");
const MARKER = ".eval-fixture.json";

/** Packages the fixture installs from tarballs. The lint plugin is a dev dependency, as its README says. */
const FIXTURE_PACKAGES = [
  { dir: "packages/ui" },
  { dir: "packages/media" },
  { dir: "packages/purchases" },
  { dir: "packages/lint", dev: true },
];

/** What an Expo Router app needs on top of the packages' own peers. */
const APP_DEPENDENCIES = [
  "expo-router",
  "expo-linking",
  "expo-constants",
  "react-dom",
  "react-native-reanimated",
  "react-native-worklets",
  "@expo/metro-runtime",
];

const DEV_DEPENDENCIES = ["typescript", "@types/react", "eslint", "@typescript-eslint/parser"];

const SKIPPED = new Set(["node_modules", ".expo", ".git"]);

/** The base AGENTS.md every variant starts from: stack and commands only. */
export function readBaseGuidance() {
  return readFileSync(join(FIXTURE_SOURCE, "AGENTS.base.md"), "utf8");
}

/**
 * Build the fixture into `dir` (created empty or reused by the caller): pack the
 * four packages, write the app, install, and generate the icon module.
 *
 * @param {{ root: string, dir: string }} options
 * @returns {Promise<{ packages: Record<string, string> }>}
 */
export async function buildFixture({ root, dir }) {
  const scratchDirs = [];
  try {
    const pack = createPackager({ root, scratchDirs });
    const rootPackage = await readJson(join(root, "package.json"));

    const dependencies = {};
    const devDependencies = {};
    const installedVersions = {};
    const peers = {};
    for (const entry of FIXTURE_PACKAGES) {
      const manifest = await readJson(join(root, entry.dir, "package.json"));
      const tarball = await pack(entry.dir);
      (entry.dev ? devDependencies : dependencies)[manifest.name] = tarball;
      installedVersions[manifest.name] = manifest.version;
      for (const name of Object.keys(manifest.peerDependencies ?? {})) {
        if (name.startsWith("@mrmeg/")) continue;
        peers[name] ??= dependencyVersion(name, rootPackage, manifest);
      }
    }
    for (const name of APP_DEPENDENCIES) {
      peers[name] ??= dependencyVersion(name, rootPackage, {});
    }
    for (const name of DEV_DEPENDENCIES) {
      devDependencies[name] = dependencyVersion(name, rootPackage, {});
    }
    const unpinned = [...Object.entries(peers), ...Object.entries(devDependencies)].filter(([, version]) => !version);
    if (unpinned.length > 0) {
      throw new Error(`No version to install for: ${unpinned.map(([name]) => name).join(", ")}`);
    }

    const packageJson = {
      name: "agent-eval-app",
      private: true,
      main: "expo-router/entry",
      dependencies: { ...peers, ...dependencies },
      devDependencies,
    };
    mkdirSync(dir, { recursive: true });
    cpSync(FIXTURE_SOURCE, dir, { recursive: true, filter: (path) => !path.endsWith("AGENTS.base.md") });
    await writeFiles(dir, { "package.json": json(packageJson) });

    bunInstallWithRetry(["install"], dir);
    // The icon module the layout imports, compiled from client/icons.json by the
    // bin the installed package ships.
    run("bun", ["x", "expo-ui-icons"], { cwd: dir });

    // The tarballs are deleted with `scratchDirs`: name the installed releases so
    // package.json stays readable and nothing points at a vanished file.
    const installed = { ...packageJson, dependencies: { ...packageJson.dependencies }, devDependencies: { ...devDependencies } };
    for (const [name, version] of Object.entries(installedVersions)) {
      if (name in installed.dependencies) installed.dependencies[name] = version;
      if (name in installed.devDependencies) installed.devDependencies[name] = version;
    }
    writeFileSync(join(dir, "package.json"), json(installed));
    rmSync(join(dir, "bun.lock"), { force: true });
    rmSync(join(dir, "bun.lockb"), { force: true });

    const marker = { builtAt: new Date().toISOString(), packages: installedVersions };
    writeFileSync(join(dir, MARKER), json(marker));
    return marker;
  } finally {
    for (const scratch of scratchDirs) await rm(scratch, { recursive: true, force: true });
  }
}

/** The marker `buildFixture` wrote, or null when `dir` holds no finished fixture. */
export function readFixtureMarker(dir) {
  const path = join(dir, MARKER);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

/**
 * A fresh copy of the built fixture in a new temp directory. `cp -c` clones on
 * APFS, so the installed tree costs no time or space; elsewhere it is a plain copy.
 *
 * @returns {Promise<string>} the clone's path
 */
export async function cloneFixture(source, prefix = "agent-eval-trial-") {
  const dest = await mkdtemp(join(tmpdir(), prefix));
  let result = spawnSync("cp", ["-cR", `${source}/.`, dest], { stdio: "ignore" });
  if (result.status !== 0) result = spawnSync("cp", ["-R", `${source}/.`, dest], { stdio: "ignore" });
  if (result.status !== 0) throw new Error(`Could not copy the fixture from ${source} to ${dest}`);
  rmSync(join(dest, MARKER), { force: true });
  return dest;
}

/** SHA-1 of every file outside `node_modules`, keyed by app-relative path. */
export function snapshot(dir) {
  const hashes = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      if (SKIPPED.has(entry) || entry.endsWith(".tsbuildinfo")) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        hashes.set(relative(dir, full).split("\\").join("/"), createHash("sha1").update(readFileSync(full)).digest("hex"));
      }
    }
  };
  walk(dir);
  return hashes;
}

/** Files added or changed between two snapshots, sorted. */
export function changedFiles(before, after) {
  const changed = [];
  for (const [path, hash] of after) {
    if (before.get(path) !== hash) changed.push(path);
  }
  return changed.sort();
}

/** Write one reference solution's files over an app: used to score the committed good and bad fixtures. */
export function overlayFiles(appDir, fixtureDir) {
  const written = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const target = join(appDir, relative(fixtureDir, full));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(full));
        written.push(relative(fixtureDir, full).split("\\").join("/"));
      }
    }
  };
  walk(fixtureDir);
  return written.sort();
}

function tail(text, lines = 40) {
  const all = text.trimEnd().split("\n");
  return all.slice(-lines).join("\n");
}

/** `tsc --noEmit` in the app, with the compiler the fixture installed. */
export function typecheck(appDir) {
  const result = spawnSync(process.execPath, [join(appDir, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "."], {
    cwd: appDir,
    encoding: "utf8",
    timeout: 300_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    pass: result.status === 0,
    errors: (output.match(/error TS\d+/g) ?? []).length,
    output: tail(output),
  };
}

/**
 * The design-system rule violations in `files`, from the lint plugin the fixture
 * installed (`expo-ui-lint`). Every rule is an error in the recommended config.
 *
 * @param {string} appDir
 * @param {string[]} files app-relative `.ts`/`.tsx` paths
 */
export function designLint(appDir, files) {
  const sources = files.filter((file) => /\.(ts|tsx)$/.test(file) && existsSync(join(appDir, file)));
  if (sources.length === 0) return { errors: 0, files: 0, failed: false, output: "" };

  const cli = join(appDir, "node_modules", "@mrmeg", "eslint-plugin-expo-ui", "bin", "cli.js");
  const result = spawnSync(process.execPath, [cli, ...sources], { cwd: appDir, encoding: "utf8", timeout: 300_000 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  // Exit 0: clean. 1: violations. 2: the lint run itself failed.
  if (result.status === 0) return { errors: 0, files: sources.length, failed: false, output: tail(output, 10) };
  if (result.status === 1) {
    const count = Number(/✗ (\d+) design-system violations?/.exec(output)?.[1] ?? "1");
    return { errors: count, files: sources.length, failed: false, output: tail(output) };
  }
  return { errors: null, files: sources.length, failed: true, output: tail(output) };
}
