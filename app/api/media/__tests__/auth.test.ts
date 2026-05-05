const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSend;
  }
  class MockCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: MockCommand,
    DeleteObjectsCommand: MockCommand,
    GetObjectCommand: MockCommand,
    ListObjectsV2Command: MockCommand,
    PutObjectCommand: MockCommand,
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/url"),
}));

import { setTokenVerifier } from "@/server/api/shared/auth";

const ORIGIN = "http://localhost:8081";
const ENV_KEYS = [
  "R2_BUCKET",
  "R2_JURISDICTION_SPECIFIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "ALLOWED_ORIGINS",
  "EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA",
  "NODE_ENV",
] as const;

function makeRequest(
  url: string,
  init: RequestInit & { origin?: string | null } = {},
): Request {
  const headers = new Headers(init.headers);
  const origin = init.origin === undefined ? ORIGIN : init.origin;
  if (origin) headers.set("Origin", origin);
  return new Request(url, { ...init, headers });
}

function configureStorage(): void {
  process.env.R2_BUCKET = "test-bucket";
  process.env.R2_JURISDICTION_SPECIFIC_URL = "https://r2.example/test";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.ALLOWED_ORIGINS = ORIGIN;
}

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    Reflect.set(process.env, key, value);
  }
}

describe("media route auth policy", () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    configureStorage();
    delete process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA;
    setEnv("NODE_ENV", "test");
    mockSend.mockReset();
    setTokenVerifier(null);
    const { _resetMediaStorageForTests } = require("@/server/api/media/storage");
    _resetMediaStorageForTests();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, originalEnv[key]);
    }
    setTokenVerifier(null);
  });

  it("rejects upload signing without auth when storage is configured", async () => {
    const { POST } = require("../getUploadUrl+api");
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/getUploadUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: "uploads",
          contentType: "image/jpeg",
          size: 10,
        }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects listing without auth when storage is configured", async () => {
    const { GET } = require("../list+api");
    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects signed read URLs without auth when storage is configured", async () => {
    const { POST } = require("../getSignedUrls+api");
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/getSignedUrls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: ["uploads/a.jpg"] }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects deletion without auth when storage is configured", async () => {
    const { DELETE } = require("../delete+api");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete?key=uploads/a.jpg", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("allows explicit public media access outside production", async () => {
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    mockSend.mockResolvedValueOnce({ Contents: [] });
    const { GET } = require("../list+api");

    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("ignores the public media access flag in production", async () => {
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    setEnv("NODE_ENV", "production");
    const { GET } = require("../list+api");

    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns media-disabled before auth when storage env is missing", async () => {
    delete process.env.R2_BUCKET;
    const { GET } = require("../list+api");

    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "media-disabled",
      missing: ["R2_BUCKET"],
    });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
