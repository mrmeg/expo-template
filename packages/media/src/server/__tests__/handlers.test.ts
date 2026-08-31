import { createMediaConfig } from "../../config";
import {
  createMediaHandlers,
  resetMediaStorageForTests,
} from "../handlers";

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
    avatars: {
      bucket: "media",
      prefix: "users/avatars",
      allowedContentTypes: ["image/jpeg"],
    },
    videos: {
      bucket: "media",
      prefix: "videos",
      allowedContentTypes: ["video/mp4"],
    },
    uploads: {
      bucket: "media",
      prefix: "uploads",
      allowedContentTypes: ["image/jpeg"],
    },
  },
});

const multiBucketConfig = createMediaConfig({
  buckets: {
    avatarMedia: {
      provider: "s3",
      bucket: "avatar-bucket",
      region: "us-east-1",
      credentials: {
        accessKeyId: "avatar-access-key",
        secretAccessKey: "avatar-secret-key",
      },
    },
    uploadMedia: {
      provider: "s3",
      bucket: "upload-bucket",
      region: "us-east-1",
      credentials: {
        accessKeyId: "upload-access-key",
        secretAccessKey: "upload-secret-key",
      },
    },
  },
  mediaTypes: {
    avatars: {
      bucket: "avatarMedia",
      prefix: "users/avatars",
      allowedContentTypes: ["image/jpeg"],
    },
    uploads: {
      bucket: "uploadMedia",
      prefix: "uploads",
      allowedContentTypes: ["image/jpeg"],
    },
  },
});

