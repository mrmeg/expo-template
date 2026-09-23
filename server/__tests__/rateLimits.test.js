/**
 * Rate-limit configuration regression tests.
 *
 * These assert the mapping between the Bun server's scoped limiters and
 * the routes they cover. Drift here can silently downgrade a route to the
 * general 500/15-min limiter or accidentally move normal upload signing back
 * into the stricter side-effect budget.
 */

const fs = require("fs");
const path = require("path");

const {
  GENERAL_LIMIT,
  MAX_BUCKETS_PER_LIMITER,
  MEDIA_SIGNER_LIMIT,
  MEDIA_SIGNER_LIMIT_PATHS,
  STRICT_LIMIT,
  STRICT_LIMIT_PATHS,
} = require("../rateLimits");

const API_ROOT = path.resolve(__dirname, "../../app/api");

/**
 * Whether `/api/...` is served by a route under `app/api`: a static
 * `<name>+api.ts`, an `index+api.ts`, or a dynamic `[param]+api.ts` whose
 * dispatcher lists the segment as an action key.
 */
function apiRouteExists(urlPath) {
  const segments = urlPath.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const last = segments.pop();
  const dir = path.join(API_ROOT, ...segments);
  if (!last || !fs.existsSync(dir)) return false;
  if (fs.existsSync(path.join(dir, `${last}+api.ts`))) return true;
  if (fs.existsSync(path.join(dir, last, "index+api.ts"))) return true;

  const dynamic = fs.readdirSync(dir).find((name) => /^\[[^.\]]+\]\+api\.ts$/.test(name));
  if (!dynamic) return false;
  const source = fs.readFileSync(path.join(dir, dynamic), "utf8");
  const escaped = last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s{,])(["']?)${escaped}\\2\\s*:`, "m").test(source);
}

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

  it("names only routes that exist", () => {
    // A path with no route is dead config that reads like protection.
    for (const urlPath of [...STRICT_LIMIT_PATHS, ...MEDIA_SIGNER_LIMIT_PATHS]) {
      expect({ urlPath, exists: apiRouteExists(urlPath) }).toEqual({ urlPath, exists: true });
    }
  });

  it("resolves route paths the way the drift guard claims", () => {
    expect(apiRouteExists("/api/template/status")).toBe(true);
    expect(apiRouteExists("/api/billing/webhook")).toBe(true);
    expect(apiRouteExists("/api/media/delete")).toBe(true);
    expect(apiRouteExists("/api/reports")).toBe(false);
    expect(apiRouteExists("/api/billing/refund")).toBe(false);
  });

  it("bounds each limiter's bucket map", () => {
    expect(Number.isInteger(MAX_BUCKETS_PER_LIMITER)).toBe(true);
    expect(MAX_BUCKETS_PER_LIMITER).toBeGreaterThan(0);
  });
});
