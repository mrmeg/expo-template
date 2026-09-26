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
 * `--tarball <path>` skips the build and pack and tests that tarball instead:
 * the release flow packs once and passes the tarball here, so the file the smoke
 * approved is the file `npm publish` uploads.
 *
 * Usage:
 *   node scripts/check-package-consumer.mjs <ui|media|purchases|lint> [--tarball <path>]
 */
import { existsSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { bundledPackages, findDuplicatePackages, readSourceMapSources } from "./lib/bundleSingletons.mjs";
import { tarballName } from "./lib/workspacePackages.mjs";

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

/**
 * The repo-only export condition that points at `src`. Consumers never set it,
 * and `src` is not in the tarball, so its targets are not a consumer surface.
 */
const SOURCE_CONDITION = "@mrmeg/source";

function resolveExportTargets(exportValue, wildcardReplacement = "") {
  if (typeof exportValue === "string") {
    return [exportValue.replace("*", wildcardReplacement)];
  }

  return Object.entries(exportValue)
    .filter(([condition, target]) => condition !== SOURCE_CONDITION && typeof target === "string")
    .map(([, target]) => target.replace("*", wildcardReplacement));
}

/**
 * The app every UI export bundles (iOS, Android, web). `AlertDialog` is here for
 * web: it is the Radix-backed component the duplicate-module crash hit, so the
 * web bundle has to carry the Radix graph the singleton check inspects. The
 * deep imports are the subpaths consumer apps import directly.
 */
const UI_APP_TSX = [
  "import { View } from \"react-native\";",
  "import { colors } from \"@mrmeg/expo-ui/constants\";",
  "import { colors as leafColors } from \"@mrmeg/expo-ui/constants/colors\";",
  "import { spacing } from \"@mrmeg/expo-ui/constants/spacing\";",
  "import { useResources, useTheme } from \"@mrmeg/expo-ui/hooks\";",
  "import { useTheme as useThemeLeaf } from \"@mrmeg/expo-ui/hooks/useTheme\";",
  "import { Button } from \"@mrmeg/expo-ui/components/Button\";",
  "import {",
  "  AlertDialog,",
  "  AlertDialogAction,",
  "  AlertDialogCancel,",
  "  AlertDialogContent,",
  "  AlertDialogDescription,",
  "  AlertDialogTitle,",
  "  AlertDialogTrigger,",
  "} from \"@mrmeg/expo-ui/components/Dialog\";",
  "import { dismissKeyboard } from \"@mrmeg/expo-ui/components/keyboardDismiss\";",
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
  "      <View style={{ flex: 1, backgroundColor: colors.light.colors.background, padding: spacing.lg }}>",
  "        <StyledText text={`${loaded}-${theme.colors.background}-${leafColors[scheme].colors.background}`} />",
  "        <Button text=\"Smoke\" onPress={dismissKeyboard} />",
  "        <AlertDialog>",
  "          <AlertDialogTrigger asChild>",
  "            <Button text=\"Delete project\" />",
  "          </AlertDialogTrigger>",
  "          <AlertDialogContent>",
  "            <AlertDialogTitle>Delete project?</AlertDialogTitle>",
  "            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>",
  "            <AlertDialogCancel asChild>",
  "              <Button text=\"Cancel\" />",
  "            </AlertDialogCancel>",
  "            <AlertDialogAction asChild>",
  "              <Button text=\"Delete\" />",
  "            </AlertDialogAction>",
  "          </AlertDialogContent>",
  "        </AlertDialog>",
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

/**
 * Plain-Node imports of the UI subpaths that do not reach `react-native` (which
 * is Flow source and needs a bundler): each one proves its export-map entry
 * resolves in Node and that the shipped ESM loads and works. Everything that
 * does reach `react-native` is covered by the Expo exports instead.
 */
const UI_RUNTIME_CHECK_MJS = [
  "import assert from \"node:assert/strict\";",
  "",
  "const runtimeSafeEntrypoints = [",
  "  {",
  "    specifier: \"@mrmeg/expo-ui/constants/spacing\",",
  "    validate: ({ spacing, space }) => {",
  "      assert.equal(typeof spacing.md, \"number\");",
  "      assert.equal(space(2), spacing.base * 2);",
  "    },",
  "  },",
  "  {",
  "    specifier: \"@mrmeg/expo-ui/constants/motion\",",
  "    validate: ({ durations }) => {",
  "      assert.ok(durations.fast < durations.normal && durations.normal < durations.slow);",
  "    },",
  "  },",
  "  {",
  "    specifier: \"@mrmeg/expo-ui/components/keyboardFocusRegistry\",",
  "    validate: (registry) => {",
  "      let blurred = false;",
  "      registry.setKeyboardFocusedInput(\"smoke\", () => {",
  "        blurred = true;",
  "      });",
  "      assert.equal(registry.hasKeyboardFocusedInput(), true);",
  "      assert.equal(registry.dismissKeyboardFocusedInput(), true);",
  "      assert.equal(blurred, true);",
  "      assert.equal(registry.hasKeyboardFocusedInput(), false);",
  "    },",
  "  },",
  "  {",
  "    // Two subpaths over one zustand store: a deep import must not load a second copy.",
  "    specifier: \"@mrmeg/expo-ui/state/notify\",",
  "    validate: async ({ notify }) => {",
  "      const { globalUIStore } = await import(\"@mrmeg/expo-ui/state/globalUIStore\");",
  "      notify.success(\"Saved\");",
  "      const { alert } = globalUIStore.getState();",
  "      assert.equal(alert?.type, \"success\");",
  "      assert.equal(alert?.title, \"Saved\");",
  "      notify.hide();",
  "      assert.equal(globalUIStore.getState().alert, null);",
  "    },",
  "  },",
  "  {",
  "    specifier: \"@mrmeg/expo-ui/state/SsrViewportContext\",",
  "    validate: ({ SsrViewportContext }) => {",
  "      assert.ok(SsrViewportContext?.Provider, \"SsrViewportContext is not a React context\");",
  "    },",
  "  },",
  "];",
  "",
  "for (const entrypoint of runtimeSafeEntrypoints) {",
  "  try {",
  "    await entrypoint.validate(await import(entrypoint.specifier));",
  "  } catch (error) {",
  "    console.error(`Runtime check failed for ${entrypoint.specifier}`);",
  "    throw error;",
  "  }",
  "}",
  "console.log(`runtime-check: ${runtimeSafeEntrypoints.length} UI entrypoints load and work in Node`);",
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
  "  return <Button style={{ backgroundColor: \"#f00\", padding: 13, fontSize: 13 }} />;",
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
  "// The counts the five rules report on src/fixture.tsx: a raw color, an",
  "// off-scale padding, three restyles of Button, two raw primitives, and a",
  "// raw font size.",
  "const EXPECTED = {",
  "  \"expo-ui/no-raw-colors\": 1,",
  "  \"expo-ui/no-arbitrary-values\": 1,",
  "  \"expo-ui/no-restyle\": 3,",
  "  \"expo-ui/no-raw-primitives\": 2,",
  "  \"expo-ui/no-raw-typography\": 1,",
  "};",
  "",
  "async function main() {",
  "  assert.deepEqual(Object.keys(plugin.rules).sort(), [",
  "    \"no-arbitrary-values\",",
  "    \"no-raw-colors\",",
  "    \"no-raw-primitives\",",
  "    \"no-raw-typography\",",
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
              // Not UI peers, but what any Expo app needs to export for web.
              "@expo/metro-runtime": rootPackage.dependencies["@expo/metro-runtime"],
              "react-dom": rootPackage.dependencies["react-dom"],
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
              platforms: ["ios", "android", "web"],
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
          { kind: "expo-export", platform: "ios" },
          { kind: "expo-export", platform: "android" },
          {
            // A consumer's install decides whether the web bundle gets two copies
            // of a Radix module, and two copies is the AlertDialog crash. The
            // expected packages prove the bundle took the Radix path at all.
            kind: "expo-export",
            platform: "web",
            singletons: {
              expect: ["@radix-ui/react-alert-dialog", "@radix-ui/react-slot", "react-dom"],
            },
          },
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
        // Not a module: the FFmpeg worker script the app serves same-origin.
        entrypoint: "@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js",
        key: "./processing/video-conversion/ffmpeg-worker.js",
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
            "// What a consumer's metro.config.js or server does to serve the FFmpeg worker.",
            "const { createRequire } = await import('node:module');",
            "const ffmpegWorker = createRequire(import.meta.url).resolve('@mrmeg/expo-media/processing/video-conversion/ffmpeg-worker.js');",
            "if (!ffmpegWorker.endsWith('/dist/processing/videoConversion/ffmpeg-worker.js')) {",
            "  throw new Error(`FFmpeg worker resolved to ${ffmpegWorker}`);",
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
              ...peerDependencies,
              // The packed tarball, not the root manifest's `workspace:*`: this
              // fixture is outside the workspace. After the peers, because
              // `@mrmeg/expo-ui` is one of them.
              "@mrmeg/expo-ui": extraTarballs.ui,
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
const USAGE = "Usage: node scripts/check-package-consumer.mjs <ui|media|purchases|lint> [--tarball <path>]";
const [packageName, ...options] = process.argv.slice(2);
const target = PACKAGES[packageName];

function exitWithUsage(message) {
  console.error(`check-package-consumer: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

if (!target) {
  exitWithUsage(`unknown package "${packageName ?? ""}". Expected one of: ${packageNames.join(", ")}`);
}

/** The prebuilt tarball to test instead of building and packing one, if any. */
let providedTarball = null;
for (let index = 0; index < options.length; index += 1) {
  // `bun run pkg ui consumer-smoke -- --tarball x` forwards the `--` too.
  if (options[index] === "--") continue;
  if (options[index] === "--tarball" && options[index + 1]) {
    providedTarball = resolve(options[index + 1]);
    index += 1;
  } else {
    exitWithUsage(`unexpected argument "${options[index]}"`);
  }
}
if (providedTarball && !existsSync(providedTarball)) {
  exitWithUsage(`no tarball at ${providedTarball}`);
}

/** Every declared export target and shipped doc must exist in the installed tree. */
async function assertInstalledPackageSurface(fixtureRoot) {
  const packageRoot = join(fixtureRoot, "node_modules", target.packageName);
  const manifestPath = join(packageRoot, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`The tested tarball did not install as ${target.packageName}: no ${manifestPath}`);
  }
  const manifest = await readJson(manifestPath);

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

/**
 * Export the fixture for one platform. With `singletons`, the export writes
 * source maps and fails when a singleton package (`scripts/lib/bundleSingletons.mjs`)
 * was bundled from two copies, or when an expected package is missing — which
 * would mean the check looked at a bundle that never took the path it guards.
 */
async function exportFixture(step, fixture, fixtureRoot) {
  const outputDir = await mkdtemp(join(tmpdir(), `${fixture.prefix}${step.platform}-export-`));
  scratchDirs.push(outputDir);
  const args = ["expo", "export", "--platform", step.platform, "--output-dir", outputDir, "--no-minify"];
  if (step.singletons) args.push("--source-maps");
  run("bunx", args, { cwd: fixtureRoot });
  if (!step.singletons) return;

  const { maps, sources } = await readSourceMapSources(outputDir);
  if (maps === 0) throw new Error(`The ${step.platform} export wrote no source maps to check`);

  const bundled = bundledPackages(sources);
  const missing = step.singletons.expect.filter((name) => !bundled.has(name));
  if (missing.length > 0) {
    throw new Error(`The ${step.platform} bundle is missing ${missing.join(", ")}: the singleton check would prove nothing`);
  }

  const duplicates = findDuplicatePackages(sources);
  if (duplicates.length > 0) {
    throw new Error(
      [
        `The ${step.platform} bundle carries more than one copy of:`,
        ...duplicates.map(({ name, roots }) => `  ${name}: ${roots.join(", ")}`),
        "Two copies of a Radix module break its React context and Slottable identity",
        "(the web AlertDialog React.Children.only crash). Align the versions the package's",
        "dependencies pin so a consumer install resolves one copy.",
      ].join("\n"),
    );
  }
  console.log(`${step.platform} bundle: one copy of every singleton package (${bundled.size} packages bundled)`);
}

const root = process.cwd();
const fixtureRoots = [];
/** Temporary pack and export directories, removed on exit. */
const scratchDirs = [];
/** Tarballs by package directory, so each one is built and packed once. */
const tarballs = new Map();

/**
 * @param {string} dir a workspace package directory, repo-relative
 * @returns {Promise<string>} absolute path to the packed tarball
 */
async function packWorkspacePackage(dir) {
  const existing = tarballs.get(dir);
  if (existing) return existing;

  if (dir === target.dir && providedTarball) {
    tarballs.set(dir, providedTarball);
    return providedTarball;
  }

  const manifest = await readJson(join(root, dir, "package.json"));
  const destination = await mkdtemp(join(tmpdir(), "expo-package-pack-"));
  scratchDirs.push(destination);
  run("bun", ["run", "--cwd", dir, "build"], { cwd: root });
  run("bun", ["pm", "pack", "--destination", destination, "--quiet"], { cwd: join(root, dir) });
  const tarball = join(destination, tarballName(manifest.name, manifest.version));
  await assertFileExists(tarball, `${manifest.name} tarball`);
  tarballs.set(dir, tarball);
  return tarball;
}

try {
  const manifest = await readJson(join(root, target.dir, "package.json"));
  const rootPackage = await readJson(join(root, "package.json"));
  const tarball = await packWorkspacePackage(target.dir);
  console.log(`Consumer smoke for ${target.packageName} against ${tarball}`);

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
        await exportFixture(step, fixture, fixtureRoot);
      } else {
        throw new Error(`Unknown consumer smoke step: ${JSON.stringify(step)}`);
      }
    }
  }
  console.log(`${target.packageName} consumer smoke passed`);
} finally {
  // A provided tarball belongs to the caller (the release flow publishes it next).
  for (const dir of [...scratchDirs, ...fixtureRoots]) {
    await rm(dir, { recursive: true, force: true });
  }
}
