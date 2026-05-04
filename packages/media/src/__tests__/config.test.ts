import {
  createMediaConfig,
  mediaTypeForKey,
  resolveContentTypeExtension,
  sanitizeFilenameBase,
  validateMediaConfig,
} from "..";
import { buildMediaKey } from "../keys";

const config = createMediaConfig({
  buckets: {
    publicImages: {
      provider: "r2",
      bucket: "media",
      endpoint: "https://r2.example",
      region: "auto",
      credentials: {
        accessKeyId: "key",
        secretAccessKey: "secret",
      },
    },
  },
  mediaTypes: {
    avatars: {
      bucket: "publicImages",
      prefix: "users/avatars",
      allowedContentTypes: ["image/jpeg", "image/png"],
      maxBytes: 1024,
    },
  },
});

describe("@mrmeg/expo-media shared contract", () => {
  it("validates complete bucket and media type config", () => {
    expect(validateMediaConfig(config)).toEqual({
      valid: true,
      missing: [],
      errors: [],
    });
  });

  it("reports app-supplied disabled config without leaking values", () => {
    const result = validateMediaConfig({
      ...config,
      disabled: { missing: ["MEDIA_PUBLIC_BUCKET"] },
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["MEDIA_PUBLIC_BUCKET"]);
    expect(result.errors).toEqual([]);
  });

  it("derives extensions from approved content types", () => {
    expect(resolveContentTypeExtension("image/jpeg")).toBe("jpg");
    expect(resolveContentTypeExtension("video/mp4; charset=utf-8")).toBe("mp4");
    expect(resolveContentTypeExtension("application/x-unknown")).toBeNull();
  });

  it("sanitizes custom filename bases and rejects traversal", () => {
    expect(sanitizeFilenameBase("My Avatar.jpg")).toBe("My-Avatar");
    expect(sanitizeFilenameBase("../avatar")).toBeNull();
    expect(sanitizeFilenameBase("nested/avatar")).toBeNull();
  });

  it("builds keys inside configured prefixes", () => {
    const key = buildMediaKey(config.mediaTypes.avatars, {
      mediaType: "avatars",
      contentType: "image/jpeg",
      id: "01HX",
    });
    expect(key).toBe("users/avatars/01HX.jpg");
    expect(mediaTypeForKey(config, key!)).toBe("avatars");
    expect(mediaTypeForKey(config, "../escape.jpg")).toBeNull();
  });
});
