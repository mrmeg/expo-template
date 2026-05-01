/**
 * Tests for the typed `503 media-disabled` short-circuit on every
 * `/api/media/*` route.
 *
 * Each handler reads `getMediaStorageEnv()` first; when any of the four
 * R2/S3 env vars is missing or whitespace-only, the handler returns a
 * structured error body the client uses to render the Media tab's
 * setup-state UI without ever constructing an S3 client.
 *
 * The contract we pin down here:
 *   - status is 503
 *   - body.code is `media-disabled`
 *   - body.missing lists only the env var *names* (never values)
 *   - CORS headers are still set so a browser can read the response
 *   - OPTIONS preflight succeeds even when storage is disabled
 *   - the AWS SDK is never called (mock asserts zero invocations)
 */

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSend;
  }
  class Cmd {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: Cmd,
    DeleteObjectsCommand: Cmd,
    ListObjectsV2Command: Cmd,
    PutObjectCommand: Cmd,
    GetObjectCommand: Cmd,
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/url"),
}));

const ORIGIN = "http://localhost:8081";
const ALL_R2_KEYS = [
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

function makeRequest(
  url: string,
  init: RequestInit & { origin?: string | null } = {}
): Request {
  const headers = new Headers(init.headers);
  const origin = init.origin === undefined ? ORIGIN : init.origin;
  if (origin) headers.set("Origin", origin);
  return new Request(url, { ...init, headers });
}

describe("media routes — disabled state", () => {
  const originalEnv: Partial<Record<string, string | undefined>> = {};

  beforeEach(() => {
    for (const key of ALL_R2_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    originalEnv.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = ORIGIN;
    mockSend.mockReset();
    const { _resetMediaStorageForTests } = require("@/server/api/media/storage");
    _resetMediaStorageForTests();
  });

  afterEach(() => {
    for (const key of [...ALL_R2_KEYS, "ALLOWED_ORIGINS"]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key]!;
    }
  });

  describe("GET /api/media/list", () => {
    it("returns 503 media-disabled with all four missing env names", async () => {
      const { GET } = require("../list+api");
      const res: Response = await GET(
        makeRequest("http://localhost/api/media/list", { method: "GET" })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("media-disabled");
      expect(body.missing).toEqual(expect.arrayContaining([...ALL_R2_KEYS]));
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("OPTIONS preflight succeeds even when storage is unconfigured", async () => {
      const { OPTIONS } = require("../list+api");
      const res: Response = await OPTIONS(
        makeRequest("http://localhost/api/media/list", { method: "OPTIONS" })
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    });

    it("disables when only one env var is missing", async () => {
      process.env.R2_JURISDICTION_SPECIFIC_URL = "https://r2.example";
      process.env.R2_ACCESS_KEY_ID = "k";
      process.env.R2_SECRET_ACCESS_KEY = "s";
      // R2_BUCKET still missing
      const { GET } = require("../list+api");
      const res: Response = await GET(
        makeRequest("http://localhost/api/media/list", { method: "GET" })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.missing).toEqual(["R2_BUCKET"]);
    });

    it("treats whitespace-only env values as missing", async () => {
      process.env.R2_JURISDICTION_SPECIFIC_URL = "   ";
      process.env.R2_ACCESS_KEY_ID = "k";
      process.env.R2_SECRET_ACCESS_KEY = "s";
      process.env.R2_BUCKET = "b";
      const { GET } = require("../list+api");
      const res: Response = await GET(
        makeRequest("http://localhost/api/media/list", { method: "GET" })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.missing).toEqual(["R2_JURISDICTION_SPECIFIC_URL"]);
    });
  });

  describe("POST /api/media/getUploadUrl", () => {
    it("returns 503 media-disabled and never calls S3 / presigner", async () => {
      const { POST } = require("../getUploadUrl+api");
      const res: Response = await POST(
        makeRequest("http://localhost/api/media/getUploadUrl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extension: "jpg", mediaType: "uploads" }),
        })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("media-disabled");
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/media/getSignedUrls", () => {
    it("returns 503 media-disabled before parsing the body", async () => {
      const { POST } = require("../getSignedUrls+api");
      const res: Response = await POST(
        makeRequest("http://localhost/api/media/getSignedUrls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: ["a"] }),
        })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("media-disabled");
    });
  });

  describe("DELETE / POST /api/media/delete", () => {
    it("DELETE returns 503 media-disabled", async () => {
      const { DELETE } = require("../delete+api");
      const res: Response = await DELETE(
        makeRequest("http://localhost/api/media/delete?key=foo", { method: "DELETE" })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("media-disabled");
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("POST batch returns 503 media-disabled", async () => {
      const { POST } = require("../delete+api");
      const res: Response = await POST(
        makeRequest("http://localhost/api/media/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: ["a"] }),
        })
      );
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe("media-disabled");
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  it("never echoes credential values in the disabled response body", async () => {
    process.env.R2_ACCESS_KEY_ID = "super-secret-do-not-leak";
    process.env.R2_SECRET_ACCESS_KEY = "another-secret";
    const { GET } = require("../list+api");
    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list", { method: "GET" })
    );
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("super-secret-do-not-leak");
    expect(text).not.toContain("another-secret");
  });
});
