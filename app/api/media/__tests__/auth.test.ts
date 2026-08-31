/**
 * Tests for the auth policy on every `/api/media/*` route.
 *
 * `@mrmeg/expo-media/server` signs S3/R2 requests with aws4fetch and issues
 * them through `fetch`, so `global.fetch` is mocked here: every "never reached
 * storage" assertion is a zero-invocation check on that mock, and no request
 * leaves the process.
 */

import { setTokenVerifier } from "@/server/api/shared/auth";

const fetchMock = jest.fn<Promise<Response>, [unknown]>();
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

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

/** Minimal empty ListObjectsV2 body for the one authorized list case. */
function emptyListXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>test-bucket</Name>
  <KeyCount>0</KeyCount>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;
}

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

describe("media route auth policy", () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    jest.resetModules();
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    configureStorage();
    delete process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA;
    setEnv("NODE_ENV", "test");
    fetchMock.mockReset();
    setTokenVerifier(null);
    const { resetMediaStorageForTests } = require("@/server/media/handlers");
    resetMediaStorageForTests();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, originalEnv[key]);
    }
    setTokenVerifier(null);
  });

  it("rejects upload signing without auth when storage is configured", async () => {
    const { POST } = mediaRoute("getUploadUrl");
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects listing without auth when storage is configured", async () => {
    const { GET } = mediaRoute("list");
    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects signed read URLs without auth when storage is configured", async () => {
    const { POST } = mediaRoute("getSignedUrls");
    const res: Response = await POST(
      makeRequest("http://localhost/api/media/getSignedUrls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: ["uploads/a.jpg"] }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects deletion without auth when storage is configured", async () => {
    const { DELETE } = mediaRoute("delete");
    const res: Response = await DELETE(
      makeRequest("http://localhost/api/media/delete?key=uploads/a.jpg", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows explicit public media access outside production", async () => {
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    fetchMock.mockResolvedValueOnce(
      new Response(emptyListXml(), {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }),
    );
    const { GET } = mediaRoute("list");

    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const listRequest = fetchMock.mock.calls[0]![0] as Request;
    expect(listRequest.method).toBe("GET");
    expect(new URL(listRequest.url).searchParams.get("list-type")).toBe("2");
  });

  it("ignores the public media access flag in production", async () => {
    process.env.EXPO_TEMPLATE_ALLOW_PUBLIC_MEDIA = "true";
    setEnv("NODE_ENV", "production");
    const { GET } = mediaRoute("list");

    const res: Response = await GET(
      makeRequest("http://localhost/api/media/list?mediaType=uploads", {
        method: "GET",
      }),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns media-disabled before auth when storage env is missing", async () => {
    delete process.env.R2_BUCKET;
    const { GET } = mediaRoute("list");

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
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
