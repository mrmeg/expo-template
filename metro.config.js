/* eslint-disable no-undef */
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
const {
  withSentryFeedbackResolver,
  withSentryResolver,
} = require("@sentry/react-native/metro");
const {
  describeOmittedIntegration,
  getOmittedIntegrationFor,
} = require("./metro/resolverRules");
const path = require("path");

const config = getDefaultConfig(__dirname);
const useLocalUiSource = process.env.EXPO_UI_LOCAL_SOURCE === "1";
const appNodeModules = path.resolve(__dirname, "node_modules");
const resolveAppPackage = (packageName) =>
  fs.realpathSync(path.resolve(appNodeModules, packageName));

const resolvePackageFrom = (packageName, fromPackageName) => {
  const fromPackageRoot = path.dirname(
    require.resolve(`${fromPackageName}/package.json`)
  );
  return fs.realpathSync(
    path.dirname(
      require.resolve(`${packageName}/package.json`, {
        paths: [fromPackageRoot],
      })
    )
  );
};

// LOCAL UI PACKAGE DEVELOPMENT ONLY.
//
// This block is only needed when working on packages/ui from inside this
// monorepo and you want Metro to read package source directly:
// EXPO_UI_LOCAL_SOURCE=1 bun run web
//
// Forked apps and external consumers should resolve @mrmeg/expo-ui through
// package.json exports instead. If your fork does not edit packages/ui, delete
// this entire EXPO_UI_LOCAL_SOURCE block and the path import above if unused.
if (useLocalUiSource) {
  const uiPackageRoot = path.resolve(__dirname, "packages/ui");
  const uiPackagePath = path.join(uiPackageRoot, "src");

  config.watchFolders = Array.from(
    new Set([...(config.watchFolders || []), uiPackageRoot])
  );
  config.resolver = {
    ...config.resolver,
    extraNodeModules: {
      ...(config.resolver.extraNodeModules || {}),
      "@mrmeg/expo-ui": uiPackagePath,
    },
  };
}

config.resolver.nodeModulesPaths = Array.from(
  new Set([appNodeModules, ...(config.resolver.nodeModulesPaths || [])])
);

// Keep singleton runtime packages pointed at the app-level install, and point
// Expo's pretty-format import at the exact package Expo resolves under Node.
const dedupePackages = {
  react: resolveAppPackage("react"),
  "react-dom": resolveAppPackage("react-dom"),
  "react-native": resolveAppPackage("react-native"),
  "@tanstack/react-query": resolveAppPackage("@tanstack/react-query"),
  "react-native-reanimated": resolveAppPackage("react-native-reanimated"),
  "react-native-gesture-handler": resolveAppPackage(
    "react-native-gesture-handler"
  ),
  "react-native-safe-area-context": resolveAppPackage(
    "react-native-safe-area-context"
  ),
  "expo-web-browser": resolveAppPackage("expo-web-browser"),
  "pretty-format": resolvePackageFrom("pretty-format", "expo"),
  // @clerk/clerk-expo and @clerk/clerk-react each nest their own copy of
  // @clerk/shared 3.x, double-shipping it in the lazy Clerk chunk. Collapse
  // onto clerk-react's copy — but only in client bundles (see
  // clientOnlyDedupePackages): @clerk/backend, used by API routes in the node
  // environment, depends on @clerk/shared 4.x and must keep its own copy.
  "@clerk/shared": resolvePackageFrom("@clerk/shared", "@clerk/clerk-react"),
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...dedupePackages,
};

// In dev-server (node / react-server) bundles, Expo externalizes `react` and
// `react-dom` (and `@radix-ui/*`) to runtime Node requires so the whole SSR
// process shares one copy. Rewriting those names to absolute paths here would
// bypass that matcher and bundle a second React, giving externalized packages
// a null hooks dispatcher ("Cannot read properties of null (reading
// 'useContext')" from Radix during dev SSR). Production export disables the
// externals, so the rewrite stays active there.
const serverExternalizedPackages = new Set(["react", "react-dom"]);

// Packages whose dedupe rewrite must never apply to node / react-server
// bundles — the server graph legitimately needs a different copy.
const clientOnlyDedupePackages = new Set(["@clerk/shared"]);

