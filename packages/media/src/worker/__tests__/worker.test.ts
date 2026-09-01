import { createMediaConfig } from "../../config";
import { resetMediaStorageForTests } from "../../server/handlers";
import type { CreateMediaHandlersOptions } from "../../server/handlers";
import {
  createKvTokenAuthorizer,
  createMediaWorker,
  type MediaTokenAuth,
  type MediaTokenStore,
} from "../index";

const fetchMock = jest.fn<Promise<Response>, [unknown]>();
const originalFetch = global.fetch;

const config = createMediaConfig({
  buckets: {
    media: {
      provider: "s3",
      bucket: "test-bucket",
      region: "us-east-1",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    },
  },
  mediaTypes: {
    uploads: {
      bucket: "media",
      prefix: "uploads",
      allowedContentTypes: ["image/jpeg"],
    },
  },
});

const cors = {
  getHeaders: () => ({
    "Access-Control-Allow-Origin": "https://app.example",
    "Vary": "Origin",
  }),
  getPreflightHeaders: () => ({
    "Access-Control-Allow-Origin": "https://app.example",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }),
};

interface TestEnv {
  MEDIA_AUTH: MediaTokenStore;
}

function testEnv(store: Partial<Record<string, string>> = {}): TestEnv {
  return {
    MEDIA_AUTH: {
      get: async (key: string) => store[key] ?? null,
    },
  };
}

function listXml(keys: string[]): string {
  const contents = keys
    .map((key) => `  <Contents>
    <Key>${key}</Key>
    <LastModified>2026-05-04T00:00:00.000Z</LastModified>
    <ETag>&quot;etag&quot;</ETag>
    <Size>12</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>test-bucket</Name>
  <KeyCount>${keys.length}</KeyCount>
  <IsTruncated>false</IsTruncated>
${contents}
</ListBucketResult>`;
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/xml" } });
}

/** Worker under test with a fixed id factory so signed keys are deterministic. */
function worker(
  overrides: Partial<CreateMediaHandlersOptions<MediaTokenAuth>> = {},
  basePath?: string,
) {
  return createMediaWorker<TestEnv, MediaTokenAuth>({
    createOptions: () => ({
      config,
      cors,
      idFactory: () => "01TESTID",
      ...overrides,
    }),
    ...(basePath === undefined ? {} : { basePath }),
  });
}

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  resetMediaStorageForTests();
});

describe("createMediaWorker routing", () => {
  it("dispatches GET /list to the list handler", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(listXml(["uploads/photo.jpg"])));

    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/list?mediaType=uploads"),
      testEnv(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      items: [{ key: "uploads/photo.jpg", size: 12 }],
      totalCount: 1,
    });
  });

  it("dispatches POST /getUploadUrl to the upload signing handler", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/getUploadUrl", {
        method: "POST",
        body: JSON.stringify({ mediaType: "uploads", contentType: "image/jpeg" }),
      }),
      testEnv(),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.key).toBe("uploads/01TESTID.jpg");
    expect(new URL(payload.uploadUrl).host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
  });

  it("dispatches POST /getSignedUrls to the signed read handler", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/getSignedUrls", {
        method: "POST",
        body: JSON.stringify({ keys: ["uploads/photo.jpg"] }),
      }),
      testEnv(),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(new URL(payload.urls["uploads/photo.jpg"]).pathname).toBe("/uploads/photo.jpg");
  });

  it("dispatches DELETE /delete?key= to the single delete handler", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/delete?key=uploads/b.jpg", {
        method: "DELETE",
      }),
      testEnv(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, key: "uploads/b.jpg" });
  });

  it("dispatches POST /delete to the batch delete handler", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/delete", {
        method: "POST",
        body: JSON.stringify({ keys: ["uploads/a.jpg", "uploads/b.jpg"] }),
      }),
      testEnv(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      deleted: ["uploads/a.jpg", "uploads/b.jpg"],
      errors: [],
    });
  });

  it("returns 404 not-found with CORS headers for an unknown action", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/nope"),
      testEnv(),
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
    await expect(res.json()).resolves.toMatchObject({ code: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 for paths outside the base path", async () => {
    const outside = [
      "https://cdn.example/list",
      "https://cdn.example/api/other/list",
      "https://cdn.example/api/media",
      "https://cdn.example/api/media/",
      "https://cdn.example/api/media/list/extra",
    ];

    for (const url of outside) {
      const res = await worker().fetch(new Request(url), testEnv());
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toMatchObject({ code: "not-found" });
    }
  });

  it("honors a custom basePath", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(listXml([])));
    const custom = worker({}, "/media");

    const res = await custom.fetch(
      new Request("https://cdn.example/media/list?mediaType=uploads"),
      testEnv(),
    );
    expect(res.status).toBe(200);

    const defaultPath = await custom.fetch(
      new Request("https://cdn.example/api/media/list?mediaType=uploads"),
      testEnv(),
    );
    expect(defaultPath.status).toBe(404);
  });

  it("returns 405 method-not-allowed with CORS headers for a known action", async () => {
    const wrong = [
      { url: "https://cdn.example/api/media/list", method: "DELETE" },
      { url: "https://cdn.example/api/media/getUploadUrl", method: "GET" },
      { url: "https://cdn.example/api/media/getSignedUrls", method: "DELETE" },
      { url: "https://cdn.example/api/media/list", method: "PUT" },
      { url: "https://cdn.example/api/media/delete", method: "PATCH" },
    ];

    for (const { url, method } of wrong) {
      const res = await worker().fetch(new Request(url, { method }), testEnv());
      expect(res.status).toBe(405);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
      await expect(res.json()).resolves.toMatchObject({ code: "method-not-allowed" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers OPTIONS on a known action with preflight headers", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/getUploadUrl", { method: "OPTIONS" }),
      testEnv(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns 404 for OPTIONS on an unknown action", async () => {
    const res = await worker().fetch(
      new Request("https://cdn.example/api/media/nope", { method: "OPTIONS" }),
      testEnv(),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "not-found" });
  });
});

