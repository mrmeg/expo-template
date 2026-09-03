/**
 * The policy is the contract the whole pipeline rests on: whatever the client
 * uploads carries a content type the server accepts, or the asset is rejected.
 * These cases are the ones the live bug walked through — a HEIF photo that is
 * smaller than its JPEG re-encode, and an "unknown" type that used to become
 * `application/octet-stream`.
 */

import {
  chooseUploadCandidate,
  isAllowlistedContentType,
  isHeicContentType,
  isUnknownContentType,
  normalizeContentType,
  resolveUploadFormatPolicy,
} from "../uploadPolicy";

/** The template's image allowlist: no HEIC, on purpose. */
const IMAGES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const VIDEOS = ["video/mp4", "video/quicktime", "video/webm"];

describe("normalizeContentType", () => {
  it("lowercases, strips parameters, and folds JPEG aliases", () => {
    expect(normalizeContentType("IMAGE/JPEG")).toBe("image/jpeg");
    expect(normalizeContentType("image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(normalizeContentType("image/jpg")).toBe("image/jpeg");
    expect(normalizeContentType("image/pjpeg")).toBe("image/jpeg");
  });

  it("returns an empty string for nothing", () => {
    expect(normalizeContentType(undefined)).toBe("");
    expect(normalizeContentType(null)).toBe("");
    expect(normalizeContentType("   ")).toBe("");
  });
});

describe("isUnknownContentType", () => {
  it.each(["", "application/octet-stream", "binary/octet-stream", "   "])(
    "treats %p as unidentified",
    (value) => {
      expect(isUnknownContentType(value)).toBe(true);
    },
  );

  it("does not treat a real type as unidentified", () => {
    expect(isUnknownContentType("image/jpeg")).toBe(false);
  });
});

describe("isHeicContentType", () => {
  it.each([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/heix",
    "image/hevc",
    "IMAGE/HEIC",
  ])("recognises %p", (value) => {
    expect(isHeicContentType(value)).toBe(true);
  });

  it("does not recognise JPEG", () => {
    expect(isHeicContentType("image/jpeg")).toBe(false);
  });
});

describe("isAllowlistedContentType", () => {
  it("compares through normalization, so aliases match", () => {
    expect(isAllowlistedContentType("IMAGE/JPG", IMAGES)).toBe(true);
    expect(isAllowlistedContentType("image/heic", IMAGES)).toBe(false);
    expect(isAllowlistedContentType("", IMAGES)).toBe(false);
  });
});

describe("resolveUploadFormatPolicy", () => {
  it.each([
    ["image/jpeg", "jpeg"],
    ["image/jpg", "jpeg"],
    ["image/webp", "jpeg"],
    ["image/bmp", "jpeg"],
    ["image/avif", "jpeg"],
  ])("transcodes %p to JPEG", (contentType, outputFormat) => {
    const decision = resolveUploadFormatPolicy({ contentType, allowlist: IMAGES });
    expect(decision.action).toBe("transcode");
    expect(decision.outputFormat).toBe(outputFormat);
    expect(decision.requiresHeicDecode).toBe(false);
  });

  it("keeps PNG as PNG so alpha survives", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "image/png",
      allowlist: IMAGES,
    });
    expect(decision.action).toBe("transcode");
    expect(decision.outputFormat).toBe("png");
  });

  it.each([
    "image/heic",
    "image/heif",
    "image/heix",
    "image/hevc",
  ])("always transcodes %p to JPEG and asks for a decode", (contentType) => {
    const decision = resolveUploadFormatPolicy({ contentType, allowlist: IMAGES });
    expect(decision.action).toBe("transcode");
    expect(decision.outputFormat).toBe("jpeg");
    expect(decision.requiresHeicDecode).toBe(true);
    expect(decision.sourceAllowlisted).toBe(false);
    expect(decision.flattensAnimation).toBe(false);
  });

  it.each(["image/heic-sequence", "image/heif-sequence"])(
    "flags %p as animation-flattening",
    (contentType) => {
      const decision = resolveUploadFormatPolicy({ contentType, allowlist: IMAGES });
      expect(decision.action).toBe("transcode");
      expect(decision.requiresHeicDecode).toBe(true);
      expect(decision.flattensAnimation).toBe(true);
    },
  );

  it("transcodes HEIC even when the allowlist happens to include it", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "image/heic",
      allowlist: [...IMAGES, "image/heic"],
    });
    expect(decision.action).toBe("transcode");
    expect(decision.outputFormat).toBe("jpeg");
    expect(decision.sourceAllowlisted).toBe(true);
  });

  it("passes GIF through untouched when GIF is accepted", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "image/gif",
      allowlist: IMAGES,
    });
    expect(decision.action).toBe("passthrough");
    expect(decision.outputFormat).toBeUndefined();
  });

  it("rejects GIF rather than flattening it when GIF is not accepted", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "image/gif",
      allowlist: ["image/jpeg"],
    });
    expect(decision.action).toBe("reject");
    expect(decision.reason).toMatch(/GIF/);
  });

  it.each(["", "application/octet-stream", "binary/octet-stream"])(
    "rejects the unidentified type %p",
    (contentType) => {
      const decision = resolveUploadFormatPolicy({ contentType, allowlist: IMAGES });
      expect(decision.action).toBe("reject");
      expect(decision.reason).toMatch(/could not be identified/);
    },
  );

  it("rejects non-images", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "application/pdf",
      allowlist: IMAGES,
    });
    expect(decision.action).toBe("reject");
  });

  it("falls back to the other output format when the preferred one is refused", () => {
    const pngOnly = resolveUploadFormatPolicy({
      contentType: "image/jpeg",
      allowlist: ["image/png"],
    });
    expect(pngOnly.action).toBe("transcode");
    expect(pngOnly.outputFormat).toBe("png");

    const jpegOnly = resolveUploadFormatPolicy({
      contentType: "image/png",
      allowlist: ["image/jpeg"],
    });
    expect(jpegOnly.action).toBe("transcode");
    expect(jpegOnly.outputFormat).toBe("jpeg");
  });

  it("rejects when the target accepts nothing this client can encode", () => {
    const decision = resolveUploadFormatPolicy({
      contentType: "image/jpeg",
      allowlist: ["image/gif"],
    });
    expect(decision.action).toBe("reject");
  });
});