// Specifiers that must reach the resolver verbatim. Since React Native 0.88 its
// public subpaths (`react-native/setup-env`, `react-native/asset-registry`, …) are
// `exports`-map entries with no file at the literal path, so rewriting them to an
// absolute path fails to resolve. Keeping the bare specifier also lets Expo claim
// `react-native/asset-registry` for its shared virtual registry module. The app
// holds the only react-native copy, so skipping the rewrite still dedupes.
const reactNativeExports = require("react-native/package.json").exports ?? {};
const passthroughModules = new Set(
  Object.keys(reactNativeExports)
    .filter((key) => key.startsWith("./") && !key.includes("*"))
    .map((key) => `react-native/${key.slice(2)}`)
);

// Resolver stubs (metro/resolverRules.js, docs/bundle-analysis.md):
// - Optional native integrations. In production iOS/Android bundles, the
//   Sentry, Amplify, and Clerk imports inside their env-gated app modules
//   resolve to an empty module while that SDK's env is blank; native has no
//   code splitting, so otherwise every build shipped all three. Web keeps its
//   lazy chunks, and dev keeps the SDKs so `.env` edits apply without a restart.
const projectRoots = Array.from(new Set([__dirname, fs.realpathSync(__dirname)]));
const reportedOmissions = new Set();

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest || context.resolveRequest;
  const environment = context.customResolverOptions?.environment;
  const isServerEnvironment =
    environment === "node" || environment === "react-server";
  const isDevServerEnvironment =
    isServerEnvironment && !context.customResolverOptions?.exporting;
  const { originModulePath } = context;
  const request = {
    moduleName,
    originModulePath,
    platform,
    dev: context.dev,
    environment,
    env: process.env,
  };

  if (passthroughModules.has(moduleName)) {
    return resolve(context, moduleName, platform);
  }

  const omittedIntegration = getOmittedIntegrationFor({ ...request, projectRoots });
  if (omittedIntegration) {
    const report = `${platform}:${omittedIntegration.name}`;
    if (!reportedOmissions.has(report)) {
      reportedOmissions.add(report);
      console.log(describeOmittedIntegration(omittedIntegration, platform, process.env));
    }
    return { type: "empty" };
  }

  for (const [packageName, packagePath] of Object.entries(dedupePackages)) {
    if (moduleName === packageName || moduleName.startsWith(`${packageName}/`)) {
      if (isDevServerEnvironment && serverExternalizedPackages.has(packageName)) {
        break;
      }
      if (isServerEnvironment && clientOnlyDedupePackages.has(packageName)) {
        break;
      }
      return resolve(
        context,
        moduleName.replace(packageName, packagePath),
        platform
      );
    }
  }

  return resolve(context, moduleName, platform);
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});

// ============================================================================
// FFmpeg Video Conversion (OPTIONAL)
// To remove: Delete from here to "END FFmpeg". The worker itself ships with
// the reusable media package
// (packages/media/src/processing/videoConversion/ffmpeg-worker.js); this
// block only serves it over the dev server.
// ============================================================================
const { loadFfmpegWorker } = require("./server/ffmpegWorker");

const ffmpegWorkerAsset = loadFfmpegWorker(__dirname);
if (ffmpegWorkerAsset) {
  const existingMiddleware = config.server?.enhanceMiddleware;
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware, metroServer) => {
      const enhanced = existingMiddleware
        ? existingMiddleware(middleware, metroServer)
        : middleware;
      return (req, res, next) => {
        if (req.url?.endsWith("ffmpeg-worker.js")) {
          res.setHeader("Content-Type", "application/javascript");
          res.end(ffmpegWorkerAsset.contents);
          return;
        }
        return enhanced(req, res, next);
      };
    },
  };
}
// ============================================================================
// END FFmpeg
// ============================================================================

// Strip Sentry Session Replay and User Feedback from every bundle. Neither
// Sentry wrapper (client/lib/sentry.ts, client/lib/sentry.web.ts) enables a
// replay or feedback integration, and the default (flag undefined) only strips
// them on android/ios — passing `false` extends that to web, dropping ~137 KB
// (replay) and ~51 KB (feedback, including @sentry/browser's feedbackSync /
// feedbackAsync wrappers) raw from the lazy Sentry chunk. `getFeedback` and
// `sendFeedback` from @sentry/react are undefined as a result; drop the second
// wrapper before adding a feedback widget. The resolvers chain to the
// resolveRequest installed above.
module.exports = wrapWithReanimatedMetroConfig(
  withSentryFeedbackResolver(withSentryResolver(config, false), false)
);
