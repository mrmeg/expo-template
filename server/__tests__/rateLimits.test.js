/**
 * Rate-limit configuration regression tests.
 *
 * These assert the mapping between the Express server's scoped limiters and
 * the routes they cover. Drift here can silently downgrade a route to the
 * general 500/15-min limiter or accidentally move normal upload signing back
 * into the stricter side-effect budget.
 */

const {
  GENERAL_LIMIT,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
} = require("../rateLimits");

describe("server/rateLimits", () => {
  it("keeps the documented 10-requests-per-minute strict budget", () => {
    expect(STRICT_LIMIT.max).toBe(10);
    expect(STRICT_LIMIT.windowMs).toBe(60 * 1000);
  });

  it("keeps the 500-per-15min general budget", () => {
    expect(GENERAL_LIMIT.max).toBe(500);
    expect(GENERAL_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });

  it("keeps the media signer budget practical for batch uploads", () => {
    expect(MEDIA_SIGNER_LIMIT.max).toBe(60);
    expect(MEDIA_SIGNER_LIMIT.windowMs).toBe(60 * 1000);
  });

  it("covers the real upload-url route with the media signer limiter", () => {
    // client/features/media/hooks/useMediaUpload.ts calls /api/media/getUploadUrl.
    // The media signer limiter MUST include that exact path; misalignment
    // downgrades upload URL signing to the general limiter.
    expect(MEDIA_SIGNER_LIMIT_PATHS).toContain("/api/media/getUploadUrl");
    expect(STRICT_LIMIT_PATHS).not.toContain("/api/media/getUploadUrl");
  });

  it("does not reintroduce the stale /api/media/upload-url path", () => {
    expect(MEDIA_SIGNER_LIMIT_PATHS).not.toContain("/api/media/upload-url");
    expect(STRICT_LIMIT_PATHS).not.toContain("/api/media/upload-url");
  });

  it("covers billing session routes under the strict limiter", () => {
    expect(STRICT_LIMIT_PATHS).toContain("/api/billing/checkout-session");
    expect(STRICT_LIMIT_PATHS).toContain("/api/billing/portal-session");
  });

  it("does NOT strict-limit the Stripe webhook (Stripe retries burst past 10/min)", () => {
    expect(STRICT_LIMIT_PATHS).not.toContain("/api/billing/webhook");
  });
});
