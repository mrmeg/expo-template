import {
  MEDIA_APP_SETTINGS,
  resolveMediaUploadPolicy,
} from "../mediaSettings";

describe("resolveMediaUploadPolicy", () => {
  it("uses the generalImage policy for images in the all filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "image", mimeType: "image/jpeg" },
      "all",
    );

    expect(result.name).toBe("generalImage");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.generalImage);
  });

  it("uses the video policy for videos in the all filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "video", mimeType: "video/mp4" },
      "all",
    );

    expect(result.name).toBe("video");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.video);
  });

  it("uses the avatar policy for image uploads from the avatars filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "image", mimeType: "image/png" },
      "avatars",
    );

    expect(result.name).toBe("avatar");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.avatar);
  });

  it("uses the generalImage policy for image uploads from the uploads filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "image", mimeType: "image/webp" },
      "uploads",
    );

    expect(result.name).toBe("generalImage");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.generalImage);
  });

  it("uses the video policy for video uploads from the videos filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "video", mimeType: "video/quicktime" },
      "videos",
    );

    expect(result.name).toBe("video");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.video);
  });

  it("does not redirect image uploads into thumbnails from the thumbnails filter", () => {
    const result = resolveMediaUploadPolicy(
      { type: "image", mimeType: "image/jpeg" },
      "thumbnails",
    );

    expect(result.name).toBe("generalImage");
    expect(result.policy.mediaType).toBe("uploads");
  });

  it("uses the video policy when the MIME type identifies a video", () => {
    const result = resolveMediaUploadPolicy(
      { type: undefined, mimeType: "video/webm" },
      "uploads",
    );

    expect(result.name).toBe("video");
    expect(result.policy).toBe(MEDIA_APP_SETTINGS.uploadPolicies.video);
  });
});
