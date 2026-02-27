/* eslint-disable no-undef */
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Deduplicate @react-navigation packages to prevent context mismatch
// between expo-router's nested copy and the hoisted copy (bun hoisting issue)
const dedupePackages = {
  "@react-navigation/native": path.resolve(__dirname, "node_modules/@react-navigation/native"),
  "@react-navigation/core": path.resolve(__dirname, "node_modules/@react-navigation/core"),
};
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
// To remove: Delete from here to "END FFmpeg" and delete client/lib/videoConversion/
// ============================================================================
const fs = require("fs");

const ffmpegWorkerPath = path.join(__dirname, "/client/lib/videoConversion/ffmpeg-worker.js");
if (fs.existsSync(ffmpegWorkerPath)) {
  const ffmpegWorker = fs.readFileSync(ffmpegWorkerPath, "utf8");
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
          res.end(ffmpegWorker);
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
