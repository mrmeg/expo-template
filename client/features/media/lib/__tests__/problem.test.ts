/**
 * Tests for the media client's typed problem mapping.
 *
 * The contract:
 *   - 503 with `code: "media-disabled"` becomes `{ kind: "disabled", missing }`
 *   - 401 becomes `{ kind: "unauthorized" }`
 *   - 400 becomes `{ kind: "bad-request", message }`
 *   - everything else becomes `{ kind: "unknown", status, message }`
 *   - the React Query retry callback never retries `disabled`/`bad-request`/
 *     `unauthorized` problems but still retries (twice) for unknown errors
 */

import {
  isMediaError,
  MediaError,
  shouldRetryMediaError,
  toMediaError,
} from "../problem";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("toMediaError", () => {
  it("maps a 503 media-disabled body to a disabled MediaError with missing list", async () => {
    const res = jsonResponse(503, {
      code: "media-disabled",
      message: "not configured",
      missing: ["R2_BUCKET", "R2_ACCESS_KEY_ID"],
    });
    const err = await toMediaError(res);
    expect(err).toBeInstanceOf(MediaError);
    expect(err.problem).toEqual({
      kind: "disabled",
      missing: ["R2_BUCKET", "R2_ACCESS_KEY_ID"],
    });
    expect(err.message).toBe("Media storage is not configured.");
  });

  it("maps a 503 without a typed code to unknown (so generic gateway 503s aren't mistaken for disabled)", async () => {
    const res = jsonResponse(503, { message: "upstream timeout" });
    const err = await toMediaError(res);
    expect(err.problem.kind).toBe("unknown");
  });

  it("filters out non-string entries from missing[] defensively", async () => {
    const res = jsonResponse(503, {
      code: "media-disabled",
      missing: ["R2_BUCKET", 42, null, "R2_ACCESS_KEY_ID"],
    });
    const err = await toMediaError(res);
    expect(err.problem.kind).toBe("disabled");
    if (err.problem.kind === "disabled") {
      expect(err.problem.missing).toEqual(["R2_BUCKET", "R2_ACCESS_KEY_ID"]);
    }
  });

  it("maps 401 to unauthorized regardless of body", async () => {
    const res = jsonResponse(401, {});
    const err = await toMediaError(res);
    expect(err.problem).toEqual({ kind: "unauthorized" });
  });

  it("maps 400 to bad-request and surfaces the message", async () => {
    const res = jsonResponse(400, { message: "Missing key parameter" });
    const err = await toMediaError(res);
    expect(err.problem).toEqual({
      kind: "bad-request",
      message: "Missing key parameter",
    });
  });

  it("maps any other status to unknown with the original status code", async () => {
    const res = jsonResponse(500, { message: "internal error" });
    const err = await toMediaError(res);
    expect(err.problem).toEqual({
      kind: "unknown",
      status: 500,
      message: "internal error",
    });
  });

  it("falls back to a generic message when the body has no `message` field", async () => {
    const res = jsonResponse(502, {});
    const err = await toMediaError(res);
    expect(err.problem).toEqual({
      kind: "unknown",
      status: 502,
      message: "Request failed (502)",
    });
  });

  it("does not throw when the body is not valid JSON", async () => {
    const res = new Response("<html>oops</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });
    const err = await toMediaError(res);
    expect(err.problem.kind).toBe("unknown");
  });
});

describe("isMediaError", () => {
  it("narrows MediaError instances and rejects plain errors", () => {
    expect(isMediaError(new MediaError({ kind: "disabled" }))).toBe(true);
    expect(isMediaError(new Error("boom"))).toBe(false);
    expect(isMediaError("nope")).toBe(false);
    expect(isMediaError(undefined)).toBe(false);
  });
});

describe("shouldRetryMediaError", () => {
  it("never retries a disabled problem", () => {
    expect(shouldRetryMediaError(0, new MediaError({ kind: "disabled" }))).toBe(false);
    expect(shouldRetryMediaError(5, new MediaError({ kind: "disabled" }))).toBe(false);
  });

  it("never retries an unauthorized or bad-request problem", () => {
    expect(shouldRetryMediaError(0, new MediaError({ kind: "unauthorized" }))).toBe(false);
    expect(
      shouldRetryMediaError(0, new MediaError({ kind: "bad-request", message: "x" })),
    ).toBe(false);
  });

  it("retries unknown MediaErrors twice (matching React Query's default soft retry budget)", () => {
    const err = new MediaError({ kind: "unknown", status: 500, message: "oops" });
    expect(shouldRetryMediaError(0, err)).toBe(true);
    expect(shouldRetryMediaError(1, err)).toBe(true);
    expect(shouldRetryMediaError(2, err)).toBe(false);
  });

  it("retries plain Errors using the same budget so transient network failures still get a chance", () => {
    expect(shouldRetryMediaError(0, new Error("network"))).toBe(true);
    expect(shouldRetryMediaError(2, new Error("network"))).toBe(false);
  });
});
