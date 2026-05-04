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

const root = process.cwd();
const fixture = await mkdtemp(join(tmpdir(), "expo-media-consumer-"));
let tarball;

function tarballNameForPackage(packageName, version) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function dependencyVersion(name, rootPackage, mediaPackage) {
  return (
    rootPackage.dependencies?.[name] ??
    rootPackage.devDependencies?.[name] ??
    mediaPackage.dependencies?.[name] ??
    mediaPackage.peerDependencies?.[name]
  );
}

async function assertFileExists(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing packed file for ${label}: ${path}`);
  }
}

function resolveExportTargets(exportValue) {
  if (typeof exportValue === "string") return [exportValue];
  return Object.values(exportValue).filter((target) => typeof target === "string");
}

async function assertInstalledPackageSurface() {
  const packageRoot = join(fixture, "node_modules/@mrmeg/expo-media");
  const manifest = await readJson(join(packageRoot, "package.json"));
  const exportChecks = [
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
  ];

  for (const check of exportChecks) {
    const exportValue = manifest.exports[check.key];
    if (!exportValue) throw new Error(`Missing export map entry for ${check.entrypoint}`);
    for (const target of resolveExportTargets(exportValue)) {
      await assertFileExists(join(packageRoot, target), check.entrypoint);
    }
  }

  for (const doc of ["README.md", "LLM_USAGE.md", "llms.txt", "llms-full.md"]) {
    await assertFileExists(join(packageRoot, doc), doc);
  }
}

try {
  const mediaPackage = await readJson(join(root, "packages/media/package.json"));
  const rootPackage = await readJson(join(root, "package.json"));
  run("bun", ["run", "--cwd", "packages/media", "build"], { cwd: root });
  run("bun", ["pm", "pack"], { cwd: join(root, "packages/media") });
  tarball = join(root, "packages/media", tarballNameForPackage(mediaPackage.name, mediaPackage.version));

  const peerDependencies = Object.fromEntries(
    Object.keys(mediaPackage.peerDependencies ?? {}).map((name) => [
      name,
      dependencyVersion(name, rootPackage, mediaPackage),
    ]),
  );

  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify(
      {
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
    join(fixture, "root-runtime.mjs"),
    [
      "const root = await import('@mrmeg/expo-media');",
      "if (!root.createMediaConfig || !root.resolveContentTypeExtension) {",
      "  throw new Error('Root media entrypoint did not expose shared contracts');",
      "}",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(fixture, "index.tsx"),
    [
      "import { createMediaConfig, mediaTypeForKey } from '@mrmeg/expo-media';",
      "import { createMediaClient } from '@mrmeg/expo-media/client';",
      "import { createMediaQueryHooks } from '@mrmeg/expo-media/react-query';",
      "import { compressImage } from '@mrmeg/expo-media/processing/image-compression';",
      "import { resolveCompressionConfig } from '@mrmeg/expo-media/processing/image-compression/config';",
      "import { FFMPEG_WORKER_URL, needsConversion } from '@mrmeg/expo-media/processing/video-conversion';",
      "import { extractVideoThumbnail } from '@mrmeg/expo-media/processing/video-thumbnails';",
      "import { createMediaHandlers } from '@mrmeg/expo-media/server';",
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
      "void hooks;",
      "void handlers;",
      "void compressImage;",
      "void extractVideoThumbnail;",
      "void FFMPEG_WORKER_URL;",
      "void needsConversion('video/webm');",
      "void resolveCompressionConfig('gallery');",
      "void mediaTypeForKey(config, 'users/avatars/a.jpg');",
      "",
    ].join("\n"),
  );

  run("bun", ["install"], { cwd: fixture });
  await assertInstalledPackageSurface();
  run("bun", ["x", "tsc", "--noEmit"], { cwd: fixture });
  run("node", ["root-runtime.mjs"], { cwd: fixture });
} finally {
  if (tarball) await rm(tarball, { force: true });
  await rm(fixture, { recursive: true, force: true });
}
