/**
 * The media tab's upload wiring: what it hands `useMediaPicker` and
 * `useUploadQueue`, and how it reports a run.
 *
 * The queue itself (processing, concurrency, retry, thumbnails) is covered in
 * `packages/media`; here it is stubbed so only the app's decisions are under
 * test: the per-filter upload policy, the thumbnail convention, the denied
 * prompt, and the toasts. Lives outside `app/` because Expo Router treats files
 * there as routes.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { PickMediaResult } from "@mrmeg/expo-media/picker";
import type { UploadQueueItem, UploadQueueOptions } from "@mrmeg/expo-media/upload-queue";

import "@/test/mockTheme";

const mockPick = jest.fn<Promise<PickMediaResult>, [unknown]>();
const mockAdd = jest.fn();
const mockClearFinished = jest.fn();
const mockAlertShow = jest.fn();
let mockQueueOptions: UploadQueueOptions | null = null;
let mockQueueItems: UploadQueueItem[] = [];

jest.mock("expo-image", () => ({ Image: () => null }));

jest.mock("@mrmeg/expo-ui/state", () => {
  const actual = jest.requireActual("@mrmeg/expo-ui/state");
  const notify = Object.assign(jest.fn(), {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    hide: jest.fn(),
  });
  return { ...actual, notify };
});

jest.mock("@mrmeg/expo-ui/components/Alert", () => ({
  Alert: { show: (params: unknown) => mockAlertShow(params) },
}));

jest.mock("@/client/features/media/mediaClient", () => {
  const idle = { mutateAsync: jest.fn(), isPending: false };
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
      useSignedUrls: () => ({ data: { urls: {} } }),
      usePairedVideoList: () => ({
        data: { videos: [], orphanThumbnails: [] },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: jest.fn(),
      }),
      useMediaDelete: () => idle,
      useMediaDeleteBatch: () => idle,
      useMediaUpload: () => idle,
    },
  };
});

jest.mock("@mrmeg/expo-media/picker", () => ({
  useMediaPicker: () => ({ pick: mockPick, picking: false, permission: null }),
}));

jest.mock("@mrmeg/expo-media/upload-queue", () => ({
  useVideoThumbnailBackfill: () => ({ run: jest.fn(), running: false, progress: { done: 0, failed: 0, total: 0 }, results: [] }),
  useUploadQueue: (options: UploadQueueOptions) => {
    mockQueueOptions = options;
    return {
      items: mockQueueItems,
      add: mockAdd,
      retry: jest.fn(),
      remove: jest.fn(),
      clearFinished: mockClearFinished,
      clear: jest.fn(),
      isActive: false,
      counts: { queued: 0, processing: 0, uploading: 0, done: 0, failed: 0 },
    };
  },
}));

jest.mock("@/client/components/LazyMediaViewer", () => ({ LazyMediaViewer: () => null }));

import MediaScreen from "@/app/(main)/(tabs)/media";
import { notify as mockNotify } from "@mrmeg/expo-ui/state";

const photo = { id: "a1", uri: "file:///photo.heic", contentType: "image/heic", kind: "image" as const };
const clip = { id: "a2", uri: "file:///clip.mov", contentType: "video/quicktime", kind: "video" as const };

function item(overrides: Partial<UploadQueueItem>): UploadQueueItem {
  return {
    id: "a1",
    fileName: "photo.jpg",
    kind: "image",
    status: "done",
    asset: photo,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueOptions = null;
  mockQueueItems = [];
});

describe("media tab uploads", () => {
  it("queues what the picker returns", async () => {
    mockPick.mockResolvedValue({ status: "picked", assets: [photo, clip] });
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Upload media" }));

    expect(mockPick).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images", "videos"], multiple: true }),
    );
    expect(mockAdd).toHaveBeenCalledWith([photo, clip]);
  });

  it("explains a denied library instead of queueing", async () => {
    mockPick.mockResolvedValue({ status: "denied", canAskAgain: false });
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Upload media" }));

    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockAlertShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Settings") }),
    );
  });

  it("does nothing when the pick is canceled", async () => {
    mockPick.mockResolvedValue({ status: "canceled" });
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Upload media" }));

    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockAlertShow).not.toHaveBeenCalled();
  });

  it("resolves images to the gallery prefix, videos uncompressed, and avatars under the Avatars filter", async () => {
    await render(<MediaScreen />);

    const gallery = mockQueueOptions?.resolve(photo);
    expect(gallery?.mediaType).toBe("uploads");
    expect(gallery?.compression).toEqual(expect.objectContaining({ rungs: expect.any(Array) }));
    expect(mockQueueOptions?.resolve(clip)).toEqual({ mediaType: "videos", compression: null });

    await fireEvent.press(screen.getByText("Avatars"));

    const avatar = mockQueueOptions?.resolve(photo);
    expect(avatar?.mediaType).toBe("avatars");
    // The avatar preset's first rung is smaller than the gallery one's.
    expect(avatar?.compression?.rungs[0]).toBeLessThan(gallery?.compression?.rungs[0] ?? 0);
    expect(mockQueueOptions?.resolve(clip)).toEqual({ mediaType: "videos", compression: null });
  });

  it("stores video thumbnails under the thumbnails prefix", async () => {
    await render(<MediaScreen />);

    expect(mockQueueOptions?.videoThumbnail).toEqual({ mediaType: "thumbnails" });
  });

  it("toasts a clean run and clears the uploaded rows", async () => {
    await render(<MediaScreen />);

    await act(async () => {
      mockQueueOptions?.onSettled?.({ uploaded: [item({}), item({ id: "a2", fileName: "b.jpg" })], failed: [] });
    });

    expect(mockNotify.success).toHaveBeenCalledWith("Uploaded", {
      messages: ["2 files uploaded successfully"],
      duration: 3000,
    });
    expect(mockClearFinished).toHaveBeenCalled();
  });

  it("warns when part of a run failed, naming the files", async () => {
    await render(<MediaScreen />);

    await act(async () => {
      mockQueueOptions?.onSettled?.({
        uploaded: [item({})],
        failed: [item({ id: "a2", fileName: "clip.mov", status: "failed", errorMessage: "This file is too large." })],
      });
    });

    expect(mockNotify.warning).toHaveBeenCalledWith("Upload Incomplete", {
      messages: ["1 of 2 files uploaded", "Failed: clip.mov"],
      duration: 6000,
    });
  });

  it("shows queued files as rows above the grid", async () => {
    mockQueueItems = [item({ status: "uploading" }), item({ id: "a2", fileName: "clip.mov", status: "failed", errorMessage: "Upload failed. Try again." })];
    await render(<MediaScreen />);

    expect(screen.getByText("photo.jpg")).toBeTruthy();
    expect(screen.getByText("Uploading…")).toBeTruthy();
    expect(screen.getByText("Upload failed. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry clip.mov" })).toBeTruthy();
  });
});
