#!/usr/bin/env node
/** Build a fresh Expo consumer importing only the packed Badge subpath. */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { brotliCompressSync, gzipSync } from "node:zlib";

const [tarballArg, engine = "stylesheet"] = process.argv.slice(2);
if (!tarballArg || !["stylesheet", "nativewind"].includes(engine)) {
  throw new Error("Usage: node scripts/measure-ui-badge-consumer.mjs <ui.tgz> [stylesheet|nativewind]");
}
const repoRoot = resolve(import.meta.dirname, "..");
const rootPackage = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const uiPackage = JSON.parse(readFileSync(join(repoRoot, "packages/ui/package.json"), "utf8"));
const dependencies = Object.fromEntries(Object.keys(uiPackage.peerDependencies).map((name) => {
  const version = rootPackage.dependencies[name] ?? rootPackage.devDependencies?.[name];
  if (!version) throw new Error(`No pinned root version for peer ${name}`);
  return [name, version];
}));
Object.assign(dependencies, {
  "@mrmeg/expo-ui": `file:${resolve(tarballArg)}`,
  "@expo/metro-runtime": rootPackage.dependencies["@expo/metro-runtime"],
  "react-dom": rootPackage.dependencies["react-dom"],
});
if (engine === "nativewind") {
  Object.assign(dependencies, { nativewind: "4.2.7", tailwindcss: "3.4.17" });
}
const fixture = mkdtempSync(join(tmpdir(), `styling-badge-${engine}-`));
const write = (name, value) => writeFileSync(join(fixture, name), value);
write("package.json", JSON.stringify({
  name: "styling-badge-consumer", private: true, version: "1.0.0", main: "index.ts",
  dependencies,
}, null, 2));
write("app.json", JSON.stringify({ expo: { name: "Badge consumer", slug: "badge-consumer", platforms: ["web", "ios", "android"] } }, null, 2));
write("index.ts", 'import { registerRootComponent } from "expo";\nimport App from "./App";\nregisterRootComponent(App);\n');
write("App.tsx", `${engine === "nativewind" ? 'import "./global.css";\n' : ""}import { Badge } from "@mrmeg/expo-ui/components/Badge";
export default function App() { return <Badge variant="default">Badge</Badge>; }
`);
if (engine === "nativewind") {
  write("global.css", "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
  write("tailwind.config.js", `module.exports = { content: ["./App.tsx", "./node_modules/@mrmeg/expo-ui/dist/**/*.{js,mjs}"], presets: [require("nativewind/preset")] };\n`);
  write("babel.config.js", 'module.exports = { presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"] };\n');
  write("metro.config.js", 'const { getDefaultConfig } = require("expo/metro-config");\nconst { withNativeWind } = require("nativewind/metro");\nmodule.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./global.css" });\n');
}
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: fixture, env: {
    ...process.env,
    EXPO_UNSTABLE_TREE_SHAKING: "1",
    EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: "1",
    NODE_OPTIONS: "--max-old-space-size=8192",
  }, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed in ${fixture}`);
  }
};
run("bun", ["install"]);
run("bunx", ["expo", "export", "--platform", "web", "--output-dir", "dist"]);
function allFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? allFiles(file) : [file];
  });
}
const bundles = allFiles(join(fixture, "dist")).filter((file) => /\.(js|css)$/.test(file));
const bytes = bundles.reduce((total, file) => {
  const contents = readFileSync(file);
  return {
    raw: total.raw + contents.length,
    gzip: total.gzip + gzipSync(contents).length,
    brotli: total.brotli + brotliCompressSync(contents).length,
  };
}, { raw: 0, gzip: 0, brotli: 0 });
process.stdout.write(`${JSON.stringify({ engine, fileCount: bundles.length, jsCss: bytes }, null, 2)}\n`);
rmSync(fixture, { recursive: true, force: true });
