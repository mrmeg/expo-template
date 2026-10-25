/**
 * The media tab caches thumbnails under the object key, not the signed URL.
 *
 * Every refetch re-signs the URLs (same object, new query string). With the
 * URL as expo-image's cache key, each re-sign missed the cache and downloaded
 * the thumbnail again; `cacheKey` pins the entry to the object instead.
 *
 * Lives outside `app/` because Expo Router treats files there as routes. The
 * media hooks are stubbed, so no request or native module is involved.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { MediaViewerProps } from "@mrmeg/expo-ui/components/MediaViewer";

import "@/test/mockTheme";

const mockImageSources: Array<{ uri?: string; cacheKey?: string }> = [];
let mockViewer: MediaViewerProps | null = null;
let mockSignature = "sig=first";

jest.mock("expo-image", () => ({
  Image: (props: { source: { uri?: string; cacheKey?: string } }) => {
    mockImageSources.push(props.source);
    return null;
  },
}));

jest.mock("@/client/features/media/mediaClient", () => {
  const listFor = (mediaType: string) => {
    const items: Record<string, { key: string; size: number; lastModified: string }[]> = {
      uploads: [{ key: "uploads/photo.jpg", size: 1024, lastModified: "2026-09-01T12:00:00Z" }],
      videos: [{ key: "videos/clip.mp4", size: 4096, lastModified: "2026-09-02T12:00:00Z" }],
    };
    const list = items[mediaType] ?? [];
    return { items: list, totalCount: list.length };
  };
  const idle = { mutateAsync: jest.fn(), isPending: false };

  return {
    isMediaOriginUnconfigured: false,
    mediaQueryHooks: {
      useMediaList: ({ mediaType }: { mediaType: string }) => ({
        data: listFor(mediaType),
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: jest.fn(),
      }),
      useSignedUrls: ({ mediaKeys, path }: { mediaKeys: string[]; path?: string }) => ({
        data: {
          urls: Object.fromEntries(
            mediaKeys.map((key) => [
              key,
              `https://bucket.example.dev/${path ? `${path}/` : ""}${key}?${mockSignature}`,
            ]),
          ),
        },
      }),
      useMediaDelete: () => idle,
      useMediaDeleteBatch: () => idle,
      useMediaUpload: () => idle,
    },
  };
});

jest.mock("@mrmeg/expo-media/picker", () => ({
  useMediaPicker: () => ({ pick: jest.fn(), picking: false, permission: null }),
}));
// The lightbox is the kit's `MediaViewer`, covered in `packages/ui`; here only what the tab hands it.
jest.mock("@/client/components/LazyMediaViewer", () => ({
  LazyMediaViewer: (props: MediaViewerProps) => {
    mockViewer = props;
    return null;
  },
}));

import MediaScreen from "@/app/(main)/(tabs)/media";

function latestSourceFor(cacheKey: string) {
  return [...mockImageSources].reverse().find((source) => source.cacheKey === cacheKey);
}

describe("media tab thumbnails", () => {
  beforeEach(() => {
    mockImageSources.length = 0;
    mockSignature = "sig=first";
  });

  it("keys an image thumbnail's cache entry on its object key", async () => {
    await render(<MediaScreen />);

    expect(latestSourceFor("uploads/photo.jpg")).toEqual({
      uri: "https://bucket.example.dev/uploads/photo.jpg?sig=first",
      cacheKey: "uploads/photo.jpg",
    });
  });

  it("keys a video's poster on its thumbnail's object key", async () => {
    await render(<MediaScreen />);

    expect(latestSourceFor("thumbnails/clip.jpg")).toEqual({
      uri: "https://bucket.example.dev/thumbnails/clip.jpg?sig=first",
      cacheKey: "thumbnails/clip.jpg",
    });
  });

  it("keeps the same cache key when the URL is re-signed", async () => {
    const { rerender } = await render(<MediaScreen />);

    mockSignature = "sig=second";
    await rerender(<MediaScreen />);

    expect(latestSourceFor("uploads/photo.jpg")?.uri).toBe(
      "https://bucket.example.dev/uploads/photo.jpg?sig=second",
    );
    expect(mockImageSources.every((source) => source.cacheKey)).toBe(true);
  });
});

describe("media tab viewer", () => {
  beforeEach(() => {
    mockViewer = null;
    mockSignature = "sig=first";
  });

  const expectedItems = (signature: string) => [
    {
      type: "video",
      key: "videos/clip.mp4",
      source: `https://bucket.example.dev/videos/clip.mp4?${signature}`,
      title: "clip.mp4",
      poster: {
        uri: `https://bucket.example.dev/thumbnails/clip.jpg?${signature}`,
        cacheKey: "thumbnails/clip.jpg",
      },
    },
    {
      type: "image",
      key: "uploads/photo.jpg",
      source: { uri: `https://bucket.example.dev/uploads/photo.jpg?${signature}`, cacheKey: "uploads/photo.jpg" },
      alt: "photo.jpg",
      title: "photo.jpg",
    },
  ];

  it("is closed until a tile is opened", async () => {
    await render(<MediaScreen />);

    expect(mockViewer?.visible).toBe(false);
  });

  it("opens on the image that was tapped, with every image and video in list order", async () => {
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByLabelText("Open photo.jpg"));

    expect(mockViewer?.visible).toBe(true);
    expect(mockViewer?.initialIndex).toBe(1);
    expect(mockViewer?.items).toEqual(expectedItems("sig=first"));
  });

  it("opens on the video whose play button was tapped, with the other items alongside it", async () => {
    await render(<MediaScreen />);

    await fireEvent.press(screen.getByLabelText("Play clip.mp4"));

    expect(mockViewer?.visible).toBe(true);
    expect(mockViewer?.initialIndex).toBe(0);
    expect(mockViewer?.items).toHaveLength(2);
  });

  it("closes, and keeps its items so the viewer can play its exit", async () => {
    await render(<MediaScreen />);
    await fireEvent.press(screen.getByLabelText("Open photo.jpg"));

    await act(async () => {
      mockViewer?.onClose();
    });

    expect(mockViewer?.visible).toBe(false);
    expect(mockViewer?.items).toHaveLength(2);
  });

  it("keeps the URLs it opened with when the list is re-signed under it, so a playing clip does not restart", async () => {
    const { rerender } = await render(<MediaScreen />);
    await fireEvent.press(screen.getByLabelText("Play clip.mp4"));

    mockSignature = "sig=second";
    await rerender(<MediaScreen />);

    expect(mockViewer?.items).toEqual(expectedItems("sig=first"));
  });

  it("takes the new URLs the next time it opens, still under the same cache keys", async () => {
    const { rerender } = await render(<MediaScreen />);
    await fireEvent.press(screen.getByLabelText("Open photo.jpg"));
    await act(async () => {
      mockViewer?.onClose();
    });

    mockSignature = "sig=second";
    await rerender(<MediaScreen />);
    await fireEvent.press(screen.getByLabelText("Open photo.jpg"));

    expect(mockViewer?.items).toEqual(expectedItems("sig=second"));
  });
});

describe("media tab actions", () => {
  it("names the refresh and upload icon-only buttons", async () => {
    await render(<MediaScreen />);

    expect(screen.getByRole("button", { name: "Refresh media" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload media" })).toBeTruthy();
  });
});
