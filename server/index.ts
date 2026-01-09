#!/usr/bin/env node

const path = require("path");
const { createRequestHandler } = require("expo-server/adapter/express");

const express = require("express");
const compression = require("compression");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const CLIENT_BUILD_DIR = path.join(process.cwd(), "dist/client");
const SERVER_BUILD_DIR = path.join(process.cwd(), "dist/server");

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Stricter rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Apply general rate limiting to all API routes
app.use("/api", generalLimiter);

// Apply strict rate limiting to upload and auth-related endpoints
app.use("/api/media/upload-url", strictLimiter);
app.use("/api/reports", strictLimiter);
app.use("/api/corrections", strictLimiter);

app.use(
  express.static(CLIENT_BUILD_DIR, {
    maxAge: "1h",
    extensions: ["html"],
  })
);

// ============================================================================
// FFmpeg Video Conversion (OPTIONAL)
// To remove: Delete from here to "END FFmpeg" and delete client/lib/videoConversion/
// ============================================================================
const fs = require("fs");
const ffmpegWorkerPath = path.join(process.cwd(), "/client/lib/videoConversion/ffmpeg-worker.js");
if (fs.existsSync(ffmpegWorkerPath)) {
  const ffmpegWorker = fs.readFileSync(ffmpegWorkerPath, "utf8");
  app.get("/_expo/static/js/web/ffmpeg-worker.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(ffmpegWorker);
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
