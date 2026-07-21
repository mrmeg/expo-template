const mockPlayerRelease = jest.fn();
const mockThumbnailRelease = jest.fn();
const mockContextRelease = jest.fn();
const mockImageRelease = jest.fn();
const mockSaveAsync = jest.fn(async () => ({
  uri: "file:///cache/thumbnail.jpg",
  width: 640,
  height: 360,
}));
const mockRenderAsync = jest.fn(async () => ({
  release: mockImageRelease,
  saveAsync: mockSaveAsync,
}));
const mockManipulate = jest.fn(() => ({
  release: mockContextRelease,
  renderAsync: mockRenderAsync,
}));
const mockGenerateThumbnailsAsync = jest.fn(async () => [
  {
    width: 640,
    height: 360,
    release: mockThumbnailRelease,
  },
]);
const mockCreateVideoPlayer = jest.fn(() => ({
  generateThumbnailsAsync: mockGenerateThumbnailsAsync,
  release: mockPlayerRelease,
}));

import {
  extractVideoThumbnailNative,
  type NativeThumbnailDependencies,
} from "../videoThumbnailNative";

const dependencies = {
  createVideoPlayer: mockCreateVideoPlayer,
  manipulate: mockManipulate,
  jpegFormat: "jpeg",
} as unknown as NativeThumbnailDependencies;

describe("extractVideoThumbnailNative", () => {
  it("uses expo-video and preserves the file URI result contract", async () => {
    await expect(
      extractVideoThumbnailNative("file:///video.mp4", 1500, dependencies),
    ).resolves.toEqual({
      uri: "file:///cache/thumbnail.jpg",
      width: 640,
      height: 360,
    });

    expect(mockCreateVideoPlayer).toHaveBeenCalledWith("file:///video.mp4");
    expect(mockGenerateThumbnailsAsync).toHaveBeenCalledWith(1.5);
    expect(mockManipulate).toHaveBeenCalledWith(
      expect.objectContaining({ width: 640, height: 360 }),
    );
    expect(mockSaveAsync).toHaveBeenCalledWith({ compress: 0.8, format: "jpeg" });
    expect(mockImageRelease).toHaveBeenCalledTimes(1);
    expect(mockContextRelease).toHaveBeenCalledTimes(1);
    expect(mockThumbnailRelease).toHaveBeenCalledTimes(1);
    expect(mockPlayerRelease).toHaveBeenCalledTimes(1);
  });
});
