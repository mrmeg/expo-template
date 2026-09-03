/**
 * HEIC handling is where the original bug lived: detection missed
 * `application/octet-stream` shares, and a failed conversion returned the
 * un-converted HEIF bytes, which then uploaded under a content type the server
 * refuses. Both halves are pinned here — detect from three independent signals,
 * and never hand back anything that is not JPEG.
 *
 * The decoder is injected rather than module-mocked: `heic2any` is an optional
 * peer loaded through a lazy `import()` that only a bundler resolves, which is
 * the same reason `videoThumbnailNative` takes its native modules as arguments.
 */

import {
  convertHeicToJpeg,
  convertHeicToJpegIfNeeded,
  hasHeicExtension,
  isHeicBlob,
  readLeadingBytes,
} from "../heicConvert";
import type { HeicDecoder } from "../heicConvert";
import { isMediaProcessingError } from "../../errors";

const decoder = jest.fn<ReturnType<HeicDecoder>, Parameters<HeicDecoder>>();

/** `[4-byte box size]"ftyp"[brand]` followed by filler. */
function heifBytes(brand = "heic"): Uint8Array<ArrayBuffer> {
  const header = `ftyp${brand}`;
  const out = new Uint8Array(16);
  out.set([0x00, 0x00, 0x00, 0x18], 0);
  for (let index = 0; index < header.length; index += 1) {
    out[4 + index] = header.charCodeAt(index);
  }
  return out;
}

function blobOf(bytes: Uint8Array<ArrayBuffer>, type: string): Blob {
  return new Blob([bytes], { type });
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("hasHeicExtension", () => {
  it.each(["photo.heic", "photo.HEIC", "photo.heif", "photo.hif", " photo.heic "])(
    "recognises %p",
    (fileName) => {
      expect(hasHeicExtension(fileName)).toBe(true);
    },
  );

  it.each([undefined, null, "", "photo.jpg", "heic.png"])("rejects %p", (fileName) => {
    expect(hasHeicExtension(fileName)).toBe(false);
  });
});

describe("readLeadingBytes", () => {
  it("reads only the requested prefix", async () => {
    const blob = blobOf(heifBytes(), "image/heic");
    const bytes = await readLeadingBytes(blob, 12);
    expect(bytes).toHaveLength(12);
    expect(Array.from(bytes.slice(4, 8))).toEqual(
      Array.from("ftyp").map((char) => char.charCodeAt(0)),
    );
  });
});

describe("isHeicBlob", () => {
  it.each(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"])(
    "trusts the declared type %p",
    async (type) => {
      expect(await isHeicBlob(blobOf(JPEG_BYTES, type))).toBe(true);
    },
  );

  it("trusts a HEIC file extension over a blank type", async () => {
    expect(await isHeicBlob(blobOf(JPEG_BYTES, ""), "IMG_0001.HEIC")).toBe(true);
  });

  it("sniffs ftyp when the picker declared application/octet-stream", async () => {
    // This is exactly how iOS Safari hands over a camera-roll share.
    expect(await isHeicBlob(blobOf(heifBytes(), "application/octet-stream"))).toBe(true);
  });

  it("sniffs ftyp when the picker declared nothing", async () => {
    expect(await isHeicBlob(blobOf(heifBytes(), ""))).toBe(true);
  });

  it("recognises the image-sequence brand", async () => {
    expect(await isHeicBlob(blobOf(heifBytes("msf1"), ""))).toBe(true);
  });

  it("does not sniff when a specific non-HEIC type was declared", async () => {
    // A JPEG that claims to be a JPEG is taken at its word — the sniff is only a
    // fallback for opaque declarations, not a second opinion.
    expect(await isHeicBlob(blobOf(heifBytes(), "image/jpeg"))).toBe(false);
  });

  it("returns false for a real JPEG with an opaque type", async () => {
    expect(await isHeicBlob(blobOf(JPEG_BYTES, "application/octet-stream"))).toBe(false);
  });
});

describe("convertHeicToJpeg", () => {
  it("returns the decoder's JPEG blob", async () => {
    const jpeg = blobOf(JPEG_BYTES, "image/jpeg");
    decoder.mockResolvedValue(jpeg);

    const result = await convertHeicToJpeg(
      blobOf(heifBytes(), "image/heic"),
      "IMG.HEIC",
      decoder,
    );

    expect(result).toBe(jpeg);
    expect(decoder).toHaveBeenCalledWith(
      expect.objectContaining({ toType: "image/jpeg", quality: expect.any(Number) }),
    );
  });

  it("takes the first frame when the decoder returns a multi-image array", async () => {
    // Bursts and Live Photos decode to Blob[].
    const first = blobOf(JPEG_BYTES, "image/jpeg");
    decoder.mockResolvedValue([first, blobOf(JPEG_BYTES, "image/jpeg")]);

    expect(
      await convertHeicToJpeg(blobOf(heifBytes(), "image/heic"), undefined, decoder),
    ).toBe(first);
  });

  it("normalizes a result whose type is not JPEG", async () => {
    decoder.mockResolvedValue(blobOf(JPEG_BYTES, ""));

    const result = await convertHeicToJpeg(
      blobOf(heifBytes(), "image/heic"),
      undefined,
      decoder,
    );

    expect(result.type).toBe("image/jpeg");
  });

  it("throws rather than returning the HEIF bytes when the decoder fails", async () => {
    decoder.mockRejectedValue(new Error("ERR_LIBHEIF format not supported"));

    const error = await convertHeicToJpeg(
      blobOf(heifBytes(), "image/heic"),
      undefined,
      decoder,
    ).catch((caught: unknown) => caught);

    expect(isMediaProcessingError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "heic-conversion-failed",
      contentType: "image/heic",
    });
  });

  it("throws when the decoder resolves with no image data", async () => {
    decoder.mockResolvedValue(new Blob([], { type: "image/jpeg" }));

    await expect(
      convertHeicToJpeg(blobOf(heifBytes(), "image/heic"), undefined, decoder),
    ).rejects.toMatchObject({ code: "heic-conversion-failed" });
  });

  it("throws when the decoder resolves with something that is not a blob", async () => {
    decoder.mockResolvedValue("not a blob");

    await expect(
      convertHeicToJpeg(blobOf(heifBytes(), "image/heic"), undefined, decoder),
    ).rejects.toMatchObject({ code: "heic-conversion-failed" });
  });

  it("fails loudly when the lazy peer cannot be loaded", async () => {
    // No bundler here, so the default decoder's `import("heic2any")` fails —
    // which is the same shape as the peer being absent in a consumer app.
    await expect(
      convertHeicToJpeg(blobOf(heifBytes(), "image/heic")),
    ).rejects.toMatchObject({ code: "heic-conversion-failed" });
  });
});

describe("convertHeicToJpegIfNeeded", () => {
  it("converts a HEIF blob", async () => {
    const jpeg = blobOf(JPEG_BYTES, "image/jpeg");
    decoder.mockResolvedValue(jpeg);

    expect(
      await convertHeicToJpegIfNeeded(blobOf(heifBytes(), "image/heic"), undefined, decoder),
    ).toBe(jpeg);
  });

  it("hands a non-HEIF blob straight back without loading the decoder", async () => {
    const jpeg = blobOf(JPEG_BYTES, "image/jpeg");

    expect(await convertHeicToJpegIfNeeded(jpeg, undefined, decoder)).toBe(jpeg);
    expect(decoder).not.toHaveBeenCalled();
  });
});
