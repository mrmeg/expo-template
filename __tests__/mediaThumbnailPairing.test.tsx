/**
 * The media tab's video/thumbnail pairing: thumbnails never list as files of
 * their own, a video without one offers a backfill, and deleting a video sends
 * its thumbnail with it.
 *
 * The pairing, the companion deletes and the backfill itself are covered in
 * `packages/media`; here the hooks are stubbed so only the tab's wiring is under
 * test. Lives outside `app/` because Expo Router treats files there as routes.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/test/mockTheme";

const mockDeleteBatch = jest.fn(async () => ({ deleted: [], errors: [] }));
const mockDeleteOne = jest.fn(async () => ({}));
const mockBackfillRun = jest.fn();
let mockBackfillRunning = false;

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/client/components/LazyMediaViewer", () => ({ LazyMediaViewer: () => null }));
jest.mock("@mrmeg/expo-media/picker", () => ({
  useMediaPicker: () => ({ pick: jest.fn(), picking: false, permission: null }),
}));

jest.mock("@mrmeg/expo-media/upload-queue", () => ({
  useUploadQueue: () => ({
    items: [],
    add: jest.fn(),
    retry: jest.fn(),
    remove: jest.fn(),
    clearFinished: jest.fn(),
    clear: jest.fn(),
    isActive: false,
    counts: { queued: 0, processing: 0, uploading: 0, done: 0, failed: 0 },
  }),
  useVideoThumbnailBackfill: () => ({
    run: mockBackfillRun,
    running: mockBackfillRunning,
    progress: { done: 1, failed: 0, total: 2 },
    results: [],
  }),
}));

jest.mock("@/client/features/media/mediaClient", () => {
  const video = (id: string) => ({ key: `videos/${id}.mov`, size: 4096, lastModified: "2026-10-25T12:00:00Z" });
  return {
    isMediaOriginUnconfigured: false,
    mediaQueryHooks: {
      useMediaList: () => ({
        data: { items: [], totalCount: 0 },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: jest.fn(),
      }),
      usePairedVideoList: () => ({
        data: {
          videos: [
            {
              video: video("01WITH"),
              thumbnailKey: "thumbnails/01WITH.jpg",
              thumbnail: { key: "thumbnails/01WITH.jpg", size: 100, lastModified: "2026-10-25T12:00:00Z" },
            },
            { video: video("01BARE"), thumbnailKey: "thumbnails/01BARE.jpg" },
          ],
          orphanThumbnails: [],
        },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: jest.fn(),
      }),
      useSignedUrls: ({ mediaKeys }: { mediaKeys: string[] }) => ({
        data: { urls: Object.fromEntries(mediaKeys.map((key) => [key, `https://bucket.example.dev/${key}?sig=1`])) },
      }),
      useMediaDelete: () => ({ mutateAsync: mockDeleteOne, isPending: false }),
      useMediaDeleteBatch: () => ({ mutateAsync: mockDeleteBatch, isPending: false }),
      useMediaUpload: () => ({ mutateAsync: jest.fn(), isPending: false }),
    },
  };
});

import MediaScreen from "@/app/(main)/(tabs)/media";

beforeEach(() => {
  jest.clearAllMocks();
  mockBackfillRunning = false;
});

describe("media tab thumbnails", () => {
  it("lists the videos, not their thumbnails", async () => {
    await render(<MediaScreen />);

    expect(screen.getByText("01WITH.mov")).toBeTruthy();
    expect(screen.getByText("01BARE.mov")).toBeTruthy();
    expect(screen.queryByText("01WITH.jpg")).toBeNull();
  });

  it("offers to create the missing thumbnail, from the video's signed URL", async () => {
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByText("Create 1 missing thumbnail"));

    expect(mockBackfillRun).toHaveBeenCalledWith([
      { videoKey: "videos/01BARE.mov", videoUrl: "https://bucket.example.dev/videos/01BARE.mov?sig=1" },
    ]);
  });

  it("shows progress while a backfill runs", async () => {
    mockBackfillRunning = true;
    await render(<MediaScreen />);

    expect(screen.getByText("Creating thumbnails 1/2")).toBeTruthy();
  });

  it("deletes a video together with its thumbnail", async () => {
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByLabelText("Delete 01WITH.mov"));

    expect(mockDeleteBatch).toHaveBeenCalledWith(["videos/01WITH.mov", "thumbnails/01WITH.jpg"]);
    expect(mockDeleteOne).not.toHaveBeenCalled();
  });
});
