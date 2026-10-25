import {
  isVideoThumbnailKey,
  mediaKeyId,
  pairVideoThumbnails,
  videoThumbnailDeleteCompanions,
  videoThumbnailKey,
  withVideoThumbnailKeys,
} from "../thumbnails";

const pairing = { thumbnailPrefix: "thumbnails" };
const item = (key: string) => ({ key, size: 1, lastModified: "" });

describe("mediaKeyId", () => {
  it("drops the directory and the last extension", () => {
    expect(mediaKeyId("videos/01ABC.mov")).toBe("01ABC");
    expect(mediaKeyId("a/b/c/01ABC.mp4")).toBe("01ABC");
  });

  it("keeps a name with no extension", () => {
    expect(mediaKeyId("videos/01ABC")).toBe("01ABC");
    expect(mediaKeyId("01ABC")).toBe("01ABC");
  });

  it("only strips the final extension", () => {
    expect(mediaKeyId("videos/clip.final.mov")).toBe("clip.final");
  });

  it("returns an empty id for a trailing slash or a bare extension", () => {
    expect(mediaKeyId("videos/")).toBe("");
    expect(mediaKeyId("videos/.mov")).toBe("");
    expect(mediaKeyId("")).toBe("");
  });
});

describe("videoThumbnailKey", () => {
  it("maps the video id under the thumbnail prefix as jpg", () => {
    expect(videoThumbnailKey("videos/01ABC.mov", pairing)).toBe("thumbnails/01ABC.jpg");
  });

  it("works for nested video and thumbnail prefixes", () => {
    expect(
      videoThumbnailKey("users/42/videos/01ABC.mp4", { thumbnailPrefix: "users/42/thumbs" }),
    ).toBe("users/42/thumbs/01ABC.jpg");
  });

  it("normalizes the prefix like other prefixes", () => {
    expect(videoThumbnailKey("videos/01ABC.mov", { thumbnailPrefix: "/thumbnails//" })).toBe(
      "thumbnails/01ABC.jpg",
    );
    expect(videoThumbnailKey("videos/01ABC.mov", { thumbnailPrefix: " a / b " })).toBe(
      "a/b/01ABC.jpg",
    );
  });

  it("honors a custom extension, with or without the dot", () => {
    expect(videoThumbnailKey("videos/01ABC.mov", { ...pairing, extension: "webp" })).toBe(
      "thumbnails/01ABC.webp",
    );
    expect(videoThumbnailKey("videos/01ABC.mov", { ...pairing, extension: ".png" })).toBe(
      "thumbnails/01ABC.png",
    );
  });

  it("handles a video key with no extension", () => {
    expect(videoThumbnailKey("videos/01ABC", pairing)).toBe("thumbnails/01ABC.jpg");
  });
});

describe("isVideoThumbnailKey", () => {
  it("accepts a key directly under the prefix with the extension", () => {
    expect(isVideoThumbnailKey("thumbnails/01ABC.jpg", pairing)).toBe(true);
  });

  it("rejects another extension, prefix, or nesting", () => {
    expect(isVideoThumbnailKey("thumbnails/01ABC.png", pairing)).toBe(false);
    expect(isVideoThumbnailKey("videos/01ABC.jpg", pairing)).toBe(false);
    expect(isVideoThumbnailKey("thumbnails/sub/01ABC.jpg", pairing)).toBe(false);
    expect(isVideoThumbnailKey("thumbnails2/01ABC.jpg", pairing)).toBe(false);
    expect(isVideoThumbnailKey("thumbnails/.jpg", pairing)).toBe(false);
    expect(isVideoThumbnailKey("thumbnails/", pairing)).toBe(false);
  });

  it("matches nested and unnormalized prefixes", () => {
    const nested = { thumbnailPrefix: "/users/42//thumbs/", extension: ".webp" };
    expect(isVideoThumbnailKey("users/42/thumbs/01ABC.webp", nested)).toBe(true);
    expect(isVideoThumbnailKey("users/42/thumbs/01ABC.jpg", nested)).toBe(false);
  });

  it("agrees with videoThumbnailKey", () => {
    expect(isVideoThumbnailKey(videoThumbnailKey("videos/01ABC.mov", pairing), pairing)).toBe(true);
  });
});