const r2Config = createMediaConfig({
  buckets: {
    media: {
      provider: "r2",
      bucket: "expo-template",
      region: "auto",
      endpoint: "https://account123.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "r2-access-key",
        secretAccessKey: "r2-secret-key",
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

interface ListEntry {
  key: string;
  size: number;
  lastModified: string;
}

function listXml(entries: ListEntry[], nextContinuationToken?: string): string {
  const contents = entries
    .map((entry) => `  <Contents>
    <Key>${entry.key}</Key>
    <LastModified>${entry.lastModified}</LastModified>
    <ETag>&quot;etag&quot;</ETag>
    <Size>${entry.size}</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>test-bucket</Name>
  <KeyCount>${entries.length}</KeyCount>
  <IsTruncated>${nextContinuationToken ? "true" : "false"}</IsTruncated>
${nextContinuationToken ? `  <NextContinuationToken>${nextContinuationToken}</NextContinuationToken>\n` : ""}${contents}
</ListBucketResult>`;
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/xml" },
  });
}

function requestOf(input: unknown): Request {
  return input as Request;
}

function fetchedUrl(callIndex: number): URL {
  return new URL(requestOf(fetchMock.mock.calls[callIndex]![0]).url);
}

/**
 * `host + pathname` for every fetch, sorted — batch deletes run concurrently,
 * so only the set of signed targets is deterministic.
 */
function fetchedTargets(): string[] {
  return fetchMock.mock.calls
    .map((call) => {
      const url = new URL(requestOf(call[0]).url);
      return `${url.host}${url.pathname}`;
    })
    .sort();
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

describe("createMediaHandlers upload signing", () => {
  it("presigns a PUT URL that signs the approved content type", async () => {
    const onUploadSigned = jest.fn();
    const handlers = createMediaHandlers({
      config,
      events: { onUploadSigned },
      idFactory: () => "01TESTID",
    });

    const res = await handlers.getUploadUrl(
      new Request("http://localhost/upload", {
        method: "POST",
        body: JSON.stringify({ mediaType: "uploads", contentType: "image/jpeg" }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.key).toBe("uploads/01TESTID.jpg");
    expect(payload.headers).toEqual({ "Content-Type": "image/jpeg" });

    const uploadUrl = new URL(payload.uploadUrl);
    expect(uploadUrl.protocol).toBe("https:");
    expect(uploadUrl.host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
    expect(uploadUrl.pathname).toBe("/uploads/01TESTID.jpg");
    expect(uploadUrl.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(uploadUrl.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(uploadUrl.searchParams.get("X-Amz-Credential")).toContain("test-access-key/");
    expect(uploadUrl.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(onUploadSigned).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors the media type upload expiry", async () => {
    const handlers = createMediaHandlers({
      config: createMediaConfig({
        buckets: config.buckets,
        mediaTypes: {
          uploads: { ...config.mediaTypes.uploads, uploadExpiresInSeconds: 60 },
        },
      }),
      idFactory: () => "01TESTID",
    });

    const res = await handlers.getUploadUrl(
      new Request("http://localhost/upload", {
        method: "POST",
        body: JSON.stringify({ mediaType: "uploads", contentType: "image/jpeg" }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(new URL(payload.uploadUrl).searchParams.get("X-Amz-Expires")).toBe("60");
  });
});

describe("createMediaHandlers signed read URLs", () => {
  it("presigns GET URLs with the default read expiry", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.getSignedUrls(
      new Request("http://localhost/signed-urls", {
        method: "POST",
        body: JSON.stringify({ keys: ["uploads/photo one.jpg"] }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    const signedUrl = new URL(payload.urls["uploads/photo one.jpg"]);
    expect(signedUrl.host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
    expect(signedUrl.pathname).toBe("/uploads/photo%20one.jpg");
    expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("86400");
    expect(signedUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(signedUrl.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects keys outside configured media prefixes", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.getSignedUrls(
      new Request("http://localhost/signed-urls", {
        method: "POST",
        body: JSON.stringify({ keys: ["private/photo.jpg"] }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "bad-key" });
  });
});

describe("createMediaHandlers list", () => {
  it("lists the configured prefix for a mediaType request", async () => {
    fetchMock.mockResolvedValueOnce(
      xmlResponse(
        listXml(
          [{ key: "uploads/photo.jpg", size: 123, lastModified: "2026-05-04T00:00:00.000Z" }],
          "next-token",
        ),
      ),
    );
    const canList = jest.fn(() => true);
    const handlers = createMediaHandlers({
      config,
      policy: { canList },
    });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&limit=25"),
    );

    expect(res.status).toBe(200);
    expect(canList).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "uploads", prefix: "uploads" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const listRequest = requestOf(fetchMock.mock.calls[0]![0]);
    expect(listRequest.method).toBe("GET");
    expect(listRequest.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=test-access-key/",
    );
    const listUrl = new URL(listRequest.url);
    expect(listUrl.host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
    expect(listUrl.searchParams.get("list-type")).toBe("2");
    expect(listUrl.searchParams.get("prefix")).toBe("uploads");
    expect(listUrl.searchParams.get("max-keys")).toBe("25");
    await expect(res.json()).resolves.toEqual({
      items: [{
        key: "uploads/photo.jpg",
        size: 123,
        lastModified: "2026-05-04T00:00:00.000Z",
      }],
      totalCount: 1,
      nextCursor: "next-token",
    });
  });

  it("forwards the cursor as the continuation token", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(listXml([])));
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&cursor=page-2"),
    );

    expect(res.status).toBe(200);
    expect(fetchedUrl(0).searchParams.get("continuation-token")).toBe("page-2");
    await expect(res.json()).resolves.toEqual({ items: [], totalCount: 0 });
  });

  it("unescapes XML entities in listed keys", async () => {
    fetchMock.mockResolvedValueOnce(
      xmlResponse(
        listXml([{
          key: "uploads/a&amp;b &lt;c&gt; &quot;d&quot; &apos;e&apos;.jpg",
          size: 7,
          lastModified: "2026-05-04T00:00:00.000Z",
        }]),
      ),
    );
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(new Request("http://localhost/list?mediaType=uploads"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      items: [{ key: "uploads/a&b <c> \"d\" 'e'.jpg", size: 7 }],
      totalCount: 1,
    });
  });

  it("rejects unscoped list requests before reaching S3", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(new Request("http://localhost/list"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-request",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown prefix-only list requests before reaching S3", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?prefix=private"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects prefixes outside the requested media type", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&prefix=videos"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "bad-key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows narrower prefixes inside the requested media type", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(listXml([])));
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(
      new Request("http://localhost/list?mediaType=uploads&prefix=uploads/gallery"),
    );

    expect(res.status).toBe(200);
    const listUrl = fetchedUrl(0);
    expect(listUrl.host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
    expect(listUrl.searchParams.get("prefix")).toBe("uploads/gallery");
  });

  it("returns storage-failure when the bucket rejects the list request", async () => {
    fetchMock.mockResolvedValueOnce(
      xmlResponse("<Error><Code>AccessDenied</Code></Error>", 403),
    );
    const handlers = createMediaHandlers({ config });

    const res = await handlers.list(new Request("http://localhost/list?mediaType=uploads"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ code: "storage-failure" });
  });
});

describe("createMediaHandlers batch delete", () => {
  it("groups batch deletes by each key's configured bucket", async () => {
    const handlers = createMediaHandlers({ config: multiBucketConfig });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({
          keys: ["users/avatars/a.jpg", "uploads/b.jpg"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      deleted: ["users/avatars/a.jpg", "uploads/b.jpg"],
      errors: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestOf(fetchMock.mock.calls[0]![0]).method).toBe("DELETE");
    expect(requestOf(fetchMock.mock.calls[1]![0]).method).toBe("DELETE");
    expect(fetchedTargets()).toEqual([
      "avatar-bucket.s3.us-east-1.amazonaws.com/users/avatars/a.jpg",
      "upload-bucket.s3.us-east-1.amazonaws.com/uploads/b.jpg",
    ]);
  });

  it("sends one delete per key when resolved keys share one bucket", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({
          keys: ["users/avatars/a.jpg", "uploads/b.jpg"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchedTargets()).toEqual([
      "test-bucket.s3.us-east-1.amazonaws.com/uploads/b.jpg",
      "test-bucket.s3.us-east-1.amazonaws.com/users/avatars/a.jpg",
    ]);
  });

  it("calls canDelete with all keys and media types before storage deletion", async () => {
    const canDelete = jest.fn(() => {
      expect(fetchMock).not.toHaveBeenCalled();
      return true;
    });
    const handlers = createMediaHandlers({
      config: multiBucketConfig,
      policy: { canDelete },
    });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({
          keys: ["users/avatars/a.jpg", "uploads/b.jpg"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(canDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        keys: ["users/avatars/a.jpg", "uploads/b.jpg"],
        mediaTypes: ["avatars", "uploads"],
      }),
    );
  });

  it("returns 403 when policy denies the delete", async () => {
    const handlers = createMediaHandlers({
      config: multiBucketConfig,
      policy: { canDelete: () => ({ allowed: false, code: "delete-forbidden" }) },
    });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({ keys: ["uploads/b.jpg"] }),
      }),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "delete-forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns successful deletes plus per-key errors when one bucket fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (new URL(requestOf(input).url).host.startsWith("upload-bucket")) {
        throw new Error("upload bucket denied");
      }
      return new Response(null, { status: 204 });
    });
    const onDeleted = jest.fn();
    const handlers = createMediaHandlers({
      config: multiBucketConfig,
      events: { onDeleted },
    });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({
          keys: ["users/avatars/a.jpg", "uploads/b.jpg"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: false,
      deleted: ["users/avatars/a.jpg"],
      errors: [{ key: "uploads/b.jpg", message: "upload bucket denied" }],
    });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ keys: ["users/avatars/a.jpg"] }),
    );
  });

  it("reports the response status when a delete responds non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(
      xmlResponse("<Error><Code>AccessDenied</Code></Error>", 403),
    );
    const handlers = createMediaHandlers({ config });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({ keys: ["uploads/b.jpg"] }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toMatchObject({ success: false, deleted: [] });
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0].key).toBe("uploads/b.jpg");
    expect(payload.errors[0].message).toContain("403");
    expect(payload.errors[0].message).toContain("AccessDenied");
  });

  it("rejects requests over the 1000 key cap", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.deleteMany(
      new Request("http://localhost/delete", {
        method: "POST",
        body: JSON.stringify({
          keys: Array.from({ length: 1001 }, (_, index) => `uploads/${index}.jpg`),
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "bad-request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createMediaHandlers R2 buckets", () => {
  it("lists with a path-style bucket URL", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse(listXml([])));
    const handlers = createMediaHandlers({ config: r2Config });

    const res = await handlers.list(new Request("http://localhost/list?mediaType=uploads"));

    expect(res.status).toBe(200);
    const listUrl = fetchedUrl(0);
    expect(listUrl.host).toBe("account123.r2.cloudflarestorage.com");
    expect(listUrl.pathname).toBe("/expo-template");
    expect(listUrl.searchParams.get("list-type")).toBe("2");
  });

  it("presigns uploads with a path-style object URL", async () => {
    const handlers = createMediaHandlers({ config: r2Config, idFactory: () => "01TESTID" });

    const res = await handlers.getUploadUrl(
      new Request("http://localhost/upload", {
        method: "POST",
        body: JSON.stringify({ mediaType: "uploads", contentType: "image/jpeg" }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    const uploadUrl = new URL(payload.uploadUrl);
    expect(uploadUrl.host).toBe("account123.r2.cloudflarestorage.com");
    expect(uploadUrl.pathname).toBe("/expo-template/uploads/01TESTID.jpg");
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(uploadUrl.searchParams.get("X-Amz-Credential")).toContain("r2-access-key/");
  });
});

describe("createMediaHandlers single delete", () => {
  it("deletes one object with a signed DELETE request", async () => {
    const handlers = createMediaHandlers({ config });

    const res = await handlers.deleteOne(
      new Request("http://localhost/delete?key=uploads/b.jpg", { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, key: "uploads/b.jpg" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const deleteRequest = requestOf(fetchMock.mock.calls[0]![0]);
    expect(deleteRequest.method).toBe("DELETE");
    expect(deleteRequest.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=test-access-key/",
    );
    expect(fetchedUrl(0).pathname).toBe("/uploads/b.jpg");
  });
});
