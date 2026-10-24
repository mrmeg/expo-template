/**
 * The Media Lab's Images section: every image fixture through `Image`, driven
 * by the playground. `expo-image` is a `View` that captures its props, so the
 * tests read what each tile asked it to draw.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { act, render, screen, within } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

// `AudioPlayer` (in the Audio section and the previews) imports `expo-audio`, which has no native module under Jest: opt in to the fake.
jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

import { ImageSection } from "../MediaLabImages";
import {
  DEFAULT_PLAYGROUND,
  renderers,
  type LabEntry,
  type PlaygroundState,
  type SectionRendererProps,
  type SourceKindEntry,
} from "../MediaLabScreen";
import { MEDIA_FIXTURES } from "../mediaFixtures";

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const entry = (id: string, uri: string | number | null = `https://lab.test/${id}.jpg`): LabEntry => {
  const fixture = MEDIA_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`no fixture ${id}`);
  return { fixture, availability: "available", uri };
};

const SCALE_IDS = Array.from({ length: 60 }, (_, index) => `img-scale-${String(index + 1).padStart(2, "0")}`);

const SOURCE_KINDS: SourceKindEntry[] = [
  { id: "bundled", label: "Bundled require()", uri: 7 },
  { id: "public", label: "Public path", uri: "/media-fixtures/images/aspect-4x3.jpg" },
  { id: "remote", label: "Remote HTTPS", uri: "https://example.com/icon.png" },
  { id: "data-uri", label: "Data URI", uri: "data:image/png;base64,AAAA" },
];

function section(overrides: Partial<SectionRendererProps> = {}, playground: Partial<PlaygroundState> = {}) {
  return (
    <ImageSection
      section="image"
      entries={[]}
      unavailable={[]}
      allEntries={[]}
      filtered={{ image: [], video: [], audio: [], viewer: [] }}
      playground={{ ...DEFAULT_PLAYGROUND, ...playground }}
      sourceKinds={SOURCE_KINDS}
      {...overrides}
    />
  );
}

const tile = (id: string) => screen.getByTestId(`image-tile-${id}`);
const frame = (id: string) => screen.getByTestId(`image-${id}`, { includeHiddenElements: true });
const picture = (id: string) => within(frame(id)).getByTestId("expo-image", { includeHiddenElements: true });

describe("Media Lab: Images renderer", () => {
  it("fills the image slot", () => {
    expect(renderers.image).toBe(ImageSection);
  });

  it("renders every entry as a tile through Image, with its label and size", async () => {
    await render(section({ entries: [entry("core-landscape"), entry("core-portrait"), entry("img-fmt-svg-viewbox")] }));

    expect(within(tile("core-landscape")).getByText("Landscape 16:9")).toBeTruthy();
    expect(within(tile("core-landscape")).getByText("1600×900")).toBeTruthy();
    expect(within(tile("img-fmt-svg-viewbox")).getByText("no intrinsic size")).toBeTruthy();
    expect(picture("core-portrait").props.source).toBe("https://lab.test/core-portrait.jpg");
    expect(frame("core-portrait").props.accessibilityLabel).toBe("Portrait 9:16");
  });

  it("says what to run when nothing can be rendered", async () => {
    await render(section({ entries: [] }));

    expect(screen.getByTestId("image-empty")).toBeTruthy();
  });

  describe("playground", () => {
    it("hands fit, position and radius to every image", async () => {
      await render(
        section(
          { entries: [entry("core-landscape"), entry("core-square")] },
          { imageFit: "contain", imagePosition: "top", radius: "lg" },
        ),
      );

      for (const id of ["core-landscape", "core-square"]) {
        expect(picture(id).props).toEqual(expect.objectContaining({ contentFit: "contain", contentPosition: "top" }));
        expect(flat(frame(id)).borderRadius).toBe(14);
      }
    });

    it("ratio: draws each fixture at its own ratio, and a stored-landscape EXIF 6 file as portrait", async () => {
      await render(section({ entries: [entry("core-landscape"), entry("img-orient-exif6"), entry("img-aspect-1x3")] }));

      expect(flat(frame("core-landscape")).aspectRatio).toBeCloseTo(16 / 9);
      expect(flat(frame("img-orient-exif6")).aspectRatio).toBeCloseTo(450 / 800);
      expect(flat(frame("img-aspect-1x3")).aspectRatio).toBeCloseTo(1 / 3);
    });

    it("ratio: a fixture with no size in the manifest draws at 4:3", async () => {
      await render(section({ entries: [entry("img-fmt-svg-viewbox"), entry("img-broken-zero")] }));

      expect(flat(frame("img-fmt-svg-viewbox")).aspectRatio).toBeCloseTo(4 / 3);
      expect(flat(frame("img-broken-zero")).aspectRatio).toBeCloseTo(4 / 3);
    });

    it("max height caps a tall frame through its width", async () => {
      await render(section({ entries: [entry("img-aspect-1x3")] }, { maxHeight: true }));

      expect(flat(frame("img-aspect-1x3")).maxWidth).toBeCloseTo(160 / 3);
    });

    it("auto: starts square and settles at the natural ratio after load", async () => {
      await render(section({ entries: [entry("core-landscape")] }, { imageSizing: "auto" }));
      expect(flat(frame("core-landscape")).aspectRatio).toBe(1);

      await act(async () => {
        picture("core-landscape").props.onLoad({ source: { url: "x", width: 1600, height: 900, mediaType: null } });
      });

      expect(flat(frame("core-landscape")).aspectRatio).toBeCloseTo(16 / 9);
    });

    it("fill: absolutely fills a fixed box", async () => {
      await render(section({ entries: [entry("core-landscape")] }, { imageSizing: "fill" }));

      expect(flat(frame("core-landscape"))).toEqual(expect.objectContaining({ position: "absolute", top: 0, left: 0 }));
      expect(flat(frame("core-landscape").parent as TestInstance)).toEqual(expect.objectContaining({ height: 180 }));
    });

    it("style: sizes the frame with style", async () => {
      await render(section({ entries: [entry("core-landscape")] }, { imageSizing: "style" }));

      expect(flat(frame("core-landscape"))).toEqual(expect.objectContaining({ width: "100%", height: 180 }));
      expect(flat(frame("core-landscape"))).not.toHaveProperty("aspectRatio");
    });
  });

  it("an entry that expects an error reaches the error state, not a blank frame", async () => {
    await render(section({ entries: [entry("img-broken-truncated"), entry("src-404", "/media-fixtures/images/does-not-exist.jpg")] }));

    await act(async () => {
      picture("img-broken-truncated").props.onError({ error: "decode failed" });
      picture("src-404").props.onError({ error: "404" });
    });

    for (const id of ["img-broken-truncated", "src-404"]) {
      expect(within(frame(id)).getByTestId("icon-image-off", { includeHiddenElements: true })).toBeTruthy();
      expect(within(frame(id)).queryByTestId("expo-image", { includeHiddenElements: true })).toBeNull();
    }
  });

  describe("responsive source array", () => {
    const widths = ["img-responsive-400", "img-responsive-800", "img-responsive-1600"];

    it("is one tile holding the three widths, in order, with their sizes", async () => {
      await render(section({ entries: widths.map((id) => entry(id)) }));

      const source = picture("responsive-array").props.source as { uri: string; width: number; height: number }[];
      expect(source.map((item) => item.uri)).toEqual(widths.map((id) => `https://lab.test/${id}.jpg`));
      expect(source.map((item) => item.width)).toEqual([400, 800, 1600]);
      expect(source.map((item) => item.height)).toEqual([224, 450, 900]);
    });

    it("is left out when a width is missing or filtered away", async () => {
      await render(section({ entries: [entry(widths[0]), entry(widths[1])] }));

      expect(screen.queryByTestId("image-tile-responsive-array")).toBeNull();
    });
  });

  describe("scale set", () => {
    it("renders in a horizontal FlatList strip, not in the tile grid, with a recyclingKey per cell", async () => {
      await render(section({ entries: SCALE_IDS.map((id) => entry(id)) }));

      const strip = screen.getByTestId("scale-grid", { includeHiddenElements: true });
      expect(strip.props.horizontal).toBe(true);
      expect(screen.queryByTestId("image-grid")).toBeNull();
      const first = within(screen.getByTestId("scale-image-img-scale-01", { includeHiddenElements: true })).getByTestId(
        "expo-image",
        { includeHiddenElements: true },
      );
      expect(first.props.recyclingKey).toBe("img-scale-01");
    });

    // A vertical list inside the lab's vertical ScrollView logs React Native's
    // nested-VirtualizedList error on native and breaks windowing.
    it("is horizontal and one cell tall, so it never nests a vertical list in the lab's ScrollView", async () => {
      await render(section({ entries: SCALE_IDS.map((id) => entry(id)) }));

      const strip = screen.getByTestId("scale-grid", { includeHiddenElements: true });
      expect(flat(strip).height).toBe(96);
      expect(flat(screen.getByTestId("scale-image-img-scale-01", { includeHiddenElements: true })).width).toBe(96);
    });
  });

  describe("source kinds", () => {
    it("hands each kind to Image as its source: a require() number, a path, a URL and a data URI", async () => {
      await render(section());

      const source = (kind: string) =>
        within(screen.getByTestId(`source-image-${kind}`, { includeHiddenElements: true })).getByTestId("expo-image", {
          includeHiddenElements: true,
        }).props.source;
      expect(source("bundled")).toBe(7);
      expect(source("public")).toBe("/media-fixtures/images/aspect-4x3.jpg");
      expect(source("remote")).toBe("https://example.com/icon.png");
      expect(source("data-uri")).toBe("data:image/png;base64,AAAA");
    });

    it("includes the picked file:// URI when there is one", async () => {
      await render(section({ sourceKinds: [...SOURCE_KINDS, { id: "picked", label: "Picked from library", uri: "file:///tmp/IMG_1.heic" }] }));

      expect(
        within(screen.getByTestId("source-image-picked", { includeHiddenElements: true })).getByTestId("expo-image", {
          includeHiddenElements: true,
        }).props.source,
      ).toBe("file:///tmp/IMG_1.heic");
    });

    it("says 'no origin' for a kind native cannot load", async () => {
      await render(section({ sourceKinds: [{ id: "public", label: "Public path", uri: null }] }));

      expect(within(screen.getByTestId("image-source-public")).getByText("no origin")).toBeTruthy();
      expect(screen.queryByTestId("source-image-public")).toBeNull();
    });
  });
});
