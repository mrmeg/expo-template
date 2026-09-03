/**
 * `processAsset` is the only path from a picked asset to an upload, and it makes
 * exactly one promise: the result's `contentType` is in the caller's allowlist,
 * or the asset throws. The final `describe` block in this file is the property
 * test that pins that promise shut — it is the test the original bug (a HEIF
 * photo reaching the server as `image/heif`) would have failed.
 *
 * Everything platform-specific arrives through the injected adapter, so these
 * cases cover both web (an adapter with `decodeHeic`) and native (one without)
 * from a single suite.
 */

import { isMediaProcessingError } from "../errors";
import { processAsset } from "../processAsset";
import type {
  ContentTypeAllowlist,
  ProcessAssetInput,
  ProcessingPhase,
} from "../processAsset";
import type { ImagePlatformAdapter } from "../adapter";
import { resolveCompressionConfig } from "../imageCompression/config";
import type {
  EncodedImage,
  EncodeImageOptions,
  ImageSource,
} from "../imageCompression/types";
import { convertVideo, needsConversion } from "../videoConversion";
import { extractVideoThumbnail } from "../videoThumbnails";

jest.mock("../videoConversion", () => ({
  MAX_CLIENT_CONVERSION_SIZE: 500 * 1024 * 1024,
  TARGET_MIME_TYPE: "video/mp4",
  convertVideo: jest.fn(),
  needsConversion: jest.fn(),
}));

jest.mock("../videoThumbnails", () => ({
  extractVideoThumbnail: jest.fn(),
}));

const convertVideoMock = convertVideo as unknown as jest.Mock;
const needsConversionMock = needsConversion as unknown as jest.Mock;
const extractVideoThumbnailMock = extractVideoThumbnail as unknown as jest.Mock;

