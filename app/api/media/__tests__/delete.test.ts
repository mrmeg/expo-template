/**
 * Tests for `DELETE /api/media/delete` + OPTIONS preflight + batch POST.
 *
 * The delete path is the one web browsers actually preflight (issue that
 * prompted the earlier CORS fix), so the regressions we care about:
 *   - OPTIONS preflight echoes the allowed origin and advertises DELETE
 *   - DELETE without a `key` query param returns 400 instead of reaching S3
 *   - DELETE with a key sends the right S3 DeleteObjectCommand and echoes
 *     the allowed origin on success
 *   - POST with an empty / missing keys array short-circuits to 400
 *   - POST success returns the deleted keys reported by S3
 *
 * The `@aws-sdk/client-s3` client is fully mocked so we never hit R2.
 */

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSend;
  }
  class MockDeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockDeleteObjectsCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: MockDeleteObjectCommand,
    DeleteObjectsCommand: MockDeleteObjectsCommand,
  };
});

const ORIGIN = "http://localhost:8081";

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

describe("media delete route", () => {
  const originalEnv: Partial<Record<(typeof STORAGE_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of STORAGE_KEYS) originalEnv[key] = process.env[key];
    mockSend.mockReset();
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_JURISDICTION_SPECIFIC_URL = "https://r2.example/test";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.ALLOWED_ORIGINS = ORIGIN;
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    const { _resetMediaStorageForTests } = require("@/server/api/media/storage");
    _resetMediaStorageForTests();
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
    const { OPTIONS } = require("../delete+api");
    const res: Response = await OPTIONS(
      makeRequest("http://localhost/api/media/delete", { method: "OPTIONS" })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("DELETE without a key returns 400 and never calls S3", async () => {
    const { DELETE } = require("../delete+api");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete", { method: "DELETE" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ message: expect.stringContaining("Missing key") });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("DELETE with a key sends DeleteObjectCommand and echoes the origin", async () => {
    mockSend.mockResolvedValueOnce({});
    const { DELETE } = require("../delete+api");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete?key=uploads/u_1/photo.jpg", {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, key: "uploads/u_1/photo.jpg" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input).toEqual({
      Bucket: "test-bucket",
      Key: "uploads/u_1/photo.jpg",
    });
  });

  it("DELETE surfaces S3 failures as 500 with CORS headers intact", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSend.mockRejectedValueOnce(new Error("access denied"));
    const { DELETE } = require("../delete+api");
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
    const { POST } = require("../delete+api");
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
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("POST rejects more than 1000 keys", async () => {
    const { POST } = require("../delete+api");
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
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("POST success returns the deleted keys and any S3-reported errors", async () => {
    mockSend.mockResolvedValueOnce({
      Deleted: [{ Key: "uploads/a" }, { Key: "uploads/b" }],
      Errors: [{ Key: "uploads/c", Message: "NoSuchKey" }],
    });
    const { POST } = require("../delete+api");
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
    expect(body.errors).toEqual([{ key: "uploads/c", message: "NoSuchKey" }]);

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input).toEqual({
      Bucket: "test-bucket",
      Delete: {
        Objects: [
          { Key: "uploads/a" },
          { Key: "uploads/b" },
          { Key: "uploads/c" },
        ],
        Quiet: false,
      },
    });
  });
});
