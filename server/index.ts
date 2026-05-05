#!/usr/bin/env node

const path = require("path");
const { createRequestHandler } = require("expo-server/adapter/express");

const express = require("express");
const compression = require("compression");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const {
  GENERAL_LIMIT,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
} = require("./rateLimits");

const CLIENT_BUILD_DIR = path.join(process.cwd(), "dist/client");
const SERVER_BUILD_DIR = path.join(process.cwd(), "dist/server");
const BUN_ASSET_DIR = path.join(CLIENT_BUILD_DIR, "assets/node_modules/.bun");

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // Request ID for log correlation
  const crypto = require("crypto");
  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);
  req.requestId = requestId;
  next();
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:8081", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Rate limiting - general API limit
const generalLimiter = rateLimit({
  ...GENERAL_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Media upload URL signing supports normal batch uploads without sharing the
// stricter side-effect budget used by billing/report/correction endpoints.
const mediaSignerLimiter = rateLimit({
  ...MEDIA_SIGNER_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later" },
});

// Stricter rate limiting for sensitive endpoints (see server/rateLimits.js)
const strictLimiter = rateLimit({
  ...STRICT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Apply general rate limiting to all API routes
app.use("/api", generalLimiter);

// Apply route-specific rate limiting.
// Paths are defined in ./rateLimits.js so tests can assert coverage.
for (const path of MEDIA_SIGNER_LIMIT_PATHS) {
  app.use(path, mediaSignerLimiter);
}

for (const path of STRICT_LIMIT_PATHS) {
  app.use(path, strictLimiter);
}

// Bun's virtual store lives under node_modules/.bun, and Expo exports assets
// such as @expo/vector-icons fonts using that real path. Express static ignores
// dot-directories by default, so expose only the generated Bun asset subtree.
app.use(
  "/assets/node_modules/.bun",
  express.static(BUN_ASSET_DIR, {
    dotfiles: "allow",
    immutable: true,
    maxAge: "1y",
  })
);

app.use(
  express.static(CLIENT_BUILD_DIR, {
    maxAge: "1h",
    extensions: ["html"],
  })
);

// ============================================================================
// FFmpeg Video Conversion (OPTIONAL)
// To remove: Delete from here to "END FFmpeg" and delete
// client/features/media/lib/videoConversion/
// ============================================================================
const { FFMPEG_WORKER_URL, loadFfmpegWorker } = require("./ffmpegWorker");
const ffmpegWorkerAsset = loadFfmpegWorker(process.cwd());
if (ffmpegWorkerAsset) {
  app.get(FFMPEG_WORKER_URL, (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(ffmpegWorkerAsset.contents);
  });
}
// ============================================================================
// END FFmpeg
// ============================================================================

app.use(morgan("tiny"));

app.all(
  "/{*all}",
  createRequestHandler({
    build: SERVER_BUILD_DIR,
  })
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