describe("chooseUploadCandidate", () => {
  const heifOriginal = { contentType: "image/heif", size: 1_000_000 };
  const jpegProcessed = { contentType: "image/jpeg", size: 2_000_000 };

  it("keeps the JPEG when the HEIF source is smaller — this is the live bug", () => {
    const choice = chooseUploadCandidate(heifOriginal, jpegProcessed, IMAGES);
    expect(choice.picked).toBe("processed");
    expect(choice.reason).toBe("source-not-allowlisted");
    expect(choice.chosen).toBe(jpegProcessed);
    expect(choice.discarded).toBe(heifOriginal);
  });

  it("keeps a format conversion regardless of size", () => {
    const choice = chooseUploadCandidate(
      { contentType: "video/webm", size: 1_000 },
      { contentType: "video/mp4", size: 9_000 },
      VIDEOS,
    );
    expect(choice.picked).toBe("processed");
    expect(choice.reason).toBe("format-conversion");
  });

  it("keeps the original when a same-format re-encode is not smaller", () => {
    const original = { contentType: "image/jpeg", size: 100_000 };
    const processed = { contentType: "image/jpeg", size: 120_000 };
    const choice = chooseUploadCandidate(original, processed, IMAGES);
    expect(choice.picked).toBe("original");
    expect(choice.reason).toBe("not-smaller");
    expect(choice.discarded).toBe(processed);
  });

  it("keeps the original when the re-encode is exactly the same size", () => {
    const original = { contentType: "image/jpeg", size: 100_000 };
    const processed = { contentType: "image/jpeg", size: 100_000 };
    expect(chooseUploadCandidate(original, processed, IMAGES).picked).toBe("original");
  });

  it("keeps the processed file when it is smaller", () => {
    const original = { contentType: "image/png", size: 100_000 };
    const processed = { contentType: "image/png", size: 40_000 };
    const choice = chooseUploadCandidate(original, processed, IMAGES);
    expect(choice.picked).toBe("processed");
    expect(choice.reason).toBe("smaller");
  });

  it("prefers the processed file when the source size is unknown", () => {
    const original = { contentType: "image/jpeg", size: 0 };
    const processed = { contentType: "image/jpeg", size: 500_000 };
    const choice = chooseUploadCandidate(original, processed, IMAGES);
    expect(choice.picked).toBe("processed");
    expect(choice.reason).toBe("source-size-unknown");
  });

  it("matches allowlist entries through aliases", () => {
    const original = { contentType: "image/jpg", size: 10_000 };
    const processed = { contentType: "image/jpeg", size: 20_000 };
    // image/jpg normalizes to image/jpeg, so this is a same-format comparison.
    expect(chooseUploadCandidate(original, processed, IMAGES).picked).toBe("original");
  });
});
