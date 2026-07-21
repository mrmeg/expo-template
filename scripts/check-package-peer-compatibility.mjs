import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import semver from "semver";
import { packageCompatibilityProfiles as profiles } from "./package-compatibility-profiles.mjs";

const root = process.cwd();

function packageName(specifier) {
  if (specifier.startsWith("node:") || specifier.startsWith(".") || specifier.startsWith("/")) {
    return null;
  }
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return [".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

async function runtimeImports(packageDir) {
  const imports = new Map();
  for (const file of await sourceFiles(join(packageDir, "src"))) {
    const source = (await readFile(file, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const patterns = [
      /\bfrom\s+["']([^"']+)["']/g,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
      /\bimport\s+["']([^"']+)["']/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const name = packageName(match[1]);
        if (!name) continue;
        const files = imports.get(name) ?? new Set();
        files.add(relative(root, file));
        imports.set(name, files);
      }
    }
  }
  return imports;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkPackage(key) {
  const packageDir = join(root, "packages", key);
  const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  const declared = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  };

  for (const [name, files] of await runtimeImports(packageDir)) {
    assert(
      declared[name],
      `${manifest.name} imports undeclared runtime dependency ${name} in ${[...files].join(", ")}`,
    );
  }

  for (const profile of profiles[key]) {
    for (const [name, version] of Object.entries(profile.versions)) {
      const range = manifest.peerDependencies?.[name];
      assert(range, `${manifest.name} is missing ${name} from peerDependencies`);
      assert(
        semver.satisfies(version, range),
        `${manifest.name} peer ${name}@${range} rejects ${profile.name} version ${version}`,
      );
    }
  }

  if (key === "media") {
    for (const name of Object.keys(manifest.peerDependencies ?? {})) {
      assert(
        manifest.peerDependenciesMeta?.[name]?.optional === true,
        `${manifest.name} feature peer ${name} must be optional for core/server consumers`,
      );
    }
    for (const removed of ["expo-crypto", "expo-image-picker", "expo-video-thumbnails"]) {
      assert(!declared[removed], `${manifest.name} still declares obsolete or unused peer ${removed}`);
    }
  }

  console.log(`${manifest.name}: ${profiles[key].map((profile) => profile.name).join(", ")} peer profiles pass`);
}

await checkPackage("media");
await checkPackage("ui");
