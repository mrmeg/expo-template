/**
 * How long a signed read URL stays usable, read off the URL itself.
 *
 * The package's own handlers sign with SigV4 (`X-Amz-Expires`, the
 * `readExpiresInSeconds` of the media type), so the URL is the one place the
 * client can learn the lifetime from without a contract change — and it works
 * against every server version that ever shipped. Internal to
 * `@mrmeg/expo-media/react-query`; not a package entry point.
 */

/** A URL is re-signed at most this long before it expires. */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Share of a URL's lifetime kept as margin when that is less than
 * `SIGNED_URL_REFRESH_MARGIN_MS`, so a 60-second URL is fresh for 54 seconds
 * instead of stale on arrival.
 */
const REFRESH_MARGIN_RATIO = 0.1;

export interface SignedUrlLifetime {
  /** How long the URL is valid from when it was signed (`X-Amz-Expires`, `X-Goog-Expires`). */
  durationMs?: number;
  /** When it stops being valid (`Expires`, epoch seconds: CloudFront, SigV2, GCS V2). */
  expiresAtMs?: number;
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * The lifetime a signed URL states about itself. Parsed by hand because React
 * Native's `URL` does not implement `searchParams`.
 */
export function readSignedUrlLifetime(url: string): SignedUrlLifetime {
  const lifetime: SignedUrlLifetime = {};
  const query = url.split("#")[0].split("?")[1];
  if (!query) return lifetime;
  for (const part of query.split("&")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = decodeQueryComponent(part.slice(0, separator)).toLowerCase();
    const value = Number(decodeQueryComponent(part.slice(separator + 1)));
    if (!Number.isFinite(value) || value <= 0) continue;
    if (name === "x-amz-expires" || name === "x-goog-expires") {
      lifetime.durationMs = value * 1000;
    } else if (name === "expires") {
      lifetime.expiresAtMs = value * 1000;
    }
  }
  return lifetime;
}

/**
 * When a URL received at `receivedAt` expires, on this device's clock, or null
 * when the URL does not say. A stated duration wins over an absolute expiry:
 * measured from the moment the URL arrived, it cannot be thrown off by a device
 * clock that disagrees with the server's.
 */
export function signedUrlExpiresAt(url: string, receivedAt: number): number | null {
  const { durationMs, expiresAtMs } = readSignedUrlLifetime(url);
  if (durationMs !== undefined) return receivedAt + durationMs;
  return expiresAtMs ?? null;
}

/**
 * When a URL that expires at `expiresAt` is due for replacement: 10% of its
 * lifetime early, and never more than five minutes early.
 */
export function signedUrlRefreshAt(url: string, expiresAt: number): number {
  const { durationMs } = readSignedUrlLifetime(url);
  const margin =
    durationMs === undefined
      ? SIGNED_URL_REFRESH_MARGIN_MS
      : Math.min(SIGNED_URL_REFRESH_MARGIN_MS, durationMs * REFRESH_MARGIN_RATIO);
  return expiresAt - margin;
}
