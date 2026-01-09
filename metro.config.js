/* eslint-disable no-undef */
const { getDefaultConfig } = require("expo/metro-config");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

const config = getDefaultConfig(__dirname);

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
const path = require("path");
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
