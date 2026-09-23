import {
  SIGNED_URL_REFRESH_MARGIN_MS,
  readSignedUrlLifetime,
  signedUrlExpiresAt,
  signedUrlRefreshAt,
} from "../signedUrlLifetime";

const SIGV4 =
  "https://account.r2.cloudflarestorage.com/bucket/users/a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
  "&X-Amz-Credential=key%2F20260923%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260923T120000Z" +
  "&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=abc";

describe("readSignedUrlLifetime", () => {
  it("reads a SigV4 duration, as the package's handlers sign it", () => {
    expect(readSignedUrlLifetime(SIGV4)).toEqual({ durationMs: 86_400_000 });
  });

  it("reads a GCS V4 duration and an absolute Expires, case-insensitively", () => {
    expect(readSignedUrlLifetime("https://storage.googleapis.com/b/o?x-goog-expires=600&x-goog-signature=s")).toEqual({
      durationMs: 600_000,
    });
    expect(readSignedUrlLifetime("https://d111.cloudfront.net/a.jpg?Expires=1790000000&Signature=s")).toEqual({
      expiresAtMs: 1_790_000_000_000,
    });
  });

  it("states nothing for URLs without a lifetime", () => {
    expect(readSignedUrlLifetime("https://cdn.example/a.jpg")).toEqual({});
    expect(readSignedUrlLifetime("https://cdn.example/a.jpg?v=2#frag")).toEqual({});
    expect(readSignedUrlLifetime("https://cdn.example/a.jpg?X-Amz-Expires=soon")).toEqual({});
    expect(readSignedUrlLifetime("https://cdn.example/a.jpg?X-Amz-Expires=0")).toEqual({});
  });
});

describe("signedUrlExpiresAt", () => {
  it("measures a duration from when the URL arrived, on this device's clock", () => {
    expect(signedUrlExpiresAt(SIGV4, 1_000)).toBe(1_000 + 86_400_000);
  });

  it("prefers a stated duration over an absolute expiry", () => {
    expect(signedUrlExpiresAt("https://x/a?Expires=100&X-Amz-Expires=60", 5_000)).toBe(65_000);
  });

  it("uses an absolute expiry when that is all the URL states, and null when it states nothing", () => {
    expect(signedUrlExpiresAt("https://x/a?Expires=100", 5_000)).toBe(100_000);
    expect(signedUrlExpiresAt("https://x/a", 5_000)).toBeNull();
  });
});

describe("signedUrlRefreshAt", () => {
  it("refreshes a day-long URL five minutes early", () => {
    expect(signedUrlRefreshAt(SIGV4, 86_400_000)).toBe(86_400_000 - SIGNED_URL_REFRESH_MARGIN_MS);
  });

  it("keeps 10% of a short lifetime as margin", () => {
    expect(signedUrlRefreshAt("https://x/a?X-Amz-Expires=60", 60_000)).toBe(54_000);
  });

  it("uses the full margin for an absolute expiry", () => {
    expect(signedUrlRefreshAt("https://x/a?Expires=100", 100_000)).toBe(100_000 - SIGNED_URL_REFRESH_MARGIN_MS);
  });
});
