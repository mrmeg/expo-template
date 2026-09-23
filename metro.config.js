/* eslint-disable no-undef */
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
const { withSentryResolver } = require("@sentry/react-native/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
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

// ============================================================================
// Workspace packages resolve to their sources
// ============================================================================
// packages/ui, packages/media, and packages/purchases list a repo-only
// "@mrmeg/source" condition first in every `exports` entry, pointing at `src`.
// Enabling it makes Metro bundle the workspace sources (no package build) through
// the same export map consumers resolve — a subpath the map does not export
// fails here too. Consumers never set the condition and get `dist`.
// tsconfig.json (`customConditions`) and test/resolver.js enable it as well.
//
// A fork that installs the packages from npm instead of editing them can delete
// this block.
const WORKSPACE_SOURCE_CONDITION = "@mrmeg/source";

config.resolver.unstable_conditionNames = Array.from(
  new Set([
    ...(config.resolver.unstable_conditionNames || []),
    WORKSPACE_SOURCE_CONDITION,
  ])
);

// Expo replaces the condition list for server bundles — API routes and
// server rendering get ["node"], React Server Components
// ["node", "react-server", "workerd"] — so the list above never reaches them.
// Add the condition back per request; client bundles already carry it.
const workspaceUpstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = workspaceUpstreamResolveRequest || context.resolveRequest;
  const conditions = context.unstable_conditionNames || [];
  if (conditions.includes(WORKSPACE_SOURCE_CONDITION)) {
    return resolve(context, moduleName, platform);
  }
  return resolve(
    {
      ...context,
      unstable_conditionNames: [...conditions, WORKSPACE_SOURCE_CONDITION],
    },
    moduleName,
    platform
  );
};
// ============================================================================
// END workspace packages
// ============================================================================

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

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest || context.resolveRequest;
  const environment = context.customResolverOptions?.environment;
  const isServerEnvironment =
    environment === "node" || environment === "react-server";
  const isDevServerEnvironment =
    isServerEnvironment && !context.customResolverOptions?.exporting;

  if (passthroughModules.has(moduleName)) {
    return resolve(context, moduleName, platform);
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

// Strip Sentry Session Replay from every bundle. Sentry.init in
// client/lib/sentry.ts never enables a replay integration, and the default
// (flag undefined) only strips it on android/ios — passing `false` extends
// that to web, dropping ~137 KB raw from the lazy Sentry chunk. The resolver
// chains to the dedupe resolveRequest installed above.
module.exports = wrapWithReanimatedMetroConfig(
  withSentryResolver(config, false)
);
