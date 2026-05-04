/* eslint-disable no-undef */
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
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

// Bun installs packages in virtual folders under node_modules/.bun. Metro can
// start package resolution from those virtual folders and then probe nested
// package paths that Bun does not create, such as
// expo/node_modules/pretty-format/package.json. Keep singleton runtime
// packages pointed at the app-level install, and point Expo's pretty-format
// import at the exact Bun store package Expo resolves under Node.
const dedupePackages = {
  "@react-navigation/native": resolveAppPackage("@react-navigation/native"),
  "@react-navigation/core": resolveAppPackage("@react-navigation/core"),
  react: resolveAppPackage("react"),
  "react-dom": resolveAppPackage("react-dom"),
  "react-native": resolveAppPackage("react-native"),
  "react-native-reanimated": resolveAppPackage("react-native-reanimated"),
  "react-native-gesture-handler": resolveAppPackage(
    "react-native-gesture-handler"
  ),
  "react-native-safe-area-context": resolveAppPackage(
    "react-native-safe-area-context"
  ),
  "pretty-format": resolvePackageFrom("pretty-format", "expo"),
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...dedupePackages,
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [packageName, packagePath] of Object.entries(dedupePackages)) {
    if (moduleName === packageName || moduleName.startsWith(`${packageName}/`)) {
      const resolve = originalResolveRequest || context.resolveRequest;
      return resolve(
        context,
        moduleName.replace(packageName, packagePath),
        platform
      );
    }
  }

  const resolve = originalResolveRequest || context.resolveRequest;
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
// To remove: Delete from here to "END FFmpeg" and delete
// client/features/media/lib/videoConversion/
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

module.exports = wrapWithReanimatedMetroConfig(config);
