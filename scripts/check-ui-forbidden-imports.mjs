import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages/ui");
const scanRoots = [
  join(packageRoot, "src"),
  join(packageRoot, "dist"),
];
const forbidden = [
  "react-native-reanimated",
  "react-native-worklets",
];
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : path;
    })
  );

  return files.flat().filter((path) => extensions.has(path.slice(path.lastIndexOf("."))));
}

const hits = [];
const scannedRoots = [];

for (const scanRoot of scanRoots) {
  if (!(await pathExists(scanRoot))) continue;

  scannedRoots.push(relative(root, scanRoot));

  for (const file of await listFiles(scanRoot)) {
    const source = await readFile(file, "utf8");
    for (const token of forbidden) {
      if (source.includes(token)) {
        hits.push(`${relative(root, file)} contains ${token}`);
      }
    }
  }
}

if (hits.length > 0) {
  console.error("Forbidden UI package imports found:");
  for (const hit of hits) {
    console.error(`- ${hit}`);
  }
  process.exit(1);
}

console.log(`UI forbidden import scan passed: ${scannedRoots.join(", ")}`);
