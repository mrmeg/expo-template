/**
 * The signing request is where the client and the server agree on what is about
 * to be uploaded. Two fields in it used to be web-only by accident: `size`
 * (blobs know their own, native file URIs do not, so the server's `maxBytes`
 * check never ran for phone uploads) and `metadata` (EXIF the app parsed and
 * then dropped). Both are pinned here.
 */

import { Platform } from "react-native";

import { createMediaClient, resolveUploadSize } from "..";

const SIGNED = {
  key: "uploads/abc.jpg",
  uploadUrl: "https://r2.example.com/uploads/abc.jpg?signature=x",
  expiresAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Body of the Nth call to the injected fetcher, parsed. */
function bodyOf(fetcher: jest.Mock, call = 0): Record<string, unknown> {
  const init = fetcher.mock.calls[call][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

function blobOf(size: number, type = "image/jpeg"): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

describe("resolveUploadSize", () => {
  it("reads a blob's own size", async () => {
    await expect(resolveUploadSize(blobOf(2_048))).resolves.toBe(2_048);
  });

  it("stats a native file URI", async () => {
    // Native is exactly the case the old implementation skipped.
    expect(Platform.OS).not.toBe("web");
    const stat = jest.fn(async () => 1_234_567);

    await expect(resolveUploadSize("file:///DCIM/IMG_0001.jpg", stat)).resolves.toBe(
      1_234_567,
    );
    expect(stat).toHaveBeenCalledWith("file:///DCIM/IMG_0001.jpg");
  });

  it("returns undefined when the file cannot be statted", async () => {
    const stat = jest.fn(async () => {
      throw new Error("ENOENT");
    });

    await expect(resolveUploadSize("file:///gone.jpg", stat)).resolves.toBeUndefined();
  });

  it("returns undefined when the stat reports nothing usable", async () => {
    await expect(
      resolveUploadSize("file:///empty.jpg", async () => undefined),
    ).resolves.toBeUndefined();
  });
});

describe("getUploadUrl", () => {
  it("sends the size and metadata it was given", async () => {
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    const client = createMediaClient({ fetcher });

    await client.getUploadUrl({
      contentType: "image/jpeg",
      mediaType: "uploads",
      size: 987_654,
      customFilename: "beach.jpg",
      metadata: { takenAt: "2026-01-01T00:00:00.000Z", lat: 1.5, lng: -2.5 },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/getUploadUrl",
      expect.objectContaining({ method: "POST" }),
    );
    expect(bodyOf(fetcher)).toEqual({
      contentType: "image/jpeg",
      mediaType: "uploads",
      size: 987_654,
      customFilename: "beach.jpg",
      metadata: { takenAt: "2026-01-01T00:00:00.000Z", lat: 1.5, lng: -2.5 },
    });
  });

  it("omits optional fields rather than sending nulls", async () => {
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    const client = createMediaClient({ fetcher });

    await client.getUploadUrl({ contentType: "image/png", mediaType: "avatars" });

    expect(bodyOf(fetcher)).toEqual({
      contentType: "image/png",
      mediaType: "avatars",
    });
  });

  it("surfaces a server refusal as a media error", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse({ type: "invalid-content-type", title: "Unsupported" }, 400),
    );
    const client = createMediaClient({ fetcher });

    await expect(
      client.getUploadUrl({ contentType: "image/heic", mediaType: "uploads" }),
    ).rejects.toMatchObject({ name: "MediaError" });
  });
});

describe("upload", () => {
  it("sends a blob's byte size with the signing request", async () => {
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    const put = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({}, 200));
    const client = createMediaClient({ fetcher });

    await client.upload({
      file: blobOf(4_096),
      contentType: "image/jpeg",
      mediaType: "uploads",
    });

    expect(bodyOf(fetcher).size).toBe(4_096);
    expect(put).toHaveBeenCalledWith(
      SIGNED.uploadUrl,
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
  });

  it("prefers an explicitly provided size over measuring the file", async () => {
    // The processing pipeline already knows the exact byte count.
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    jest.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 200));
    const client = createMediaClient({ fetcher });

    await client.upload({
      file: blobOf(4_096),
      contentType: "image/jpeg",
      mediaType: "uploads",
      size: 12_345,
    });

    expect(bodyOf(fetcher).size).toBe(12_345);
  });

  it("forwards metadata to the signing request", async () => {
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    jest.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 200));
    const client = createMediaClient({ fetcher });

    await client.upload({
      file: blobOf(16),
      contentType: "image/jpeg",
      mediaType: "uploads",
      metadata: { takenAt: "2026-01-01T00:00:00.000Z" },
    });

    expect(bodyOf(fetcher).metadata).toEqual({ takenAt: "2026-01-01T00:00:00.000Z" });
  });

  it("fails when the storage PUT is refused", async () => {
    const fetcher = jest.fn(async () => jsonResponse(SIGNED));
    jest.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 500));
    const client = createMediaClient({ fetcher });

    await expect(
      client.upload({
        file: blobOf(16),
        contentType: "image/jpeg",
        mediaType: "uploads",
      }),
    ).rejects.toThrow(/Upload failed/);
  });
});