/** The template's server allowlist. HEIC is absent on purpose. */
const ALLOWLIST: ContentTypeAllowlist = {
  image: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

interface FakeAdapterConfig {
  /** What the platform sniffer reports for an opaque declared type. */
  sniffed?: string | null;
  /** What `measure` reports when the picker withheld a size. */
  measured?: number;
  /** Makes `measure` fail, as an unreadable file would. */
  measureFails?: boolean;
  /** What `probeDimensions` reports. */
  dimensions?: { width: number; height: number };
  /** Encoded byte size, per requested long edge. */
  encodedSize?: (rung: number) => number;
  /** Content type the encoder claims it produced. */
  encodedContentType?: (format: string) => string;
  /** Present only on the web-shaped adapter. */
  decodeHeic?: (source: ImageSource) => Promise<ImageSource>;
}

function makeAdapter(config: FakeAdapterConfig = {}) {
  const encodedSize = config.encodedSize ?? (() => 120_000);
  const encodedContentType =
    config.encodedContentType ?? ((format: string) => `image/${format}`);

  const encode = jest.fn(
    async (options: EncodeImageOptions): Promise<EncodedImage> => ({
      uri: `file:///encoded-${options.longEdge}.${options.format}`,
      width: options.longEdge,
      height: Math.round(options.longEdge * 0.75),
      contentType: encodedContentType(options.format),
      size: encodedSize(options.longEdge),
    }),
  );
  const dispose = jest.fn((_image: { uri: string }): void => undefined);
  const measure = jest.fn(async (): Promise<number> => {
    if (config.measureFails) throw new Error("Could not read the size of this file.");
    return config.measured ?? 4_000_000;
  });
  const probeDimensions = jest.fn(async () => config.dimensions ?? { width: 4000, height: 3000 });
  const sniffContentType = jest.fn(async (): Promise<string | null> => config.sniffed ?? null);
  const decodeHeic = config.decodeHeic ? jest.fn(config.decodeHeic) : undefined;

  const adapter: ImagePlatformAdapter = {
    encode,
    dispose,
    measure,
    probeDimensions,
    sniffContentType,
    ...(decodeHeic ? { decodeHeic } : {}),
  };

  return { adapter, encode, dispose, measure, probeDimensions, sniffContentType, decodeHeic };
}

const NATIVE_HEIF: ProcessAssetInput = {
  uri: "file:///DCIM/IMG_0001.HEIC",
  contentType: "image/heif",
  fileName: "IMG_0001.HEIC",
  width: 4032,
  height: 3024,
  size: 1_200_000,
};

beforeEach(() => {
  needsConversionMock.mockReturnValue(false);
  convertVideoMock.mockResolvedValue({
    uri: "blob:converted",
    size: 1_000,
    mimeType: "video/mp4",
    originalFormat: "webm",
    converted: true,
  });
  extractVideoThumbnailMock.mockResolvedValue(null);
});

describe("processAsset — identification", () => {
  it("trusts a specific declared content type without sniffing", async () => {
    const { adapter, sniffContentType } = makeAdapter();

    await processAsset({
      asset: { uri: "file:///photo.jpg", contentType: "image/jpeg", size: 100 },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(sniffContentType).not.toHaveBeenCalled();
  });

  it("sniffs when the picker declared application/octet-stream", async () => {
    // iOS Safari shares camera-roll photos this way; the old pipeline shipped
    // the opaque type straight to the server.
    const { adapter, sniffContentType, encode } = makeAdapter({ sniffed: "image/heic" });

    const result = await processAsset({
      asset: {
        uri: "file:///share/IMG_0002",
        contentType: "application/octet-stream",
        width: 4000,
        height: 3000,
        size: 2_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(sniffContentType).toHaveBeenCalled();
    expect(encode).toHaveBeenCalled();
    expect(result.contentType).toBe("image/jpeg");
  });

  it("falls back to the file name when the sniffer cannot help", async () => {
    const { adapter } = makeAdapter({ sniffed: null });

    const result = await processAsset({
      asset: {
        uri: "file:///share/photo.png",
        contentType: "",
        fileName: "photo.png",
        width: 800,
        height: 600,
        size: 10_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(result.contentType).toBe("image/png");
  });

  it("rejects an asset nothing can identify", async () => {
    const { adapter, encode } = makeAdapter({ sniffed: null });

    const error = await processAsset({
      asset: { uri: "file:///share/mystery", contentType: "", size: 10_000 },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    }).catch((caught: unknown) => caught);

    expect(isMediaProcessingError(error)).toBe(true);
    expect(error).toMatchObject({ code: "unsupported-format" });
    expect(encode).not.toHaveBeenCalled();
  });

  it("rejects a file type that is not media at all", async () => {
    const { adapter } = makeAdapter();

    await expect(
      processAsset({
        asset: { uri: "file:///doc.pdf", contentType: "application/pdf", size: 10_000 },
        allowlist: ALLOWLIST,
        adapter,
        config: null,
      }),
    ).rejects.toMatchObject({ code: "unsupported-format" });
  });
});

describe("processAsset — HEIF", () => {
  it("uploads the JPEG even when the HEIF source is smaller (the live bug)", async () => {
    // 300 KB HEIF in, 900 KB JPEG out — HEIF is simply a better codec. The old
    // never-larger guard reverted to the HEIF here and the server answered 400.
    const { adapter } = makeAdapter({ encodedSize: () => 900_000 });

    const result = await processAsset({
      asset: { ...NATIVE_HEIF, size: 300_000 },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.contentType).toBe("image/jpeg");
    expect(result.size).toBe(900_000);
    expect(result.originalSize).toBe(300_000);
    expect(result.applied).toEqual(
      expect.arrayContaining(["resize:2048", "encode:image/jpeg"]),
    );
    expect(result.applied).not.toContain("kept-original:not-smaller");
  });

  it("transcodes HEIF with no ladder configured rather than passing it through", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 900_000 });

    const result = await processAsset({
      asset: NATIVE_HEIF,
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(encode).toHaveBeenCalledTimes(1);
    // Transcode-only keeps the source's dimensions.
    expect(encode.mock.calls[0][0].longEdge).toBe(4032);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("decodes HEIF first on an adapter that needs it, then releases the intermediate", async () => {
    const decoded: ImageSource = { uri: "blob:decoded-heic" };
    const { adapter, dispose, encode, probeDimensions } = makeAdapter({
      decodeHeic: async () => decoded,
      dimensions: { width: 4032, height: 3024 },
      encodedSize: () => 300_000,
    });

    const result = await processAsset({
      asset: {
        uri: "blob:heic-source",
        contentType: "image/heic",
        fileName: "IMG_0003.HEIC",
        // Pickers report 0x0 for HEIC, so dimensions have to be probed after the
        // decode — probing the HEIF bytes would throw.
        width: 0,
        height: 0,
        size: 1_500_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.applied).toContain("heic-decode");
    expect(probeDimensions).toHaveBeenCalledWith(decoded);
    expect(encode.mock.calls[0][0].source).toBe(decoded);
    expect(dispose).toHaveBeenCalledWith(decoded);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("fails the asset when the HEIF decode fails instead of uploading HEIF bytes", async () => {
    const { adapter } = makeAdapter({
      decodeHeic: async () => {
        throw new Error("ERR_LIBHEIF");
      },
    });

    await expect(
      processAsset({
        asset: { ...NATIVE_HEIF, uri: "blob:heic" },
        allowlist: ALLOWLIST,
        adapter,
        config: resolveCompressionConfig("gallery"),
      }),
    ).rejects.toThrow("ERR_LIBHEIF");
  });

  it("does not release the decoded intermediate when it becomes the result", async () => {
    const decoded: ImageSource = {
      uri: "blob:decoded-heic",
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    };
    const { adapter, dispose, encode } = makeAdapter({
      decodeHeic: async () => decoded,
      dimensions: { width: 800, height: 600 },
    });

    const result = await processAsset({
      asset: {
        uri: "blob:heic-source",
        contentType: "image/heic",
        width: 800,
        height: 600,
        // Small enough for the gallery preset's passthrough fast path.
        size: 100_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode).not.toHaveBeenCalled();
    expect(result.uri).toBe("blob:decoded-heic");
    expect(dispose).not.toHaveBeenCalled();
  });
});

describe("processAsset — passthrough", () => {
  it("passes an allowlisted GIF through without re-encoding it", async () => {
    const { adapter, encode } = makeAdapter();

    const result = await processAsset({
      asset: {
        uri: "file:///loop.gif",
        contentType: "image/gif",
        width: 480,
        height: 480,
        size: 3_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode).not.toHaveBeenCalled();
    expect(result.contentType).toBe("image/gif");
    expect(result.applied).toContain("passthrough");
    expect(result.size).toBe(3_000_000);
  });

  it("rejects a GIF the target does not accept rather than flattening it", async () => {
    const { adapter } = makeAdapter();

    await expect(
      processAsset({
        asset: { uri: "file:///loop.gif", contentType: "image/gif", size: 1_000 },
        allowlist: { image: ["image/jpeg", "image/png"], video: ALLOWLIST.video },
        adapter,
        config: resolveCompressionConfig("gallery"),
      }),
    ).rejects.toMatchObject({ code: "unsupported-format" });
  });

  it("skips the ladder for an allowlisted source that already fits the fast path", async () => {
    const { adapter, encode } = makeAdapter();

    const result = await processAsset({
      asset: {
        uri: "file:///small.jpg",
        contentType: "image/jpeg",
        width: 1200,
        height: 900,
        size: 180_000, // under gallery's 300 KB passthrough
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode).not.toHaveBeenCalled();
    expect(result.applied).toEqual(["passthrough:176KB"]);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("still runs the ladder for a small source whose dimensions are too large", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 150_000 });

    await processAsset({
      asset: {
        uri: "file:///wide.jpg",
        contentType: "image/jpeg",
        // Under the byte budget but a 6000px long edge: a screenshot-sized upload
        // that still needs resizing.
        width: 6000,
        height: 1000,
        size: 180_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode).toHaveBeenCalled();
  });

  it("never uses the fast path for a preset with a hard dimension target", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 40_000 });

    await processAsset({
      asset: {
        uri: "file:///tiny.jpg",
        contentType: "image/jpeg",
        width: 300,
        height: 300,
        size: 20_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("avatar"),
    });

    // avatar has passthroughBytes: 0, so a 20 KB source is still resized to 512.
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("passes an allowlisted source through when no ladder is configured", async () => {
    const { adapter, encode } = makeAdapter();

    const result = await processAsset({
      asset: {
        uri: "file:///huge.jpg",
        contentType: "image/jpeg",
        width: 8000,
        height: 6000,
        size: 20_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(encode).not.toHaveBeenCalled();
    expect(result.applied).toContain("passthrough");
  });
});

describe("processAsset — never larger", () => {
  it("keeps the original when a same-format re-encode came out bigger", async () => {
    const { adapter, dispose } = makeAdapter({ encodedSize: () => 900_000 });

    const result = await processAsset({
      asset: {
        uri: "file:///photo.jpg",
        contentType: "image/jpeg",
        width: 2400,
        height: 1800,
        size: 500_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.uri).toBe("file:///photo.jpg");
    expect(result.size).toBe(500_000);
    expect(result.applied).toContain("kept-original:not-smaller");
    // The rejected encode must not survive as a temp file.
    expect(dispose).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///encoded-2048.jpeg" }),
    );
  });

  it("prefers the re-encode when the source size cannot be read", async () => {
    // An unmeasurable source cannot win a size comparison, and a failed
    // measurement must not fail the asset either.
    const { adapter } = makeAdapter({
      measureFails: true,
      encodedSize: () => 900_000,
    });

    const result = await processAsset({
      asset: {
        uri: "file:///photo.jpg",
        contentType: "image/jpeg",
        width: 2400,
        height: 1800,
        size: null,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.uri).toBe("file:///encoded-2048.jpeg");
    expect(result.originalSize).toBe(0);
  });
});

describe("processAsset — format and geometry", () => {
  it("keeps PNG as PNG so alpha survives", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 200_000 });

    const result = await processAsset({
      asset: {
        uri: "file:///logo.png",
        contentType: "image/png",
        width: 3000,
        height: 3000,
        size: 4_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode.mock.calls[0][0].format).toBe("png");
    expect(result.contentType).toBe("image/png");
  });

  it("honours an explicit format override on the config", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 200_000 });

    await processAsset({
      asset: {
        uri: "file:///logo.png",
        contentType: "image/png",
        width: 3000,
        height: 3000,
        size: 4_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig({ format: "jpeg" }),
    });

    expect(encode.mock.calls[0][0].format).toBe("jpeg");
  });

  it("runs the ladder on displayed dimensions for a rotated photo", async () => {
    const { adapter, encode } = makeAdapter({ encodedSize: () => 200_000 });

    await processAsset({
      asset: {
        uri: "file:///portrait.jpg",
        contentType: "image/jpeg",
        // Stored landscape, displayed portrait (orientation 6).
        width: 4032,
        height: 3024,
        exifOrientation: 6,
        size: 4_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode.mock.calls[0][0]).toMatchObject({ width: 3024, height: 4032 });
  });

  it("reports overBudget when even the smallest rung misses the budget", async () => {
    const { adapter } = makeAdapter({ encodedSize: () => 5_000_000 });

    const result = await processAsset({
      asset: {
        uri: "file:///panorama.jpg",
        contentType: "image/jpeg",
        width: 12000,
        height: 3000,
        size: 40_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.overBudget).toBe(true);
    expect(result.applied).toContain("over-budget");
  });

  it("transcodes to the one format the target accepts", async () => {
    const { adapter, encode } = makeAdapter({
      encodedSize: () => 100_000,
      encodedContentType: () => "image/png",
    });

    const result = await processAsset({
      asset: {
        uri: "file:///photo.jpg",
        contentType: "image/jpeg",
        width: 2000,
        height: 1500,
        size: 4_000_000,
      },
      allowlist: { image: ["image/png"], video: ALLOWLIST.video },
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(encode.mock.calls[0][0].format).toBe("png");
    expect(result.contentType).toBe("image/png");
  });

  it("fails the asset when the encoder produced a type the target refuses", async () => {
    // Safari substituting PNG for a WebP request is the real-world version of
    // this. Better a failed asset than a 400 at upload time.
    const { adapter } = makeAdapter({
      encodedSize: () => 100_000,
      encodedContentType: () => "image/webp",
    });

    await expect(
      processAsset({
        asset: {
          uri: "file:///photo.jpg",
          contentType: "image/jpeg",
          width: 2000,
          height: 1500,
          size: 4_000_000,
        },
        allowlist: { image: ["image/jpeg"], video: ALLOWLIST.video },
        adapter,
        config: resolveCompressionConfig("gallery"),
      }),
    ).rejects.toMatchObject({ code: "unsupported-format" });
  });
});

describe("processAsset — result shape", () => {
  it("returns a frozen result with a frozen trace", async () => {
    const { adapter } = makeAdapter({ encodedSize: () => 100_000 });

    const result = await processAsset({
      asset: {
        uri: "file:///photo.jpg",
        contentType: "image/jpeg",
        width: 2400,
        height: 1800,
        size: 4_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.applied)).toBe(true);
  });

  it("reports phases in order and finishes with complete", async () => {
    const { adapter } = makeAdapter({
      sniffed: "image/heic",
      decodeHeic: async () => ({ uri: "blob:decoded" }),
      dimensions: { width: 4000, height: 3000 },
      encodedSize: () => 100_000,
    });
    const phases: ProcessingPhase["type"][] = [];

    await processAsset({
      asset: {
        uri: "blob:opaque",
        contentType: "application/octet-stream",
        width: 0,
        height: 0,
        size: 3_000_000,
      },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
      onPhase: (_asset, phase) => phases.push(phase.type),
    });

    expect(phases).toEqual(["identifying", "decoding-heic", "compressing", "complete"]);
  });

  it("passes the asset back with every phase so a batch can attribute progress", async () => {
    const { adapter } = makeAdapter({ encodedSize: () => 100_000 });
    const asset: ProcessAssetInput = {
      uri: "file:///photo.jpg",
      contentType: "image/jpeg",
      width: 2400,
      height: 1800,
      size: 4_000_000,
    };
    const seen: ProcessAssetInput[] = [];

    await processAsset({
      asset,
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
      onPhase: (reported) => seen.push(reported),
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const reported of seen) expect(reported).toBe(asset);
  });
});

describe("processAsset — video", () => {
  const MOV: ProcessAssetInput = {
    uri: "file:///clip.mov",
    contentType: "video/quicktime",
    width: 1920,
    height: 1080,
    size: 20_000_000,
    durationSeconds: 12,
    kind: "video",
  };

  it("passes an allowlisted video through untouched", async () => {
    const { adapter } = makeAdapter();

    const result = await processAsset({
      asset: MOV,
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.kind).toBe("video");
    expect(result.contentType).toBe("video/quicktime");
    expect(result.size).toBe(20_000_000);
    expect(result.durationSeconds).toBe(12);
    expect(convertVideoMock).not.toHaveBeenCalled();
  });

  it("attaches a thumbnail when one can be extracted", async () => {
    const { adapter } = makeAdapter();
    extractVideoThumbnailMock.mockResolvedValue({
      uri: "file:///thumb.jpg",
      width: 640,
      height: 360,
    });

    const result = await processAsset({
      asset: MOV,
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(result.thumbnail).toMatchObject({
      uri: "file:///thumb.jpg",
      contentType: "image/jpeg",
      width: 640,
      height: 360,
    });
  });

  it("survives a thumbnail failure", async () => {
    const { adapter } = makeAdapter();
    extractVideoThumbnailMock.mockRejectedValue(new Error("no video track"));

    const result = await processAsset({
      asset: MOV,
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(result.thumbnail).toBeUndefined();
    expect(result.contentType).toBe("video/quicktime");
  });

  it("keeps a WebM→MP4 conversion even when the MP4 is larger", async () => {
    const { adapter } = makeAdapter();
    needsConversionMock.mockReturnValue(true);
    convertVideoMock.mockResolvedValue({
      uri: "blob:converted.mp4",
      size: 30_000_000,
      mimeType: "video/mp4",
      originalFormat: "webm",
      converted: true,
    });

    const result = await processAsset({
      asset: {
        uri: "blob:clip.webm",
        contentType: "video/webm",
        size: 10_000_000,
        kind: "video",
      },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(result.contentType).toBe("video/mp4");
    expect(result.size).toBe(30_000_000);
    expect(result.applied).toContain("video-convert:webm->mp4");
  });

  it("keeps an allowlisted source when conversion fails", async () => {
    const { adapter } = makeAdapter();
    needsConversionMock.mockReturnValue(true);
    convertVideoMock.mockRejectedValue(new Error("ffmpeg unavailable"));

    const result = await processAsset({
      asset: {
        uri: "file:///clip.webm",
        contentType: "video/webm",
        size: 10_000_000,
        kind: "video",
      },
      allowlist: ALLOWLIST,
      adapter,
      config: null,
    });

    expect(result.contentType).toBe("video/webm");
    expect(result.applied).toContain("video-convert-failed");
  });

  it("rejects a video the target cannot accept once conversion fails", async () => {
    const { adapter } = makeAdapter();
    needsConversionMock.mockReturnValue(true);
    convertVideoMock.mockRejectedValue(new Error("ffmpeg unavailable"));

    await expect(
      processAsset({
        asset: {
          uri: "file:///clip.mkv",
          contentType: "video/x-matroska",
          size: 10_000_000,
          kind: "video",
        },
        allowlist: ALLOWLIST,
        adapter,
        config: null,
      }),
    ).rejects.toMatchObject({ code: "unsupported-format" });
  });

  it("infers the video kind from the content type when the picker omits it", async () => {
    const { adapter } = makeAdapter();

    const result = await processAsset({
      asset: { uri: "file:///clip.mp4", contentType: "video/mp4", size: 1_000 },
      allowlist: ALLOWLIST,
      adapter,
      config: resolveCompressionConfig("gallery"),
    });

    expect(result.kind).toBe("video");
  });
});

/**
 * The invariant, over the whole fixture matrix: either the call throws a
 * `MediaProcessingError`, or the result's content type is one the server
 * accepts. There is no third outcome — no `application/octet-stream`, no
 * `image/heif`, no silently substituted WebP.
 */
describe("processAsset — allowlist invariant", () => {
  const SOURCE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/avif",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "application/octet-stream",
    "application/pdf",
    "",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
  ];

  const ALLOWLISTS: ContentTypeAllowlist[] = [
    ALLOWLIST,
    { image: ["image/jpeg"], video: ["video/mp4"] },
    { image: ["image/png"], video: ["video/mp4", "video/quicktime"] },
    { image: ["image/jpeg", "image/png"], video: [] },
  ];

  const CONFIGS = [
    null,
    resolveCompressionConfig("gallery"),
    resolveCompressionConfig("avatar"),
    resolveCompressionConfig("none"),
  ];

  const ENCODER_TYPES: (((format: string) => string) | undefined)[] = [
    undefined,
    // Safari substituting a type it does not support.
    () => "image/png",
  ];

  const cases = SOURCE_TYPES.flatMap((contentType) =>
    ALLOWLISTS.flatMap((allowlist, allowlistIndex) =>
      CONFIGS.flatMap((config, configIndex) =>
        ENCODER_TYPES.map((encodedContentType, encoderIndex) => ({
          contentType,
          allowlist,
          config,
          encodedContentType,
          label: `${contentType || "(blank)"} → allowlist#${allowlistIndex} config#${configIndex} encoder#${encoderIndex}`,
        })),
      ),
    ),
  );

  it.each([true, false])(
    "produces an allowlisted type or throws (decodeHeic available: %p)",
    async (webLike) => {
      expect(cases.length).toBeGreaterThan(100);

      for (const testCase of cases) {
        const { adapter } = makeAdapter({
          sniffed: null,
          encodedSize: () => 250_000,
          encodedContentType: testCase.encodedContentType,
          decodeHeic: webLike
            ? async () => ({ uri: "blob:decoded", blob: new Blob(["x"]) })
            : undefined,
        });

        const outcome = await processAsset({
          asset: {
            uri: "file:///asset.bin",
            contentType: testCase.contentType,
            width: 3000,
            height: 2000,
            size: 4_000_000,
            durationSeconds: 5,
          },
          allowlist: testCase.allowlist,
          adapter,
          config: testCase.config,
        }).then(
          (result) => ({ ok: true as const, result }),
          (error: unknown) => ({ ok: false as const, error }),
        );

        if (!outcome.ok) {
          expect({
            label: testCase.label,
            isProcessingError: isMediaProcessingError(outcome.error),
          }).toEqual({ label: testCase.label, isProcessingError: true });
          continue;
        }

        const accepted =
          outcome.result.kind === "video"
            ? testCase.allowlist.video
            : testCase.allowlist.image;

        expect({
          label: testCase.label,
          contentType: outcome.result.contentType,
          allowed: accepted.includes(outcome.result.contentType),
        }).toEqual({
          label: testCase.label,
          contentType: outcome.result.contentType,
          allowed: true,
        });
      }
    },
  );
});
