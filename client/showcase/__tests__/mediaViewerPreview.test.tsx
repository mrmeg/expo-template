/**
 * The `MediaViewer` gallery card: three thumbnails (a picture and two clips)
 * that open the viewer at the one tapped. The viewer is covered in
 * `packages/ui`; `LazyMediaViewer` records what it is handed.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { MediaViewerProps } from "@mrmeg/expo-ui/components/MediaViewer";

let mockViewer: MediaViewerProps | null = null;
// The lab and gallery also render AudioPlayer, which imports expo-audio: opt in to the fake.
jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
jest.mock("@/client/components/LazyMediaViewer", () => ({
  LazyMediaViewer: (props: MediaViewerProps) => {
    mockViewer = props;
    return null;
  },
}));

// `Video` and the viewer load through `import()`, which Jest cannot run.
jest.mock("@/client/components/LazyVideo", () => ({ LazyVideo: () => null }));

import { PREVIEWS } from "../previews";
import { COMPONENTS } from "../registry";

const Preview = PREVIEWS.MediaViewer;

beforeEach(() => {
  mockViewer = null;
});

describe("MediaViewer gallery preview", () => {
  it("is registered in the media category with its subpath", () => {
    expect(COMPONENTS).toContainEqual({
      id: "MediaViewer",
      importPath: "@mrmeg/expo-ui/components/MediaViewer",
      category: "media",
    });
    expect(Preview).toBeDefined();
  });

  it("shows three thumbnails, a picture and two clips, over a closed viewer", async () => {
    await render(<Preview />);

    for (const key of ["landscape", "landscape-video", "portrait-video"]) {
      expect(screen.getByTestId(`viewer-thumb-${key}`)).toBeTruthy();
    }
    expect(mockViewer?.visible).toBe(false);
    expect(mockViewer?.items.map((item) => [item.type, item.key])).toEqual([
      ["image", "landscape"],
      ["video", "landscape-video"],
      ["video", "portrait-video"],
    ]);
  });

  it("gives each clip its poster, and the picture a description", async () => {
    await render(<Preview />);

    const [picture, landscape, portrait] = mockViewer?.items ?? [];
    expect(picture).toEqual(expect.objectContaining({ type: "image", alt: "Color bars, landscape" }));
    expect(landscape).toEqual(expect.objectContaining({ type: "video", poster: expect.anything() }));
    expect(portrait).toEqual(expect.objectContaining({ type: "video", poster: expect.anything() }));
  });

  it("opens at the thumbnail that was tapped, and closes", async () => {
    await render(<Preview />);

    await fireEvent.press(screen.getByTestId("viewer-thumb-landscape-video"));
    expect(mockViewer?.visible).toBe(true);
    expect(mockViewer?.initialIndex).toBe(1);

    await act(async () => {
      mockViewer?.onClose();
    });
    expect(mockViewer?.visible).toBe(false);

    await fireEvent.press(screen.getByTestId("viewer-thumb-portrait-video"));
    expect(mockViewer?.initialIndex).toBe(2);
  });

  it("labels each thumbnail as a button that opens it", async () => {
    await render(<Preview />);

    expect(screen.getByLabelText("Open landscape.jpg")).toBeTruthy();
    expect(screen.getByLabelText("Open landscape.mp4")).toBeTruthy();
    expect(screen.getByLabelText("Open portrait.mp4")).toBeTruthy();
  });
});
