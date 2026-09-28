/**
 * @jest-environment node
 */

/**
 * Unit tests for the Bun server's rate-limit primitives: bounded bucket
 * storage, the `TRUST_PROXY` hop parser, and client-address resolution.
 * `createHandler.test.ts` covers the same behavior end to end.
 */

import {
  createApiRateLimiter,
  createFixedWindowLimiter,
  normalizeIpAddress,
  parseTrustProxy,
  resolveClientAddress,
  type RateLimitRules,
} from "../rateLimit";

function requestWithForwardedFor(value?: string): Request {
  return new Request("http://localhost/api/template/status", {
    headers: value === undefined ? {} : { "X-Forwarded-For": value },
  });
}

describe("createFixedWindowLimiter", () => {
  it("counts hits per key within the window and limits past max", () => {
    let now = 1_000;
    const limiter = createFixedWindowLimiter({ windowMs: 1_000, max: 2, maxBuckets: 10, now: () => now });

    expect(limiter.hit("a")).toMatchObject({ limited: false, remaining: 1, limit: 2, resetAt: 2_000 });
    expect(limiter.hit("a")).toMatchObject({ limited: false, remaining: 0 });
    expect(limiter.hit("a")).toMatchObject({ limited: true, remaining: 0 });
    expect(limiter.hit("b")).toMatchObject({ limited: false, remaining: 1 });

    now = 2_000;
    expect(limiter.hit("a")).toMatchObject({ limited: false, remaining: 1, resetAt: 3_000 });
  });

  it("sweeps expired buckets as new ones are created", () => {
    let now = 0;
    const limiter = createFixedWindowLimiter({ windowMs: 1_000, max: 5, maxBuckets: 100, now: () => now });
    for (const key of ["a", "b", "c"]) limiter.hit(key);
    expect(limiter.size).toBe(3);

    now = 1_500;
    limiter.hit("d");
    expect(limiter.size).toBe(1);
  });

  it("never holds more than maxBuckets, evicting the oldest bucket first", () => {
    const limiter = createFixedWindowLimiter({ windowMs: 60_000, max: 1, maxBuckets: 3, now: () => 0 });
    limiter.hit("a");
    expect(limiter.hit("a").limited).toBe(true);

    for (let i = 0; i < 1_000; i += 1) {
      limiter.hit(`client-${i}`);
      expect(limiter.size).toBeLessThanOrEqual(3);
    }

    // "a" was evicted long ago, so its count starts over.
    expect(limiter.hit("a").limited).toBe(false);
  });
});

describe("createApiRateLimiter", () => {
  const rules: RateLimitRules = {
    GENERAL_LIMIT: { windowMs: 60_000, max: 3 },
    MEDIA_SIGNER_LIMIT: { windowMs: 60_000, max: 2 },
    MEDIA_SIGNER_LIMIT_PATHS: ["/api/media/getUploadUrl"],
    STRICT_LIMIT: { windowMs: 60_000, max: 1 },
    STRICT_LIMIT_PATHS: ["/api/billing/checkout-session"],
    MAX_BUCKETS_PER_LIMITER: 100,
  };

  it("ignores paths outside /api", () => {
    const limiter = createApiRateLimiter(rules, { now: () => 0 });
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.check("/apiary", "1.1.1.1")).toBeNull();
      expect(limiter.check("/_expo/static/js/web/entry.js", "1.1.1.1")).toBeNull();
    }
    expect(limiter.sizes()).toEqual({ general: 0, mediaSigner: 0, strict: 0 });
  });

  it("stacks the scoped limiters on the general one", async () => {
    const limiter = createApiRateLimiter(rules, { now: () => 0 });
    expect(limiter.check("/api/billing/checkout-session", "1.1.1.1")).toBeNull();

    const limited = limiter.check("/api/billing/checkout-session", "1.1.1.1");
    expect(limited?.status).toBe(429);
    expect(await limited?.json()).toEqual({ error: "Too many requests, please try again later" });

    expect(limiter.check("/api/media/getUploadUrl", "2.2.2.2")).toBeNull();
    expect(limiter.check("/api/media/getUploadUrl", "2.2.2.2")).toBeNull();
    const media = limiter.check("/api/media/getUploadUrl", "2.2.2.2");
    expect(await media?.json()).toEqual({ error: "Too many upload requests, please try again later" });
  });

  it("reports the reset as delta seconds in RateLimit-Reset and Retry-After", () => {
    let now = 0;
    const limiter = createApiRateLimiter(rules, { now: () => now });
    for (let i = 0; i < 3; i += 1) limiter.check("/api/template/status", "1.1.1.1");

    now = 15_500;
    const limited = limiter.check("/api/template/status", "1.1.1.1")!;
    expect(limited.headers.get("RateLimit-Limit")).toBe("3");
    expect(limited.headers.get("RateLimit-Remaining")).toBe("0");
    expect(limited.headers.get("RateLimit-Reset")).toBe("45");
    expect(limited.headers.get("Retry-After")).toBe("45");
    expect(limited.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });
});

