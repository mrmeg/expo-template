/**
 * In-memory fixed-window rate limiting for the Bun server, plus the client
 * address the buckets are keyed by.
 *
 * Memory is bounded: each limiter keeps its buckets in insertion order, which
 * is also expiry order (every bucket in a limiter lives for the same window),
 * so expired buckets are swept from the front whenever a new one is created,
 * and at the cap the oldest bucket is evicted — that client's count restarts
 * rather than the map growing.
 *
 * Buckets live in this process only. Several server processes each count on
 * their own; put a shared store (Redis, the platform's rate limiter) in front
 * when that matters.
 */

import { isIP } from "node:net";

export interface RateLimitWindow {
  windowMs: number;
  max: number;
}

/** The shape of `server/rateLimits.js`. */
export interface RateLimitRules {
  GENERAL_LIMIT: RateLimitWindow;
  MEDIA_SIGNER_LIMIT: RateLimitWindow;
  MEDIA_SIGNER_LIMIT_PATHS: readonly string[];
  STRICT_LIMIT: RateLimitWindow;
  STRICT_LIMIT_PATHS: readonly string[];
  MAX_BUCKETS_PER_LIMITER: number;
}

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the window resets. */
  resetAt: number;
}

export interface FixedWindowLimiter {
  hit(key: string): RateLimitResult;
  /** Buckets currently held. */
  readonly size: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createFixedWindowLimiter(options: RateLimitWindow & {
  maxBuckets: number;
  now?: () => number;
}): FixedWindowLimiter {
  const { windowMs, max } = options;
  const maxBuckets = Math.max(1, Math.floor(options.maxBuckets));
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function sweepExpired(at: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt > at) {
        return;
      }
      buckets.delete(key);
    }
  }

  return {
    hit(key) {
      const at = now();
      let bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= at) {
        // Re-insert so the new window moves to the back of the expiry order.
        buckets.delete(key);
        sweepExpired(at);
        while (buckets.size >= maxBuckets) {
          const oldest = buckets.keys().next().value;
          if (oldest === undefined) break;
          buckets.delete(oldest);
        }
        bucket = { count: 0, resetAt: at + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;
      return {
        limited: bucket.count > max,
        limit: max,
        remaining: Math.max(max - bucket.count, 0),
        resetAt: bucket.resetAt,
      };
    },
    get size() {
      return buckets.size;
    },
  };
}

function routeMatches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export interface ApiRateLimiter {
  /** A 429 response when `clientKey` is over a limit covering `pathname`, else null. */
  check(pathname: string, clientKey: string): Response | null;
  /** Buckets held per limiter, for tests and diagnostics. */
  sizes(): { general: number; mediaSigner: number; strict: number };
}

/**
 * The limiter stack from `server/rateLimits.js`: the general limiter covers
 * all of `/api` and stacks with the media-signer and strict limiters on the
 * paths they list.
 */
export function createApiRateLimiter(
  rules: RateLimitRules,
  options: { now?: () => number } = {},
): ApiRateLimiter {
  const now = options.now ?? Date.now;
  const maxBuckets = rules.MAX_BUCKETS_PER_LIMITER;
  const general = createFixedWindowLimiter({ ...rules.GENERAL_LIMIT, maxBuckets, now });
  const mediaSigner = createFixedWindowLimiter({ ...rules.MEDIA_SIGNER_LIMIT, maxBuckets, now });
  const strict = createFixedWindowLimiter({ ...rules.STRICT_LIMIT, maxBuckets, now });

  return {
    check(pathname, clientKey) {
      if (!routeMatches(pathname, "/api")) {
        return null;
      }

      const generalResult = general.hit(clientKey);
      if (generalResult.limited) {
        return rateLimitResponse(generalResult, "Too many requests, please try again later", now());
      }

      if (rules.MEDIA_SIGNER_LIMIT_PATHS.some((route) => routeMatches(pathname, route))) {
        const mediaResult = mediaSigner.hit(clientKey);
        if (mediaResult.limited) {
          return rateLimitResponse(mediaResult, "Too many upload requests, please try again later", now());
        }
      }

      if (rules.STRICT_LIMIT_PATHS.some((route) => routeMatches(pathname, route))) {
        const strictResult = strict.hit(clientKey);
        if (strictResult.limited) {
          return rateLimitResponse(strictResult, "Too many requests, please try again later", now());
        }
      }

      return null;
    },
    sizes() {
      return { general: general.size, mediaSigner: mediaSigner.size, strict: strict.size };
    },
  };
}

/**
 * `RateLimit-Reset` and `Retry-After` are both delta seconds, as the IETF
 * RateLimit header draft defines them.
 */
export function rateLimitResponse(result: RateLimitResult, message: string, at: number): Response {
  const secondsLeft = String(Math.max(Math.ceil((result.resetAt - at) / 1000), 1));
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "RateLimit-Limit": String(result.limit),
      "RateLimit-Remaining": String(result.remaining),
      "RateLimit-Reset": secondsLeft,
      "Retry-After": secondsLeft,
    },
  });
}

/** Upper bound on `TRUST_PROXY` hops; no real deployment chains more proxies. */
const MAX_TRUSTED_HOPS = 16;

/**
 * Parse `TRUST_PROXY`: how many reverse proxies in front of the server append
 * to `X-Forwarded-For`. Blank, `false`, or `0` trusts none (the default);
 * `true` is shorthand for 1. Returns null for anything else so the caller
 * can warn and fall back to trusting none.
 */
export function parseTrustProxy(value: string | undefined): number | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "" || normalized === "false" || normalized === "0") return 0;
  if (normalized === "true") return 1;
  if (/^\d+$/.test(normalized)) return Math.min(Number(normalized), MAX_TRUSTED_HOPS);
  return null;
}

/**
 * Canonical form of an IP address, or null when `raw` is not one. Strips a
 * port (`1.2.3.4:80`, `[::1]:80`), brackets, and an IPv6 zone, and unwraps
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) so one client gets one bucket.
 */
export function normalizeIpAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();

  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) {
    value = bracketed[1];
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  const zone = value.indexOf("%");
  if (zone !== -1) {
    value = value.slice(0, zone);
  }

  value = value.toLowerCase();
  if (value.startsWith("::ffff:") && isIP(value.slice(7)) === 4) {
    value = value.slice(7);
  }
  return isIP(value) ? value : null;
}

/**
 * The address a request is attributed to. By default that is the direct
 * peer — `X-Forwarded-For` is ignored, because any client can send one.
 * With `trustedHops` proxies in front, the proxy that connected (hop 0) and
 * the entries it and the proxies before it appended are trusted, and the
 * entry `trustedHops` places from the right is the client. Entries further
 * left are client-supplied and never read.
 */
export function resolveClientAddress(
  request: Request,
  peerAddress: string | null | undefined,
  trustedHops: number,
): string {
  const peer = normalizeIpAddress(peerAddress) ?? "unknown";
  if (trustedHops <= 0) {
    return peer;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return peer;
  }

  const hops = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (hops.length === 0) {
    return peer;
  }
  const candidate = hops[Math.max(hops.length - trustedHops, 0)];
  return normalizeIpAddress(candidate) ?? peer;
}