describe("pairVideoThumbnails", () => {
  it("joins by id and keeps the video order", () => {
    const videos = [item("videos/B.mov"), item("videos/A.mov"), item("videos/C.mp4")];
    const thumbnails = [item("thumbnails/A.jpg"), item("thumbnails/B.jpg")];

    const result = pairVideoThumbnails(videos, thumbnails, pairing);

    expect(result.videos.map((entry) => entry.video.key)).toEqual([
      "videos/B.mov",
      "videos/A.mov",
      "videos/C.mp4",
    ]);
    expect(result.videos[0]).toEqual({
      video: videos[0],
      thumbnailKey: "thumbnails/B.jpg",
      thumbnail: thumbnails[1],
    });
    expect(result.videos[1]!.thumbnail).toBe(thumbnails[0]);
    expect(result.videos[2]).toEqual({ video: videos[2], thumbnailKey: "thumbnails/C.jpg" });
    expect(result.videos[2]).not.toHaveProperty("thumbnail");
    expect(result.orphanThumbnails).toEqual([]);
  });

  it("reports thumbnails no video claims, in listed order", () => {
    const thumbnails = [item("thumbnails/Z.jpg"), item("thumbnails/A.jpg"), item("thumbnails/Y.jpg")];
    const result = pairVideoThumbnails([item("videos/A.mov")], thumbnails, pairing);
    expect(result.orphanThumbnails).toEqual([thumbnails[0], thumbnails[2]]);
  });

  it("does not pair a thumbnail with another extension, and calls it an orphan", () => {
    const thumbnails = [item("thumbnails/A.png")];
    const result = pairVideoThumbnails([item("videos/A.mov")], thumbnails, pairing);
    expect(result.videos[0]!.thumbnail).toBeUndefined();
    expect(result.orphanThumbnails).toEqual(thumbnails);
  });

  it("lets videos that share an id share the thumbnail, which is then not an orphan", () => {
    const thumbnail = item("thumbnails/A.jpg");
    const result = pairVideoThumbnails([item("videos/A.mov"), item("videos/A.mp4")], [thumbnail], pairing);
    expect(result.videos.map((entry) => entry.thumbnail)).toEqual([thumbnail, thumbnail]);
    expect(result.orphanThumbnails).toEqual([]);
  });

  it("handles empty inputs", () => {
    expect(pairVideoThumbnails([], [], pairing)).toEqual({ videos: [], orphanThumbnails: [] });
    expect(pairVideoThumbnails([], [item("thumbnails/A.jpg")], pairing).orphanThumbnails).toHaveLength(1);
  });

  it("keeps the caller's item type", () => {
    const result = pairVideoThumbnails([{ key: "videos/A.mov", url: "u" }], [], pairing);
    expect(result.videos[0]!.video.url).toBe("u");
  });
});

describe("withVideoThumbnailKeys", () => {
  const isVideoKey = (key: string) => key.startsWith("videos/");

  it("appends each video's thumbnail key after the requested keys", () => {
    expect(
      withVideoThumbnailKeys(["videos/A.mov", "uploads/x.jpg", "videos/B.mp4"], { pairing, isVideoKey }),
    ).toEqual([
      "videos/A.mov",
      "uploads/x.jpg",
      "videos/B.mp4",
      "thumbnails/A.jpg",
      "thumbnails/B.jpg",
    ]);
  });

  it("dedupes, keeping the first position", () => {
    expect(
      withVideoThumbnailKeys(
        ["thumbnails/A.jpg", "videos/A.mov", "videos/A.mov", "videos/A.mp4"],
        { pairing, isVideoKey },
      ),
    ).toEqual(["thumbnails/A.jpg", "videos/A.mov", "videos/A.mp4"]);
  });

  it("returns the keys unchanged when none is a video, and does not mutate the input", () => {
    const keys = ["uploads/x.jpg"];
    expect(withVideoThumbnailKeys(keys, { pairing, isVideoKey })).toEqual(["uploads/x.jpg"]);
    expect(withVideoThumbnailKeys([], { pairing, isVideoKey })).toEqual([]);
    expect(keys).toEqual(["uploads/x.jpg"]);
  });
});

describe("videoThumbnailDeleteCompanions", () => {
  it("names the thumbnail of a video key and nothing for other keys", () => {
    const companions = videoThumbnailDeleteCompanions({
      pairing,
      isVideoKey: (key) => key.startsWith("videos/"),
    });
    expect(companions("videos/A.mov")).toEqual(["thumbnails/A.jpg"]);
    expect(companions("uploads/A.jpg")).toEqual([]);
  });
});
