import { Platform } from "react-native";
import type { MediaUploadOptions, MediaUploadResult } from "../../client";
import { backfillVideoThumbnail, type BackfillVideoThumbnailOptions } from "../backfill";

const input = { videoKey: "videos/01ABC.mov", videoUrl: "https://bucket.example/videos/01ABC.mov?sig=1" };

const uploaded = (key: string): MediaUploadResult => ({
  key,
  uploadUrl: `https://bucket.example/${key}`,
  expiresAt: "2030-01-01T00:00:00Z",
});

function setup(overrides: Partial<BackfillVideoThumbnailOptions<string>> = {}) {
  const upload = jest.fn(async (_options: MediaUploadOptions<string>) => uploaded("thumbnails/01ABC.jpg"));
  const extract = jest.fn<
    ReturnType<NonNullable<BackfillVideoThumbnailOptions["extract"]>>,
    Parameters<NonNullable<BackfillVideoThumbnailOptions["extract"]>>
  >(async () => ({ uri: "file:///cache/frame.jpg", width: 640, height: 360 }));
  const options: BackfillVideoThumbnailOptions<string> = {
    upload,
    extract,
    thumbnailMediaType: "thumbnails",
    ...overrides,
  };
  return { upload, extract, options };
}

describe("backfillVideoThumbnail", () => {
  it("extracts from the signed url and uploads a jpeg named after the video id", async () => {
    const t = setup();

    await expect(backfillVideoThumbnail(input, t.options)).resolves.toEqual({
      status: "uploaded",
      videoKey: "videos/01ABC.mov",
      key: "thumbnails/01ABC.jpg",
    });

    expect(t.extract).toHaveBeenCalledWith(input.videoUrl, 1000);
    expect(t.upload).toHaveBeenCalledTimes(1);
    expect(t.upload).toHaveBeenCalledWith({
      file: "file:///cache/frame.jpg",
      contentType: "image/jpeg",
      mediaType: "thumbnails",
      customFilename: "01ABC",
    });
  });

  it("uploads the blob and sends its size when the extraction has one", async () => {
    const blob = new Blob(["x".repeat(2048)], { type: "image/jpeg" });
    const t = setup({
      extract: async () => ({ uri: "blob:frame", blob, width: 1, height: 1 }),
    });

    await backfillVideoThumbnail(input, t.options);

    const call = t.upload.mock.calls[0]![0];
    expect(call.file).toBe(blob);
    expect(call.size).toBe(2048);
  });

  it("honors timeMs and a custom filename", async () => {
    const t = setup({ timeMs: 2500, filename: (key) => `thumb-${key.split("/").pop()}` });

    await backfillVideoThumbnail(input, t.options);

    expect(t.extract).toHaveBeenCalledWith(input.videoUrl, 2500);
    expect(t.upload.mock.calls[0]![0].customFilename).toBe("thumb-01ABC.mov");
  });

  it("fails when no frame could be read, without uploading", async () => {
    const t = setup({ extract: jest.fn(async () => null) });

    const result = await backfillVideoThumbnail(input, t.options);

    expect(result).toMatchObject({ status: "failed", videoKey: "videos/01ABC.mov" });
    expect(result.status === "failed" && result.errorMessage).toMatch(/could not read a frame/i);
    expect(result.status === "failed" && result.errorMessage).not.toMatch(/cors/i);
    expect(t.upload).not.toHaveBeenCalled();
  });

  it("mentions CORS on web when no frame could be read", async () => {
    const restore = jest.replaceProperty(Platform, "OS", "web");
    try {
      const t = setup({ extract: jest.fn(async () => null) });

      const result = await backfillVideoThumbnail(input, t.options);

      expect(result.status).toBe("failed");
      expect(result.status === "failed" && result.errorMessage).toMatch(/could not read a frame/i);
      expect(result.status === "failed" && result.errorMessage).toMatch(/CORS/);
    } finally {
      restore.restore();
    }
  });

  it("turns a throwing extractor into a failed result that keeps the error", async () => {
    const error = new Error("decoder exploded");
    const t = setup({ extract: jest.fn(async () => { throw error; }) });

    const result = await backfillVideoThumbnail(input, t.options);

    expect(result).toMatchObject({ status: "failed", error });
    expect(result.status === "failed" && result.errorMessage).toContain("decoder exploded");
    expect(t.upload).not.toHaveBeenCalled();
  });

  it("turns an upload error into a failed result and never rejects", async () => {
    const error = new Error("Upload failed: 403");
    const t = setup({ upload: jest.fn(async () => { throw error; }) });

    const result = await backfillVideoThumbnail(input, t.options);

    expect(result).toMatchObject({ status: "failed", videoKey: "videos/01ABC.mov", error });
    expect(result.status === "failed" && result.errorMessage).toContain("Upload failed: 403");
  });

  it("fails rather than upload without an id to name the thumbnail by", async () => {
    const t = setup();

    const result = await backfillVideoThumbnail({ ...input, videoKey: "videos/" }, t.options);

    expect(result.status).toBe("failed");
    expect(t.upload).not.toHaveBeenCalled();
  });

  describe("blob urls", () => {
    const revoke = jest.fn();
    const original = URL.revokeObjectURL;

    beforeEach(() => {
      revoke.mockClear();
      URL.revokeObjectURL = revoke;
    });

    afterEach(() => {
      URL.revokeObjectURL = original;
    });

    const blobFrame = async () => ({
      uri: "blob:http://localhost/frame",
      blob: new Blob(["x"]),
      width: 1,
      height: 1,
    });

    it("revokes the blob url it was given after a successful upload", async () => {
      const t = setup({ extract: blobFrame });
      await backfillVideoThumbnail(input, t.options);
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:http://localhost/frame");
    });

    it("revokes it when the upload fails too", async () => {
      const t = setup({
        extract: blobFrame,
        upload: jest.fn(async () => { throw new Error("nope"); }),
      });
      await backfillVideoThumbnail(input, t.options);
      expect(revoke).toHaveBeenCalledWith("blob:http://localhost/frame");
    });

    it("leaves file urls and the video url alone", async () => {
      const t = setup();
      await backfillVideoThumbnail({ ...input, videoUrl: "blob:http://localhost/video" }, t.options);
      expect(revoke).not.toHaveBeenCalled();
    });
  });
});
