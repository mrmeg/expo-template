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
import { render } from "@testing-library/react-native";

import "@/test/mockTheme";

const mockImageSources: Array<{ uri?: string; cacheKey?: string }> = [];
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

jest.mock("@/client/features/media/hooks/useMediaLibrary", () => ({
  useMediaLibrary: () => ({ pickMedia: jest.fn(), processing: false }),
}));
jest.mock("@/client/features/media/components/VideoPlayer", () => ({ VideoPlayer: () => null }));
jest.mock("@/client/features/media/components/ImagePreview", () => ({ ImagePreview: () => null }));

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
