/**
 * Rate-limit configuration for the Express production server.
 *
 * Kept as plain data so tests can assert the mapping between routes and
 * limiters without loading the full server (which binds a port).
 *
 * The upload signer uses a media-specific budget so batch uploads do not hit
 * the more conservative strict limiter used by endpoints with heavier side
 * effects. The general limiter covers all /api traffic and stacks with both
 * scoped limiters.
 */

const GENERAL_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
};

const STRICT_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 10,
};

const MEDIA_SIGNER_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 60,
};

/**
 * Paths that receive the media signer limiter.
 *
 * Note: `/api/media/getUploadUrl` matches the Expo Router API file
 * `app/api/media/getUploadUrl+api.ts` that the media hook actually calls.
 * Misalignment between this list and the real route path silently downgrades
 * enforcement to the general 500/15-min bucket.
 */
const MEDIA_SIGNER_LIMIT_PATHS = [
  "/api/media/getUploadUrl",
];

/**
 * Paths that receive the strict (10/min) limiter.
 */
const STRICT_LIMIT_PATHS = [
  "/api/reports",
  "/api/corrections",
  // Hosted-external billing session routes — session creation is abuse-prone
  // and has real-money side effects on Stripe. The webhook path is NOT
  // included here because Stripe bursts retries faster than 10/min and the
  // signature requirement already gates abuse.
  "/api/billing/checkout-session",
  "/api/billing/portal-session",
];

module.exports = {
  GENERAL_LIMIT,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
};
