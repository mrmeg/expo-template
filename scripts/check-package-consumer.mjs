#!/usr/bin/env node
/**
 * Consumer smoke test for a workspace package.
 *
 * The skeleton is identical for every package: build, `bun pm pack`, install the
 * tarball into throwaway fixtures, assert the packed export map actually points
 * at shipped files, then type-check and import the public surface the way a real
 * consumer would. Only the fixture contents and the post-install steps differ,
 * so those live in the `PACKAGES` table below.
 *
 * Usage:
 *   node scripts/check-package-consumer.mjs <ui|media>
 */
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function tarballNameForPackage(packageName, version) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Fixture manifests are written pretty-printed so failures are readable. */
const json = (value) => JSON.stringify(value, null, 2);

/**
 * Version a fixture should install a peer with. Prefers whatever the template
 * itself is pinned to, falling back to the package's own declarations.
 */
function dependencyVersion(name, rootPackage, manifest) {
  return (
    rootPackage.dependencies?.[name] ??
    rootPackage.devDependencies?.[name] ??
    manifest.dependencies?.[name] ??
    manifest.peerDependencies?.[name]
  );
}

async function assertFileExists(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing packed file for ${label}: ${path}`);
  }
}

function resolveExportTargets(exportValue, wildcardReplacement = "") {
  if (typeof exportValue === "string") {
    return [exportValue.replace("*", wildcardReplacement)];
  }

  return Object.values(exportValue)
    .filter((target) => typeof target === "string")
    .map((target) => target.replace("*", wildcardReplacement));
}

const UI_APP_TSX = [
  "import { View } from \"react-native\";",
  "import { colors } from \"@mrmeg/expo-ui/constants\";",
  "import { colors as leafColors } from \"@mrmeg/expo-ui/constants/colors\";",
  "import { useResources, useTheme } from \"@mrmeg/expo-ui/hooks\";",
  "import { useTheme as useThemeLeaf } from \"@mrmeg/expo-ui/hooks/useTheme\";",
  "import { Button } from \"@mrmeg/expo-ui/components/Button\";",
  "import { UIProvider } from \"@mrmeg/expo-ui/components/UIProvider\";",
  "import { StyledText } from \"@mrmeg/expo-ui/components/StyledText\";",
  "",
  "export default function App() {",
  "  const { theme } = useTheme();",
  "  const { scheme } = useThemeLeaf();",
  "  const { loaded } = useResources();",
  "",
  "  return (",
  "    <UIProvider>",
  "      <View style={{ flex: 1, backgroundColor: colors.light.colors.background, padding: 24 }}>",
  "        <StyledText text={`${loaded}-${theme.colors.background}-${leafColors[scheme].colors.background}`} />",
  "        <Button text=\"Smoke\" />",
  "      </View>",
  "    </UIProvider>",
  "  );",
  "}",
  "",
].join("\n");

const UI_INDEX_TSX = [
  "import { Button as RootButton, colors as rootColors, useTheme as useRootTheme } from \"@mrmeg/expo-ui\";",
  "import { Button as ComponentButton, StyledText, UIProvider } from \"@mrmeg/expo-ui/components\";",
  "import { Button } from \"@mrmeg/expo-ui/components/Button\";",
  "import { Notification } from \"@mrmeg/expo-ui/components/Notification\";",
  "import { StyledText as StyledTextDirect } from \"@mrmeg/expo-ui/components/StyledText\";",
  "import { spacing, colors, typography } from \"@mrmeg/expo-ui/constants\";",
  "import { colors as leafColors } from \"@mrmeg/expo-ui/constants/colors\";",
  "import { useTheme, useResources } from \"@mrmeg/expo-ui/hooks\";",
  "import { useTheme as useThemeLeaf } from \"@mrmeg/expo-ui/hooks/useTheme\";",
  "import { globalUIStore, useThemeStore } from \"@mrmeg/expo-ui/state\";",
  "import { globalUIStore as directGlobalUIStore } from \"@mrmeg/expo-ui/state/globalUIStore\";",
  "import { configureExpoUiI18n, hapticLight } from \"@mrmeg/expo-ui/lib\";",
  "",
  "const publicSurface = {",
  "  RootButton,",
  "  ComponentButton,",
  "  StyledText,",
  "  UIProvider,",
  "  StyledTextDirect,",
  "  Notification,",
  "  rootColors,",
  "  useRootTheme,",
  "  typography,",
  "  leafColors,",
  "  useThemeLeaf,",
  "  globalUIStore,",
  "  directGlobalUIStore,",
  "  useThemeStore,",
  "  configureExpoUiI18n,",
  "  hapticLight,",
  "};",
  "",
  "export function Smoke() {",
  "  const { theme } = useTheme();",
  "  const resources = useResources();",
  "  void publicSurface;",
  "  return <Button text={`${spacing.md}-${colors.light.colors.background}-${theme.colors.background}-${resources.loaded}`} />;",
  "}",
  "",
].join("\n");

const UI_RUNTIME_CHECK_MJS = [
  "// constants now imports Platform from \"react-native\" (for SSR-stable web detection),",
  "// so it requires a bundler alias to react-native-web. The Expo export step below",
  "// still exercises the full surface via Metro.",
  "const runtimeSafeEntrypoints = [];",
  "",
  "for (const entrypoint of runtimeSafeEntrypoints) {",
  "  try {",
  "    const imported = await import(entrypoint.specifier);",
  "    if (!entrypoint.validate(imported)) {",
  "      throw new Error('runtime validation failed');",
  "    }",
  "  } catch (error) {",
  "    console.error(`Runtime import failed for ${entrypoint.specifier}`);",
  "    throw error;",
  "  }",
  "}",
  "",
].join("\n");

const MEDIA_INDEX_TSX = [
  "import { createMediaConfig, mediaTypeForKey } from '@mrmeg/expo-media';",
  "import { createMediaClient } from '@mrmeg/expo-media/client';",
  "import { createMediaQueryHooks } from '@mrmeg/expo-media/react-query';",
  "import { compressImage } from '@mrmeg/expo-media/processing/image-compression';",
  "import { resolveCompressionConfig } from '@mrmeg/expo-media/processing/image-compression/config';",
  "import { FFMPEG_WORKER_URL, needsConversion } from '@mrmeg/expo-media/processing/video-conversion';",
  "import { extractVideoThumbnail } from '@mrmeg/expo-media/processing/video-thumbnails';",
  "import { createMediaHandlers } from '@mrmeg/expo-media/server';",
  "import {",
  "  createKvTokenAuthorizer,",
  "  createMediaWorker,",
  "  type MediaTokenStore,",
  "} from '@mrmeg/expo-media/worker';",
  "",
  "const config = createMediaConfig({",
  "  buckets: {",
  "    publicImages: {",
  "      provider: 'r2',",
  "      bucket: 'bucket',",
  "      endpoint: 'https://r2.example',",
  "      region: 'auto',",
  "      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },",
  "    },",
  "  },",
  "  mediaTypes: {",
  "    avatars: {",
  "      bucket: 'publicImages',",
  "      prefix: 'users/avatars',",
  "      allowedContentTypes: ['image/jpeg'],",
  "      maxBytes: 1024,",
  "    },",
  "  },",
  "});",
  "",
  "const client = createMediaClient({",
  "  fetcher: async () => new Response(JSON.stringify({ items: [], totalCount: 0 }), { status: 200 }),",
  "});",
  "const hooks = createMediaQueryHooks({ client });",
  "const handlers = createMediaHandlers({ config, authorize: async () => ({ userId: 'u1' }) });",
  "",
  "interface MediaWorkerEnv {",
  "  MEDIA_AUTH: MediaTokenStore;",
  "}",
  "",
  "const mediaWorker = createMediaWorker<MediaWorkerEnv>({",
  "  createOptions: (env) => ({",
  "    config,",
  "    authorize: createKvTokenAuthorizer(env.MEDIA_AUTH),",
  "  }),",
  "});",
  "",
  "void hooks;",
  "void handlers;",
  "void mediaWorker;",
  "void compressImage;",
  "void extractVideoThumbnail;",
  "void FFMPEG_WORKER_URL;",
  "void needsConversion('video/webm');",
  "void resolveCompressionConfig('gallery');",
  "void mediaTypeForKey(config, 'users/avatars/a.jpg');",
  "",
].join("\n");

/**
 * Per-package fixtures. `files` receives `{ tarball, rootPackage, manifest,
 * peerDependencies }` and returns the fixture's files keyed by relative path.
 * `steps` run after `bun install` in fixture order.
 */
const PACKAGES = {
  ui: {
    dir: "packages/ui",
    packageName: "@mrmeg/expo-ui",
    exportChecks: [
      { entrypoint: "@mrmeg/expo-ui", key: ".", wildcardReplacement: "" },
      { entrypoint: "@mrmeg/expo-ui/components", key: "./components", wildcardReplacement: "" },
      { entrypoint: "@mrmeg/expo-ui/components/Button", key: "./components/*", wildcardReplacement: "Button" },
      { entrypoint: "@mrmeg/expo-ui/constants", key: "./constants", wildcardReplacement: "" },
      { entrypoint: "@mrmeg/expo-ui/constants/colors", key: "./constants/*", wildcardReplacement: "colors" },
      { entrypoint: "@mrmeg/expo-ui/hooks", key: "./hooks", wildcardReplacement: "" },
      { entrypoint: "@mrmeg/expo-ui/hooks/useTheme", key: "./hooks/*", wildcardReplacement: "useTheme" },
      { entrypoint: "@mrmeg/expo-ui/state", key: "./state", wildcardReplacement: "" },
      { entrypoint: "@mrmeg/expo-ui/state/globalUIStore", key: "./state/*", wildcardReplacement: "globalUIStore" },
      { entrypoint: "@mrmeg/expo-ui/lib", key: "./lib", wildcardReplacement: "" },
    ],
    requiredDocs: [],
    fixtures: [
      {
        prefix: "expo-ui-consumer-",
        install: ["install"],
        files: ({ tarball, rootPackage, peerDependencies }) => ({
          "package.json": json({
            name: "expo-ui-consumer-smoke",
            private: true,
            type: "module",
            main: "index.ts",
            dependencies: {
              "@mrmeg/expo-ui": tarball,
              ...peerDependencies,
            },
            devDependencies: {
              "@types/react": rootPackage.devDependencies["@types/react"],
              typescript: rootPackage.devDependencies.typescript,
            },
          }),
          "app.json": json({
            expo: {
              name: "Expo UI Consumer Smoke",
              slug: "expo-ui-consumer-smoke",
              platforms: ["ios"],
            },
          }),
          "tsconfig.json": json({
            compilerOptions: {
              strict: true,
              module: "ESNext",
              moduleResolution: "Bundler",
              jsx: "react-jsx",
              skipLibCheck: true,
              noEmit: true,
            },
            include: ["index.ts", "index.tsx", "App.tsx"],
          }),
          "index.ts": [
            "import { registerRootComponent } from \"expo\";",
            "import App from \"./App\";",
            "",
            "registerRootComponent(App);",
            "",
          ].join("\n"),
          "App.tsx": UI_APP_TSX,
          "index.tsx": UI_INDEX_TSX,
          "runtime-check.mjs": UI_RUNTIME_CHECK_MJS,
        }),
        steps: [
          { kind: "assert-surface" },
          { kind: "run", command: "bun", args: ["x", "tsc", "--noEmit"] },
          { kind: "run", command: "node", args: ["runtime-check.mjs"] },
          { kind: "expo-export", platform: "ios", outputDirName: "ui-consumer-ios-export" },
        ],
      },
    ],
  },
  media: {
    dir: "packages/media",
    packageName: "@mrmeg/expo-media",
    exportChecks: [
      { entrypoint: "@mrmeg/expo-media", key: "." },
      { entrypoint: "@mrmeg/expo-media/client", key: "./client" },
      { entrypoint: "@mrmeg/expo-media/react-query", key: "./react-query" },
      { entrypoint: "@mrmeg/expo-media/processing", key: "./processing" },
      {
        entrypoint: "@mrmeg/expo-media/processing/image-compression",
        key: "./processing/image-compression",
      },
      {
        entrypoint: "@mrmeg/expo-media/processing/image-compression/config",
        key: "./processing/image-compression/config",
      },
      {
        entrypoint: "@mrmeg/expo-media/processing/video-conversion",
        key: "./processing/video-conversion",
      },
      {
        entrypoint: "@mrmeg/expo-media/processing/video-thumbnails",
        key: "./processing/video-thumbnails",
      },
      { entrypoint: "@mrmeg/expo-media/server", key: "./server" },
      { entrypoint: "@mrmeg/expo-media/worker", key: "./worker" },
    ],
    requiredDocs: ["README.md", "CHANGELOG.md", "LLM_USAGE.md", "llms.txt", "llms-full.md"],
    fixtures: [
      {
        // Peer-free install: proves the core and server entrypoints load without
        // React Native or Expo present.
        prefix: "expo-media-minimal-consumer-",
        install: ["install", "--omit", "peer"],
        files: ({ tarball }) => ({
          "package.json": json({
            name: "expo-media-minimal-consumer-smoke",
            private: true,
            type: "module",
            dependencies: {
              "@mrmeg/expo-media": tarball,
            },
          }),
          "runtime.mjs": [
            "const root = await import('@mrmeg/expo-media');",
            "const server = await import('@mrmeg/expo-media/server');",
            "const worker = await import('@mrmeg/expo-media/worker');",
            "if (!root.createMediaConfig || !server.createMediaHandlers) {",
            "  throw new Error('Minimal core/server consumer could not load package entrypoints');",
            "}",
            "if (!worker.createMediaWorker || !worker.createKvTokenAuthorizer) {",
            "  throw new Error('Minimal worker consumer could not load the worker entrypoint');",
            "}",
            "",
          ].join("\n"),
        }),
        steps: [
          { kind: "assert-surface" },
          { kind: "run", command: "node", args: ["runtime.mjs"] },
        ],
      },
      {
        prefix: "expo-media-consumer-",
        install: ["install"],
        files: ({ tarball, rootPackage, peerDependencies }) => ({
          "package.json": json({
            name: "expo-media-consumer-smoke",
            private: true,
            type: "module",
            dependencies: {
              "@mrmeg/expo-media": tarball,
              ...peerDependencies,
              react: rootPackage.dependencies.react,
              "react-native": rootPackage.dependencies["react-native"],
            },
            devDependencies: {
              "@types/react": rootPackage.devDependencies["@types/react"],
              "@types/node": rootPackage.devDependencies["@types/node"],
              typescript: rootPackage.devDependencies.typescript,
            },
          }),
          "tsconfig.json": json({
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
          }),
          "root-runtime.mjs": [
            "const root = await import('@mrmeg/expo-media');",
            "if (!root.createMediaConfig || !root.resolveContentTypeExtension) {",
            "  throw new Error('Root media entrypoint did not expose shared contracts');",
            "}",
            "",
          ].join("\n"),
          "index.tsx": MEDIA_INDEX_TSX,
        }),
        steps: [
          { kind: "assert-surface" },
          { kind: "run", command: "bun", args: ["x", "tsc", "--noEmit"] },
          { kind: "run", command: "node", args: ["root-runtime.mjs"] },
        ],
      },
    ],
  },
};

const packageNames = Object.keys(PACKAGES).sort();
const packageName = process.argv[2];
const target = PACKAGES[packageName];

if (!target) {
  console.error(
    `check-package-consumer: unknown package "${packageName ?? ""}". Expected one of: ${packageNames.join(", ")}`
  );
  console.error("Usage: node scripts/check-package-consumer.mjs <ui|media>");
  process.exit(1);
}

/** Every declared export target and shipped doc must exist in the installed tree. */
async function assertInstalledPackageSurface(fixtureRoot) {
  const packageRoot = join(fixtureRoot, "node_modules", target.packageName);
  const manifest = await readJson(join(packageRoot, "package.json"));

  for (const check of target.exportChecks) {
    const exportValue = manifest.exports[check.key];
    if (!exportValue) {
      throw new Error(`Missing package export map entry for ${check.entrypoint}`);
    }

    for (const exportTarget of resolveExportTargets(exportValue, check.wildcardReplacement)) {
      await assertFileExists(join(packageRoot, exportTarget), check.entrypoint);
    }
  }

  for (const doc of target.requiredDocs) {
    await assertFileExists(join(packageRoot, doc), doc);
  }
}

const root = process.cwd();
const fixtureRoots = [];
const exportOutputs = [];
let tarball;

try {
  const manifest = await readJson(join(root, target.dir, "package.json"));
  const rootPackage = await readJson(join(root, "package.json"));
  run("bun", ["run", "--cwd", target.dir, "build"], { cwd: root });
  run("bun", ["pm", "pack"], { cwd: join(root, target.dir) });
  tarball = join(root, target.dir, tarballNameForPackage(manifest.name, manifest.version));

  const peerDependencies = Object.fromEntries(
    Object.keys(manifest.peerDependencies ?? {}).map((name) => [
      name,
      dependencyVersion(name, rootPackage, manifest),
    ])
  );

  for (const fixture of target.fixtures) {
    const fixtureRoot = await mkdtemp(join(tmpdir(), fixture.prefix));
    fixtureRoots.push(fixtureRoot);

    const files = fixture.files({ tarball, rootPackage, manifest, peerDependencies });
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(join(fixtureRoot, name), contents);
    }

    run("bun", fixture.install, { cwd: fixtureRoot });

    for (const step of fixture.steps) {
      if (step.kind === "assert-surface") {
        await assertInstalledPackageSurface(fixtureRoot);
      } else if (step.kind === "run") {
        run(step.command, step.args, { cwd: fixtureRoot });
      } else if (step.kind === "expo-export") {
        const outputDir = join(tmpdir(), step.outputDirName);
        exportOutputs.push(outputDir);
        await rm(outputDir, { recursive: true, force: true });
        run("bunx", ["expo", "export", "--platform", step.platform, "--output-dir", outputDir, "--no-minify"], {
          cwd: fixtureRoot,
        });
      } else {
        throw new Error(`Unknown consumer smoke step: ${JSON.stringify(step)}`);
      }
    }
  }
} finally {
  if (tarball) await rm(tarball, { force: true });
  for (const outputDir of exportOutputs) {
    await rm(outputDir, { recursive: true, force: true });
  }
  for (const fixtureRoot of fixtureRoots) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
