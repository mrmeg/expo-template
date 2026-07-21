import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { packageCompatibilityProfiles } from "./package-compatibility-profiles.mjs";

const root = process.cwd();
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with status ${result.status}`);
  }
}

function tarballNameForPackage(packageName, version) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

const packageKey = option("--package");
const sdk = Number(option("--sdk"));

if (!packageCompatibilityProfiles[packageKey] || !Number.isInteger(sdk)) {
  throw new Error(
    "Usage: bun run packages:compatibility -- --package [media|ui] --sdk [55|56|57]",
  );
}

const profile = packageCompatibilityProfiles[packageKey].find((item) => item.sdk === sdk);
if (!profile) {
  throw new Error(`${packageKey} does not declare an Expo ${sdk} compatibility profile`);
}

const packageDir = join(root, "packages", packageKey);
const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const fixture = await mkdtemp(join(tmpdir(), `expo-${packageKey}-sdk-${sdk}-`));
const exportOutput = join(fixture, "dist");
let tarball;

try {
  run("bun", ["run", "build"], { cwd: packageDir });
  run("bun", ["pm", "pack"], { cwd: packageDir });
  tarball = join(packageDir, tarballNameForPackage(manifest.name, manifest.version));

  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify(
      {
        name: `expo-${packageKey}-sdk-${sdk}-compatibility`,
        private: true,
        type: "module",
        main: "index.ts",
        dependencies: {
          [manifest.name]: tarball,
          ...profile.versions,
        },
        devDependencies: {
          "@types/node": "^26.1.1",
          "@types/react": "~19.2.17",
          typescript: "~6.0.3",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(fixture, "app.json"),
    JSON.stringify(
      {
        expo: {
          name: `${manifest.name} Expo ${sdk} Compatibility`,
          slug: `${packageKey}-sdk-${sdk}-compatibility`,
          platforms: ["ios"],
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          skipLibCheck: true,
          noEmit: true,
          types: ["node"],
        },
        include: ["*.ts", "*.tsx"],
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(fixture, "index.ts"),
    [
      "import { registerRootComponent } from 'expo';",
      "import App from './App';",
      "registerRootComponent(App);",
      "",
    ].join("\n"),
  );

  if (packageKey === "ui") {
    await writeFile(
      join(fixture, "App.tsx"),
      [
        "import { View } from 'react-native';",
        "import { Button, StyledText, UIProvider } from '@mrmeg/expo-ui';",
        "",
        "export default function App() {",
        "  return (",
        "    <UIProvider>",
        "      <View>",
        "        <StyledText text='Compatibility' />",
        "        <Button text='Check' />",
        "      </View>",
        "    </UIProvider>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
  } else {
    await writeFile(
      join(fixture, "App.tsx"),
      [
        "import { View } from 'react-native';",
        "import { createMediaConfig } from '@mrmeg/expo-media';",
        "import { createMediaClient } from '@mrmeg/expo-media/client';",
        "import { createMediaQueryHooks } from '@mrmeg/expo-media/react-query';",
        "import { compressImage } from '@mrmeg/expo-media/processing/image-compression';",
        "import { extractVideoThumbnail } from '@mrmeg/expo-media/processing/video-thumbnails';",
        "",
        "const config = createMediaConfig({ buckets: {}, mediaTypes: {} });",
        "const client = createMediaClient();",
        "const hooks = createMediaQueryHooks({ client });",
        "void config; void hooks; void compressImage; void extractVideoThumbnail;",
        "",
        "export default function App() {",
        "  return <View />;",
        "}",
        "",
      ].join("\n"),
    );
  }

  run("bun", ["install", "--linker", "isolated"], { cwd: fixture });
  run("bunx", ["expo", "install", "--fix"], { cwd: fixture });
  run("bunx", ["expo", "install", "--check"], { cwd: fixture });
  run("bun", ["x", "tsc", "--noEmit"], { cwd: fixture });
  run(
    "bunx",
    ["expo", "export", "--platform", "ios", "--output-dir", exportOutput, "--no-minify"],
    { cwd: fixture },
  );
  console.log(`${manifest.name} ${profile.name} compatibility passed`);
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(fixture, { recursive: true, force: true });
}
