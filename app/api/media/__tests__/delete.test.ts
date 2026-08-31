/**
 * Tests for `DELETE /api/media/delete` + OPTIONS preflight + batch POST.
 *
 * The delete path is the one web browsers actually preflight (issue that
 * prompted the earlier CORS fix), so the regressions we care about:
 *   - OPTIONS preflight echoes the allowed origin and advertises DELETE
 *   - DELETE without a `key` query param returns 400 instead of reaching R2
 *   - DELETE with a key sends one signed DELETE to the object URL and echoes
 *     the allowed origin on success
 *   - POST with an empty / missing keys array short-circuits to 400
 *   - POST reports per-key outcomes: keys whose DELETE succeeds land in
 *     `deleted`, keys whose DELETE answers non-2xx land in `errors`
 *
 * `@mrmeg/expo-media/server` signs S3/R2 requests with aws4fetch and issues
 * them through `fetch`, so `global.fetch` is mocked here: no request leaves
 * the process, and each assertion can inspect the signed request directly.
 */

const fetchMock = jest.fn<Promise<Response>, [unknown]>();
const originalFetch = global.fetch;

const ORIGIN = "http://localhost:8081";

/** Path-style R2 bucket URL for the env configured in `beforeEach`. */
const BUCKET_URL = "https://r2.example/test/test-bucket";

function requestOf(input: unknown): Request {
  return input as Request;
}

function fetchedRequest(index: number): Request {
  return requestOf(fetchMock.mock.calls[index]![0]);
}

function fetchedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => requestOf(call[0]).url);
}

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

function makeRequest(
  url: string,
  init: RequestInit & { origin?: string | null } = {}
): Request {
  const headers = new Headers(init.headers);
  const origin = init.origin === undefined ? ORIGIN : init.origin;
  if (origin) headers.set("Origin", origin);
  return new Request(url, { ...init, headers });
}

const STORAGE_KEYS = [
  "R2_BUCKET",
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "ALLOWED_ORIGINS",
  "EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA",
] as const;

// The media routes are consolidated behind `[action]+api.ts`; bind the
// action param here (requiring lazily so `jest.resetModules()` still
// applies) to keep call sites in the old per-file handler shape.
function mediaRoute(action: "list" | "delete" | "getUploadUrl" | "getSignedUrls") {
  const route = require("../[action]+api");
  const bind =
    (method: "GET" | "POST" | "DELETE" | "OPTIONS") =>
      (request: Request): Promise<Response> =>
        route[method](request, { action });
  return {
    GET: bind("GET"),
    POST: bind("POST"),
    DELETE: bind("DELETE"),
    OPTIONS: bind("OPTIONS"),
  };
}

describe("media delete route", () => {
  const originalEnv: Partial<Record<(typeof STORAGE_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    jest.resetModules();
    for (const key of STORAGE_KEYS) originalEnv[key] = process.env[key];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_JURISDICTION_SPECIFIC_URL = "https://r2.example/test";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.ALLOWED_ORIGINS = ORIGIN;
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    const { resetMediaStorageForTests } = require("@/server/media/handlers");
    resetMediaStorageForTests();
    // NODE_ENV stays at its Jest default ("test") so sanitizeErrorDetails
    // still returns a `details` field — that keeps the 500 test expressive.
  });

  afterEach(() => {
    for (const key of STORAGE_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key]!;
    }
  });

  it("OPTIONS preflight echoes the allowed origin and advertises DELETE", async () => {
    const { OPTIONS } = mediaRoute("delete");
    const res: Response = await OPTIONS(
      makeRequest("http://localhost/api/media/delete", { method: "OPTIONS" })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("DELETE without a key returns 400 and never calls R2", async () => {
    const { DELETE } = mediaRoute("delete");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete", { method: "DELETE" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ message: expect.stringContaining("Missing key") });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DELETE with a key sends a signed DELETE for the object and echoes the origin", async () => {
    const { DELETE } = mediaRoute("delete");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete?key=uploads/u_1/photo.jpg", {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, key: "uploads/u_1/photo.jpg" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signed = fetchedRequest(0);
    expect(signed.method).toBe("DELETE");
    expect(signed.url).toBe(`${BUCKET_URL}/uploads/u_1/photo.jpg`);
    expect(signed.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=test-access-key/"
    );
  });

  it("DELETE surfaces S3 failures as 500 with CORS headers intact", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("access denied"));
    const { DELETE } = mediaRoute("delete");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete?key=uploads/u_1/photo.jpg", {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const body = await res.json();
    expect(body.message).toBe("Failed to delete file.");
    errorSpy.mockRestore();
  });

  it("POST without a keys array returns 400", async () => {
    const { POST } = mediaRoute("delete");
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("invalid keys array");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST rejects more than 1000 keys", async () => {
    const { POST } = mediaRoute("delete");
    const keys = Array.from({ length: 1001 }, (_, i) => `uploads/k${i}`);
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Maximum 1000");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST reports per-key results, splitting non-2xx deletes into errors", async () => {
    // Batch delete is one signed DELETE per key, so a single missing object
    // fails only its own request instead of the whole batch.
    fetchMock.mockImplementation(async (input) => {
      if (requestOf(input).url.endsWith("/uploads/c")) {
        return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
      }
      return new Response(null, { status: 204 });
    });
    const { POST } = mediaRoute("delete");
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: ["uploads/a", "uploads/b", "uploads/c"] }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.deleted).toEqual(["uploads/a", "uploads/b"]);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].key).toBe("uploads/c");
    expect(body.errors[0].message).toContain("404");
    expect(body.errors[0].message).toContain("NoSuchKey");

    // The batch runs concurrently, so compare the request set, not the order.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchedRequest(0).method).toBe("DELETE");
    expect(fetchedUrls().sort()).toEqual([
      `${BUCKET_URL}/uploads/a`,
      `${BUCKET_URL}/uploads/b`,
      `${BUCKET_URL}/uploads/c`,
    ]);
  });
});
