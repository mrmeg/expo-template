/**
 * Rate-limit configuration for the Express production server.
 *
 * Kept as plain data so tests can assert the mapping between routes and
 * limiters without loading the full server (which binds a port).
 *
 * The strict limiter enforces the 10-request-per-minute budget documented in
 * Agent/Docs/PERFORMANCE.md for the most abuse-prone endpoints. The general
 * limiter covers all /api traffic and stacks with the strict one.
 */

const GENERAL_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
};

const STRICT_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 10,
};

/**
 * Paths that receive the strict (10/min) limiter.
 *
 * Note: `/api/media/getUploadUrl` matches the Expo Router API file
 * `app/api/media/getUploadUrl+api.ts` that the media hook actually calls.
 * Misalignment between this list and the real route path silently downgrades
 * enforcement to the general 500/15-min bucket.
 */
const STRICT_LIMIT_PATHS = [
  "/api/media/getUploadUrl",
  "/api/reports",
  "/api/corrections",
];

module.exports = {
  GENERAL_LIMIT,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
};