describe("createMediaWorker handler caching", () => {
  it("creates handlers once per env object", async () => {
    const createOptions = jest.fn(() => ({ config, cors }));
    const media = createMediaWorker<TestEnv>({ createOptions });
    const env = testEnv();

    await media.fetch(new Request("https://cdn.example/api/media/nope"), env);
    await media.fetch(new Request("https://cdn.example/api/media/nope"), env);

    expect(createOptions).toHaveBeenCalledTimes(1);
    expect(createOptions).toHaveBeenCalledWith(env);

    await media.fetch(new Request("https://cdn.example/api/media/nope"), testEnv());

    expect(createOptions).toHaveBeenCalledTimes(2);
  });
});

describe("createKvTokenAuthorizer", () => {
  const token = "a".repeat(64);

  function kvWorker(canRead?: jest.Mock) {
    return createMediaWorker<TestEnv, MediaTokenAuth>({
      createOptions: (env) => ({
        config,
        cors,
        authorize: createKvTokenAuthorizer(env.MEDIA_AUTH),
        ...(canRead ? { policy: { canRead } } : {}),
      }),
    });
  }

  function signedUrlRequest(headers: Record<string, string> = {}): Request {
    return new Request("https://cdn.example/api/media/getSignedUrls", {
      method: "POST",
      headers,
      body: JSON.stringify({ keys: ["uploads/photo.jpg"] }),
    });
  }

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await kvWorker().fetch(signedUrlRequest(), testEnv());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
  });

  it("returns 401 for a malformed Authorization header", async () => {
    const res = await kvWorker().fetch(
      signedUrlRequest({ Authorization: token }),
      testEnv({ [`token:${token}`]: JSON.stringify({ app: "downrangedays" }) }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
  });

  it("returns 401 when the token is unknown to KV", async () => {
    const res = await kvWorker().fetch(
      signedUrlRequest({ Authorization: `Bearer ${token}` }),
      testEnv(),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
  });

  it("authorizes a known token and passes the auth object to policy callbacks", async () => {
    const canRead = jest.fn(() => true);
    const res = await kvWorker(canRead).fetch(
      signedUrlRequest({ Authorization: `Bearer ${token}` }),
      testEnv({
        [`token:${token}`]: JSON.stringify({ app: "downrangedays", note: "phase 2" }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(new URL(payload.urls["uploads/photo.jpg"]).pathname).toBe("/uploads/photo.jpg");
    expect(canRead).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          token,
          app: "downrangedays",
          metadata: { app: "downrangedays", note: "phase 2" },
        },
        keys: ["uploads/photo.jpg"],
      }),
    );
  });

  it("returns 401 without throwing when the KV value is malformed JSON", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const res = await kvWorker().fetch(
      signedUrlRequest({ Authorization: `Bearer ${token}` }),
      testEnv({ [`token:${token}`]: "not-json" }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toContain(token);
  });

  it("returns 401 when the KV metadata has no app field", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const res = await kvWorker().fetch(
      signedUrlRequest({ Authorization: `Bearer ${token}` }),
      testEnv({ [`token:${token}`]: JSON.stringify({ note: "no app" }) }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: "unauthorized" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
