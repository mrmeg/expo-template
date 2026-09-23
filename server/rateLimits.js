/**
 * Rate-limit configuration for the Bun production server
 * (`server/http/createHandler.ts`, mounted by `server.bun.ts`).
 *
 * Kept as plain data so tests can assert the mapping between routes and
 * limiters without building a handler.
 *
 * The upload signer uses a media-specific budget so batch uploads do not hit
 * the more conservative strict limiter used by endpoints with heavier side
 * effects. The general limiter covers all /api traffic and stacks with both
 * scoped limiters.
 *
 * Buckets are keyed by client address — the direct peer unless `TRUST_PROXY`
 * says how many proxies sit in front (see `docs/server-guide.md`).
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
 * Note: `/api/media/getUploadUrl` is served by the consolidated
 * `app/api/media/[action]+api.ts` route the media hook actually calls.
 * Misalignment between this list and the real route path silently downgrades
 * enforcement to the general 500/15-min bucket.
 */
const MEDIA_SIGNER_LIMIT_PATHS = [
  "/api/media/getUploadUrl",
];

/**
 * Paths that receive the strict (10/min) limiter. Every entry must name a
 * route that exists — `server/__tests__/rateLimits.test.js` resolves each one
 * against `app/api`.
 */
const STRICT_LIMIT_PATHS = [
  // Hosted-external billing session routes — session creation is abuse-prone
  // and has real-money side effects on Stripe. The webhook path is NOT
  // included here because Stripe bursts retries faster than 10/min and the
  // signature requirement already gates abuse.
  "/api/billing/checkout-session",
  "/api/billing/portal-session",
];

/**
 * Most buckets any one limiter holds. Expired buckets are swept as new ones
 * are created; at the cap the oldest bucket is evicted (that client's count
 * restarts), so memory stays bounded — roughly 150 bytes a bucket — however
 * many addresses show up.
 */
const MAX_BUCKETS_PER_LIMITER = 50000;

module.exports = {
  GENERAL_LIMIT,
  MAX_BUCKETS_PER_LIMITER,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
};