describe("parseTrustProxy", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    ["  ", 0],
    ["false", 0],
    ["0", 0],
    ["true", 1],
    ["TRUE", 1],
    ["1", 1],
    ["2", 2],
    ["999", 16],
  ])("parses %p as %p trusted hops", (value, hops) => {
    expect(parseTrustProxy(value)).toBe(hops);
  });

  it.each(["yes", "-1", "1.5", "loopback", "10.0.0.0/8"])("rejects %p", (value) => {
    expect(parseTrustProxy(value)).toBeNull();
  });
});

describe("normalizeIpAddress", () => {
  it.each([
    ["203.0.113.9", "203.0.113.9"],
    [" 203.0.113.9 ", "203.0.113.9"],
    ["203.0.113.9:4711", "203.0.113.9"],
    ["::ffff:203.0.113.9", "203.0.113.9"],
    ["2001:DB8::1", "2001:db8::1"],
    ["[2001:db8::1]:443", "2001:db8::1"],
    ["[2001:db8::1]", "2001:db8::1"],
    ["fe80::1%lo0", "fe80::1"],
  ])("normalizes %p to %p", (raw, normalized) => {
    expect(normalizeIpAddress(raw)).toBe(normalized);
  });

  it.each([null, undefined, "", "unknown", "_hidden", "999.1.1.1", "not an ip"])("rejects %p", (raw) => {
    expect(normalizeIpAddress(raw)).toBeNull();
  });
});

describe("resolveClientAddress", () => {
  it("uses the direct peer and ignores X-Forwarded-For by default", () => {
    expect(resolveClientAddress(requestWithForwardedFor("198.51.100.1"), "10.0.0.2", 0)).toBe("10.0.0.2");
  });

  it("reads the entry the trusted proxy appended, not client-supplied ones", () => {
    const request = requestWithForwardedFor("6.6.6.6, 198.51.100.1");
    expect(resolveClientAddress(request, "10.0.0.2", 1)).toBe("198.51.100.1");
  });

  it("walks one entry further left per extra trusted hop", () => {
    const request = requestWithForwardedFor("6.6.6.6, 198.51.100.1, 172.16.0.9");
    expect(resolveClientAddress(request, "10.0.0.2", 2)).toBe("198.51.100.1");
  });

  it("falls back to the farthest entry when the chain is shorter than the hop count", () => {
    expect(resolveClientAddress(requestWithForwardedFor("198.51.100.1"), "10.0.0.2", 3)).toBe("198.51.100.1");
  });

  it("falls back to the peer when the header is missing or its entry is not an address", () => {
    expect(resolveClientAddress(requestWithForwardedFor(), "10.0.0.2", 1)).toBe("10.0.0.2");
    expect(resolveClientAddress(requestWithForwardedFor(" , "), "10.0.0.2", 1)).toBe("10.0.0.2");
    expect(resolveClientAddress(requestWithForwardedFor("unknown"), "10.0.0.2", 1)).toBe("10.0.0.2");
  });

  it("reports an unknown peer as 'unknown'", () => {
    expect(resolveClientAddress(requestWithForwardedFor(), null, 0)).toBe("unknown");
  });
});
