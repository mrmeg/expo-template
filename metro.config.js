/* eslint-disable no-undef */
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const uiPackagePath = path.resolve(__dirname, "packages/ui/src");

// Deduplicate @react-navigation packages to prevent context mismatch
// between expo-router's nested copy and the hoisted copy (bun hoisting issue)
const dedupePackages = {
  "@react-navigation/native": path.resolve(__dirname, "node_modules/@react-navigation/native"),
  "@react-navigation/core": path.resolve(__dirname, "node_modules/@react-navigation/core"),
  "react": path.resolve(__dirname, "node_modules/react"),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
  "react-native-reanimated": path.resolve(__dirname, "node_modules/react-native-reanimated"),
  "react-native-gesture-handler": path.resolve(__dirname, "node_modules/react-native-gesture-handler"),
  "react-native-safe-area-context": path.resolve(__dirname, "node_modules/react-native-safe-area-context"),
};
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@mrmeg/expo-ui") {
    const resolve = originalResolveRequest || context.resolveRequest;
    return resolve(context, path.join(uiPackagePath, "index.ts"), platform);
  }

  if (moduleName.startsWith("@mrmeg/expo-ui/")) {
    const resolve = originalResolveRequest || context.resolveRequest;
    const subpath = moduleName.replace("@mrmeg/expo-ui/", "");
    const sourcePath = subpath.includes("/")
      ? path.join(uiPackagePath, `${subpath}.tsx`)
      : path.join(uiPackagePath, subpath, "index.ts");
    return resolve(context, sourcePath, platform);
  }

  for (const [pkg, pkgPath] of Object.entries(dedupePackages)) {
    if (moduleName === pkg || moduleName.startsWith(pkg + "/")) {
      const newName = moduleName.replace(pkg, pkgPath);
      const resolve = originalResolveRequest || context.resolveRequest;
      return resolve(context, newName, platform);
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
