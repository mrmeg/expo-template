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
type StatusListener = (payload: { status: string; error?: { message: string } }) => void;
let mockStatus = "readyToPlay";
let mockStatusListener: StatusListener | null = null;
const mockRemoveListener = jest.fn(() => {
  mockStatusListener = null;
});
const mockCreateVideoPlayer = jest.fn(() => ({
  get status() {
    return mockStatus;
  },
  addListener: jest.fn((_event: string, listener: StatusListener) => {
    mockStatusListener = listener;
    return { remove: mockRemoveListener };
  }),
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = "readyToPlay";
    mockStatusListener = null;
  });

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

  it("waits for the player to load before asking for a frame (iOS returns none while idle)", async () => {
    mockStatus = "idle";
    const pending = extractVideoThumbnailNative("file:///video.mp4", 1000, dependencies);
    await Promise.resolve();
    expect(mockGenerateThumbnailsAsync).not.toHaveBeenCalled();

    mockStatusListener?.({ status: "loading" });
    await Promise.resolve();
    expect(mockGenerateThumbnailsAsync).not.toHaveBeenCalled();

    mockStatusListener?.({ status: "readyToPlay" });
    await expect(pending).resolves.toMatchObject({ uri: "file:///cache/thumbnail.jpg" });
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });

  it("rejects, and releases the player, when the video fails to load", async () => {
    mockStatus = "loading";
    const pending = extractVideoThumbnailNative("file:///video.mp4", 1000, dependencies);
    mockStatusListener?.({ status: "error", error: { message: "unsupported" } });

    await expect(pending).rejects.toThrow("unsupported");
    expect(mockGenerateThumbnailsAsync).not.toHaveBeenCalled();
    expect(mockPlayerRelease).toHaveBeenCalledTimes(1);
  });

  it("gives up when the player never loads", async () => {
    jest.useFakeTimers();
    try {
      mockStatus = "loading";
      const pending = extractVideoThumbnailNative("file:///video.mp4", 1000, dependencies, 500);
      jest.advanceTimersByTime(500);

      await expect(pending).rejects.toThrow("did not load within 500 ms");
      expect(mockRemoveListener).toHaveBeenCalledTimes(1);
      expect(mockPlayerRelease).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("falls back to the first frame for a clip shorter than the requested time", async () => {
    mockGenerateThumbnailsAsync.mockResolvedValueOnce([]);

    await expect(extractVideoThumbnailNative("file:///short.mp4", 1000, dependencies)).resolves.toMatchObject({
      width: 640,
    });
    expect(mockGenerateThumbnailsAsync.mock.calls).toEqual([[1], [0]]);
  });

  it("rejects when the player returns no frame at all", async () => {
    mockGenerateThumbnailsAsync.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(extractVideoThumbnailNative("file:///video.mp4", 1000, dependencies)).rejects.toThrow("no frame");
    expect(mockPlayerRelease).toHaveBeenCalledTimes(1);
  });
});
