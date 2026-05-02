import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(root, "packages/ui/dist");

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listJsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listJsFiles(path) : path;
    })
  );

  return files.flat().filter((path) => path.endsWith(".js"));
}

async function resolveRelativeSpecifier(sourceFile, specifier) {
  if (!specifier.startsWith(".") || extname(specifier)) {
    return specifier;
  }

  const sourceDirectory = dirname(sourceFile);
  const candidateFile = resolve(sourceDirectory, `${specifier}.js`);
  if (await pathExists(candidateFile)) {
    return `${specifier}.js`;
  }

  const candidateIndex = resolve(sourceDirectory, specifier, "index.js");
  if (await pathExists(candidateIndex)) {
    const relativePath = relative(sourceDirectory, candidateIndex).split(sep).join("/");
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  }

  return specifier;
}

async function rewriteFile(file) {
  const source = await readFile(file, "utf8");
  let output = source;

  const fromPattern = /\b(from\s*["'])(\.[^"']+)(["'])/g;
  const importPattern = /\b(import\s*["'])(\.[^"']+)(["'])/g;

  for (const pattern of [fromPattern, importPattern]) {
    const matches = [...output.matchAll(pattern)];
    for (const match of matches) {
      const [fullMatch, prefix, specifier, suffix] = match;
      const resolvedSpecifier = await resolveRelativeSpecifier(file, specifier);
      if (resolvedSpecifier !== specifier) {
        output = output.replace(fullMatch, `${prefix}${resolvedSpecifier}${suffix}`);
      }
    }
  }

  if (output !== source) {
    await writeFile(file, output);
  }
}

const files = await listJsFiles(distRoot);
await Promise.all(files.map(rewriteFile));
