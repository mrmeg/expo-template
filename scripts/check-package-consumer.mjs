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
 *   node scripts/check-package-consumer.mjs <ui|media|purchases|lint>
 */
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

/**
 * A `run` step, with `expectStdout` when what the command printed is the check —
 * `--doctor` exits 0 whether it read a manifest or a source tree, so the line it
 * printed is the only proof of which.
 */
function runStep(step, cwd) {
  if (!step.expectStdout) {
    run(step.command, step.args, { cwd });
    return;
  }

  const result = spawnSync(step.command, step.args, { cwd, encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status !== 0) {
    throw new Error(`${step.command} ${step.args.join(" ")} failed with status ${result.status}`);
  }
  if (!(result.stdout ?? "").includes(step.expectStdout)) {
    throw new Error(
      `${step.command} ${step.args.join(" ")} never printed ${JSON.stringify(step.expectStdout)}`
    );
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
 * itself is pinned to, then the package's own pins (a devDependency is the
 * version the package was typed and tested against), then the peer range.
 */
function dependencyVersion(name, rootPackage, manifest) {
  return (
    rootPackage.dependencies?.[name] ??
    rootPackage.devDependencies?.[name] ??
    manifest.dependencies?.[name] ??
    manifest.devDependencies?.[name] ??
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

const PURCHASES_INDEX_TSX = [
  "import AsyncStorage from '@react-native-async-storage/async-storage';",
  "import { View } from 'react-native';",
  "import {",
  "  createEntitlementStore,",
  "  createPurchases,",
  "  PaywallGate,",
  "  PurchasesProvider,",
  "  resolveEntitlement,",
  "  useEntitlement,",
  "  useRequireEntitlement,",
  "  type CustomerState,",
  "  type PaywallOutcome,",
  "} from '@mrmeg/expo-purchases';",
  "import {",
  "  buildLedgerRows,",
  "  createWebhookHandler,",
  "  isAuthorizedWebhook,",
  "  parseRevenueCatWebhook,",
  "  reduceEntitlement,",
  "  type LedgerRow,",
  "  type RevenueCatWebhookEvent,",
  "} from '@mrmeg/expo-purchases/server';",
  "",
  "const purchases = createPurchases({",
  "  entitlement: 'pro',",
  "  offering: 'default',",
  "  iosKey: 'appl_test',",
  "  androidKey: 'goog_test',",
  "  onError: () => {},",
  "});",
  "const store = createEntitlementStore({ storage: AsyncStorage });",
  "",
  "const handler = createWebhookHandler({",
  "  secret: 'secret',",
  "  entitlement: 'pro',",
  "  onEvent: async (event: RevenueCatWebhookEvent) => {",
  "    const rows: LedgerRow[] = buildLedgerRows(event, { userId: event.appUserId });",
  "    const reduction = reduceEntitlement({ until: null, productId: null, updatedAt: null }, event, { entitlement: 'pro' });",
  "    return { rows: rows.length, applied: reduction.action === 'set' };",
  "  },",
  "});",
  "",
  "function Gated() {",
  "  const { isEntitled, presentPaywall } = useEntitlement();",
  "  const requireExport = useRequireEntitlement('export');",
  "  const outcome: Promise<PaywallOutcome> = presentPaywall();",
  "  void outcome; void requireExport(); void isEntitled;",
  "  return (",
  "    <PaywallGate feature=\"export\" fallback={<View />}>",
  "      <View />",
  "    </PaywallGate>",
  "  );",
  "}",
  "",
  "export default function App() {",
  "  return (",
  "    <PurchasesProvider client={purchases} store={store} userId=\"user-1\" serverUntil={null} onBlocked={() => {}}>",
  "      <Gated />",
  "    </PurchasesProvider>",
  "  );",
  "}",
  "",
  "const customer: CustomerState | null = null;",
  "void resolveEntitlement({ customer, serverUntil: null, snapshot: null, devOverride: false });",
  "void handler; void isAuthorizedWebhook; void parseRevenueCatWebhook;",
  "",
].join("\n");

const LINT_FIXTURE_TSX = [
  "import { Text } from \"react-native\";",
  "import { Slider } from \"@expo/ui/community/slider\";",
  "import { Button } from \"@mrmeg/expo-ui\";",
  "",
  "export default function Fixture() {",
  "  return <Button style={{ backgroundColor: \"#f00\", padding: 13 }} />;",
  "}",
  "",
].join("\n");

const LINT_ESLINT_CONFIG_MJS = [
  "import parser from \"@typescript-eslint/parser\";",
  "import expoUi from \"@mrmeg/eslint-plugin-expo-ui\";",
  "",
  "export default [",
  "  {",
  "    // `app/**` is here for `--doctor`, whose smoke fixture claims to live at",
  "    // app/__expo_ui_doctor__.tsx: a src-only glob would leave it unconfigured.",
  "    files: [\"src/**/*.tsx\", \"app/**/*.tsx\"],",
  "    ...expoUi.configs.recommended,",
  "    languageOptions: {",
  "      parser,",
  "      parserOptions: { ecmaFeatures: { jsx: true } },",
  "    },",
  "    settings: {",
  "      ...expoUi.configs.recommended.settings,",
  "      // No design-system sources in a consumer: the rules must fall through to",
  "      // the manifest the installed @mrmeg/expo-ui ships.",
  "      \"expo-ui\": { uiSourceDir: \"/nonexistent/dir\" },",
  "    },",
  "  },",
  "];",
  "",
].join("\n");

const LINT_RUNTIME_CJS = [
  "const assert = require(\"node:assert/strict\");",
  "const { ESLint } = require(\"eslint\");",
  "",
  "const plugin = require(\"@mrmeg/eslint-plugin-expo-ui\");",
  "",
  "// The counts the four rules report on src/fixture.tsx: a raw color, an",
  "// off-scale padding, two restyles of Button, and two raw primitives.",
  "const EXPECTED = {",
  "  \"expo-ui/no-raw-colors\": 1,",
  "  \"expo-ui/no-arbitrary-values\": 1,",
  "  \"expo-ui/no-restyle\": 2,",
  "  \"expo-ui/no-raw-primitives\": 2,",
  "};",
  "",
  "async function main() {",
  "  assert.deepEqual(Object.keys(plugin.rules).sort(), [",
  "    \"no-arbitrary-values\",",
  "    \"no-raw-colors\",",
  "    \"no-raw-primitives\",",
  "    \"no-restyle\",",
  "  ]);",
  "",
  "  const eslint = new ESLint({ cwd: __dirname, cache: false });",
  "  const [result] = await eslint.lintFiles([\"src/fixture.tsx\"]);",
  "  const counts = {};",
  "  for (const rule of Object.keys(EXPECTED)) counts[rule] = 0;",
  "  for (const message of result.messages) {",
  "    if (message.ruleId in counts) counts[message.ruleId] += 1;",
  "    else throw new Error(`Unexpected ${message.ruleId} message: ${message.message}`);",
  "  }",
  "  assert.deepEqual(counts, EXPECTED, `Unexpected rule counts: ${JSON.stringify(counts)}`);",
  "",
  "  // The messages must name the installed package, not this repo's source tree:",
  "  // that is the manifest label doing its job.",
  "  const labelled = result.messages.filter((message) =>",
  "    message.message.includes(\"`@mrmeg/expo-ui/components/Button.tsx`\"),",
  "  );",
  "  assert.ok(",
  "    labelled.length > 0,",
  "    `No message named @mrmeg/expo-ui/components/Button.tsx: ${JSON.stringify(",
  "      result.messages.map((message) => message.message),",
  "      null,",
  "      2,",
  "    )}`,",
  "  );",
  "  console.log(`lint consumer: rules reported ${result.messages.length} messages, manifest-labelled`);",
  "}",
  "",
  "main().catch((error) => {",
  "  console.error(error);",
  "  process.exit(1);",
  "});",
  "",
].join("\n");

/**
 * Per-package fixtures. `files` receives `{ tarball, extraTarballs, rootPackage,
 * manifest, peerDependencies }` and returns the fixture's files keyed by relative
 * path. `steps` run after `bun install` in fixture order. `extraPackages` maps a
 * name to another workspace package directory, which is built and packed too and
 * arrives in `extraTarballs` under that name — the lint plugin's fixture needs the
 * UI tarball, because the manifest it reads ships inside it.
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
      {
        entrypoint: "@mrmeg/expo-ui/design-system.json",
        key: "./design-system.json",
        wildcardReplacement: "",
      },
    ],
    requiredDocs: ["dist/design-system.json"],
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
          {
            // The lint plugin reads this file out of an installed release, so the
            // tarball must carry a manifest this plugin's schema version accepts.
            kind: "run",
            command: "node",
            args: [
              "-e",
              [
                'const manifest = require("@mrmeg/expo-ui/design-system.json");',
                "if (manifest.schemaVersion !== 1) {",
                "  throw new Error(`design-system.json schemaVersion ${manifest.schemaVersion} !== 1`);",
                "}",
                "if (!Array.isArray(manifest.components) || manifest.components.length === 0) {",
                '  throw new Error("design-system.json lists no components");',
                "}",
                "console.log(`design-system.json: ${manifest.components.length} components`);",
              ].join("\n"),
            ],
          },
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
  purchases: {
    dir: "packages/purchases",
    packageName: "@mrmeg/expo-purchases",
    exportChecks: [
      { entrypoint: "@mrmeg/expo-purchases", key: "." },
      { entrypoint: "@mrmeg/expo-purchases/server", key: "./server" },
    ],
    requiredDocs: ["README.md", "CHANGELOG.md", "LLM_USAGE.md", "llms.txt", "llms-full.md"],
    fixtures: [
      {
        // Peer-free install: proves `/server` loads without React, React Native,
        // zustand, or either RevenueCat SDK present.
        prefix: "expo-purchases-minimal-consumer-",
        install: ["install", "--omit", "peer"],
        files: ({ tarball }) => ({
          "package.json": json({
            name: "expo-purchases-minimal-consumer-smoke",
            private: true,
            type: "module",
            dependencies: {
              "@mrmeg/expo-purchases": tarball,
            },
          }),
          "runtime.mjs": [
            "const server = await import('@mrmeg/expo-purchases/server');",
            "const event = server.parseRevenueCatWebhook({",
            "  event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: 'u1', entitlement_ids: ['pro'], event_timestamp_ms: 1, price: 9.99 },",
            "});",
            "if (!event) throw new Error('Minimal server consumer could not parse a webhook event');",
            "const rows = server.buildLedgerRows(event, { userId: 'u1' });",
            "if (rows.length !== 1 || rows[0].eventType !== 'purchased' || rows[0].amountCents !== 999) {",
            "  throw new Error('Minimal server consumer produced unexpected ledger rows');",
            "}",
            "if (!server.isAuthorizedWebhook('Bearer s', 's') || typeof server.createWebhookHandler !== 'function') {",
            "  throw new Error('Minimal server consumer could not load the webhook helpers');",
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
        prefix: "expo-purchases-consumer-",
        install: ["install"],
        files: ({ tarball, rootPackage, peerDependencies }) => ({
          "package.json": json({
            name: "expo-purchases-consumer-smoke",
            private: true,
            type: "module",
            dependencies: {
              "@mrmeg/expo-purchases": tarball,
              ...peerDependencies,
              "@react-native-async-storage/async-storage":
                rootPackage.dependencies["@react-native-async-storage/async-storage"],
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
          "index.tsx": PURCHASES_INDEX_TSX,
        }),
        steps: [
          { kind: "assert-surface" },
          { kind: "run", command: "bun", args: ["x", "tsc", "--noEmit"] },
        ],
      },
    ],
  },
  lint: {
    dir: "packages/lint",
    packageName: "@mrmeg/eslint-plugin-expo-ui",
    // The plugin is plain CommonJS with no `exports` map: `assert-surface` has
    // nothing to index, so the shipped files are listed as docs instead.
    exportChecks: [],
    requiredDocs: [
      "index.js",
      "bin/cli.js",
      "lib/manifest.js",
      "rules/no-restyle.js",
      "README.md",
      "CHANGELOG.md",
    ],
    fixtures: [
      {
        prefix: "expo-ui-lint-consumer-",
        // The UI tarball's peers (react, react-native, expo, …) are irrelevant to
        // reading its manifest, and installing them would double the fixture's
        // install for nothing.
        extraPackages: { ui: "packages/ui" },
        install: ["install", "--omit", "peer"],
        files: ({ tarball, extraTarballs, rootPackage, peerDependencies }) => ({
          "package.json": json({
            name: "expo-ui-lint-consumer-smoke",
            private: true,
            dependencies: {
              "@mrmeg/eslint-plugin-expo-ui": tarball,
              // The packed tarball, not the root manifest's `workspace:*`: this
              // fixture is outside the workspace.
              "@mrmeg/expo-ui": extraTarballs.ui,
              ...peerDependencies,
              // `@typescript-eslint/parser` peer-depends on typescript, and this
              // fixture omits peers, so it has to be asked for by name.
              typescript: rootPackage.devDependencies.typescript,
            },
          }),
          "eslint.config.mjs": LINT_ESLINT_CONFIG_MJS,
          "src/fixture.tsx": LINT_FIXTURE_TSX,
          "runtime.cjs": LINT_RUNTIME_CJS,
        }),
        steps: [
          { kind: "assert-surface" },
          { kind: "run", command: "node", args: ["runtime.cjs"] },
          {
            // The doctor is the consumer's own diagnosis: it must name the
            // manifest it read, not a source tree that does not exist here.
            kind: "run",
            command: "node",
            args: [
              "node_modules/@mrmeg/eslint-plugin-expo-ui/bin/cli.js",
              "--doctor",
              "src/fixture.tsx",
            ],
            expectStdout: "manifest @mrmeg/expo-ui@",
          },
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
  console.error("Usage: node scripts/check-package-consumer.mjs <ui|media|purchases|lint>");
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
/** Packed tarballs by package directory, so each one is built and packed once. */
const tarballs = new Map();

/**
 * @param {string} dir a workspace package directory, repo-relative
 * @returns {Promise<string>} absolute path to the packed tarball
 */
async function packWorkspacePackage(dir) {
  const existing = tarballs.get(dir);
  if (existing) return existing;

  const manifest = await readJson(join(root, dir, "package.json"));
  run("bun", ["run", "--cwd", dir, "build"], { cwd: root });
  run("bun", ["pm", "pack"], { cwd: join(root, dir) });
  const tarball = join(root, dir, tarballNameForPackage(manifest.name, manifest.version));
  tarballs.set(dir, tarball);
  return tarball;
}

try {
  const manifest = await readJson(join(root, target.dir, "package.json"));
  const rootPackage = await readJson(join(root, "package.json"));
  const tarball = await packWorkspacePackage(target.dir);

  const peerDependencies = Object.fromEntries(
    Object.keys(manifest.peerDependencies ?? {}).map((name) => [
      name,
      dependencyVersion(name, rootPackage, manifest),
    ])
  );

  for (const fixture of target.fixtures) {
    const fixtureRoot = await mkdtemp(join(tmpdir(), fixture.prefix));
    fixtureRoots.push(fixtureRoot);

    /** @type {Record<string, string>} */
    const extraTarballs = {};
    for (const [name, dir] of Object.entries(fixture.extraPackages ?? {})) {
      extraTarballs[name] = await packWorkspacePackage(dir);
    }

    const files = fixture.files({ tarball, extraTarballs, rootPackage, manifest, peerDependencies });
    for (const [name, contents] of Object.entries(files)) {
      const file = join(fixtureRoot, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, contents);
    }

    run("bun", fixture.install, { cwd: fixtureRoot });

    for (const step of fixture.steps) {
      if (step.kind === "assert-surface") {
        await assertInstalledPackageSurface(fixtureRoot);
      } else if (step.kind === "run") {
        runStep(step, fixtureRoot);
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
  for (const tarball of tarballs.values()) {
    await rm(tarball, { force: true });
  }
  for (const outputDir of exportOutputs) {
    await rm(outputDir, { recursive: true, force: true });
  }
  for (const fixtureRoot of fixtureRoots) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
