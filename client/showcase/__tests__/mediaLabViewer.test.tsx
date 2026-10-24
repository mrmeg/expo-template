/**
 * The Media Lab's Viewer section: three preset sets and "open the current
 * filter as a set", each handing `MediaViewer` an items list. The viewer
 * itself is covered in `packages/ui`; `LazyMediaViewer` is a stand-in that
 * records what it was given, since the app loads the real one through an
 * `import()` Jest cannot run.
 */
import fs from "fs";
import path from "path";
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
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

import { ViewerSection, presetSets, toViewerItem } from "../MediaLabViewer";
import {
  DEFAULT_PLAYGROUND,
  renderers,
  type LabEntry,
  type SectionRendererProps,
} from "../MediaLabScreen";
import { MEDIA_FIXTURES } from "../mediaFixtures";

const entryFor = (id: string, availability: LabEntry["availability"] = "available"): LabEntry => {
  const fixture = MEDIA_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`no fixture ${id}`);
  return { fixture, availability, uri: typeof fixture.source === "number" ? fixture.source : `https://lab.test${fixture.source}` };
};

const ALL = MEDIA_FIXTURES.map((fixture) => entryFor(fixture.id));

function section(overrides: Partial<SectionRendererProps> = {}) {
  return (
    <ViewerSection
      section="viewer"
      entries={[]}
      unavailable={[]}
      allEntries={ALL}
      filtered={{ image: [], video: [], audio: [], viewer: [] }}
      playground={DEFAULT_PLAYGROUND}
      sourceKinds={[]}
      {...overrides}
    />
  );
}

const open = (id: string) => fireEvent.press(screen.getByTestId(`viewer-open-${id}`));
const count = (id: string) => screen.getByTestId(`viewer-set-${id}-count`).props.children;

beforeEach(() => {
  mockViewer = null;
});

describe("Media Lab: Viewer renderer", () => {
  it("fills the viewer slot", () => {
    expect(renderers.viewer).toBe(ViewerSection);
  });

  it("renders three presets and the two filter sets, with the viewer closed", async () => {
    await render(section());

    for (const id of ["mixed", "scale", "one", "images-filter", "video-filter"]) {
      expect(screen.getByTestId(`viewer-set-${id}`)).toBeTruthy();
    }
    expect(mockViewer?.visible).toBe(false);
    expect(mockViewer?.items).toEqual([]);
  });

  it("never renders a list: the lab is a vertical ScrollView, and a nested vertical FlatList logs an error on native", () => {
    const source = fs
      .readFileSync(path.join(__dirname, "../MediaLabViewer.tsx"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(source).not.toMatch(/\bFlatList\b|\bSectionList\b|\bFlashList\b/);
  });
});

describe("the mixed set", () => {
  it("holds every available image and video that is not a scale thumbnail, in manifest order, and no audio", () => {
    const { mixed } = presetSets(ALL);
    const expected = MEDIA_FIXTURES.filter((f) => f.kind !== "audio" && f.category !== "scale").map((f) => f.id);

    expect(mixed.map((item) => item.key)).toEqual(expected);
    expect(mixed.some((item) => item.key.startsWith("img-scale-"))).toBe(false);
  });

  it("holds the cases the checklist names", () => {
    const keys = presetSets(ALL).mixed.map((item) => item.key);

    for (const id of [
      "img-aspect-3x1",
      "img-aspect-1x3",
      "img-aspect-21x9",
      "img-size-48mp",
      "img-orient-exif6",
      "img-fmt-png-alpha",
      "img-fmt-gif-animated",
      "vid-rotate-90",
      "remote-hls-apple-adv-ts",
      "src-404",
    ]) {
      expect(keys).toContain(id);
    }
  });

  it("includes a broken file, so its error state inside a page and paging past it are checked", () => {
    const keys = presetSets(ALL).mixed.map((item) => item.key);

    expect(keys).toEqual(expect.arrayContaining(["img-broken-zero", "src-404", "vid-broken-zero"]));
  });

  it("leaves out what is not available, and says which checklist cases that took with it", async () => {
    const entries = ALL.map((entry) =>
      entry.fixture.id === "img-size-48mp" || entry.fixture.id === "remote-hls-apple-adv-ts"
        ? { ...entry, availability: "not-generated" as const }
        : entry,
    );
    await render(section({ allEntries: entries }));

    expect(presetSets(entries).mixed.map((item) => item.key)).not.toContain("img-size-48mp");
    expect(screen.getByTestId("viewer-missing").props.children).toBe(
      "Not in the mixed set (not generated or unreachable): 48 MP, HLS with captions",
    );
  });

  it("says nothing is missing when the checklist is whole", async () => {
    await render(section());

    expect(screen.queryByTestId("viewer-missing")).toBeNull();
  });

  it("ignores the viewer section's own chips: it is every available fixture, not the current filter", async () => {
    await render(section({ entries: [entryFor("core-landscape")] }));

    expect(count("mixed")).toBe(`${presetSets(ALL).mixed.length} items`);
  });

  it("opens the viewer on it, and closes", async () => {
    await render(section());

    await open("mixed");
    expect(mockViewer?.visible).toBe(true);
    expect(mockViewer?.items).toEqual(presetSets(ALL).mixed);

    await act(async () => {
      mockViewer?.onClose();
    });
    expect(mockViewer?.visible).toBe(false);
    // The set stays, so the viewer can play its exit.
    expect(mockViewer?.items.length).toBeGreaterThan(30);
  });
});

describe("the scale set", () => {
  it("is the 60 thumbnails, as images", () => {
    const { scale } = presetSets(ALL);

    expect(scale).toHaveLength(60);
    expect(scale.every((item) => item.type === "image" && item.key.startsWith("img-scale-"))).toBe(true);
  });

  it("opens the viewer on them", async () => {
    await render(section());

    await open("scale");

    expect(mockViewer?.visible).toBe(true);
    expect(mockViewer?.items).toHaveLength(60);
  });
});

describe("the one-item set", () => {
  it("is a single image, so the viewer shows no counter or arrows", async () => {
    await render(section());

    expect(presetSets(ALL).one.map((item) => item.key)).toEqual(["core-landscape"]);
    expect(count("one")).toBe("1 item");

    await open("one");
    expect(mockViewer?.items).toHaveLength(1);
  });

  it("is empty, and cannot open, without the core picture", async () => {
    await render(section({ allEntries: ALL.filter((entry) => entry.fixture.id !== "core-landscape") }));

    expect(count("one")).toBe("0 items");
    expect(screen.getByTestId("viewer-open-one").props.accessibilityState?.disabled).toBe(true);
  });
});

describe("the current filter", () => {
  it("opens the Images section's filter result as a set", async () => {
    const images = [entryFor("img-aspect-3x1"), entryFor("img-aspect-1x3"), entryFor("core-alpha")];
    await render(section({ filtered: { image: images, video: [], audio: [], viewer: [] } }));

    expect(count("images-filter")).toBe("3 items");
    await open("images-filter");

    expect(mockViewer?.items.map((item) => item.key)).toEqual(["img-aspect-3x1", "img-aspect-1x3", "core-alpha"]);
  });

  it("opens the Video section's filter result as a set", async () => {
    const videos = [entryFor("core-video-landscape"), entryFor("vid-rotate-90")];
    await render(section({ filtered: { image: [], video: videos, audio: [], viewer: [] } }));

    await open("video-filter");

    expect(mockViewer?.items.map((item) => item.key)).toEqual(["core-video-landscape", "vid-rotate-90"]);
    expect(mockViewer?.items.every((item) => item.type === "video")).toBe(true);
  });

  it("cannot open an empty filter", async () => {
    await render(section());

    expect(screen.getByTestId("viewer-open-images-filter").props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId("viewer-open-video-filter").props.accessibilityState?.disabled).toBe(true);
  });
});

describe("what the viewer is handed for a fixture", () => {
  it("describes an image with its label as alt and title, and keys it by fixture id", () => {
    expect(toViewerItem(entryFor("img-orient-exif6"))).toEqual({
      type: "image",
      key: "img-orient-exif6",
      source: "https://lab.test/media-fixtures/images/orient-exif6.jpg",
      alt: "EXIF orientation 6",
      title: "EXIF orientation 6",
    });
  });

  it("gives a core clip its poster, and a generated one none (black until it plays)", () => {
    const core = toViewerItem(entryFor("core-video-landscape"));
    const generated = toViewerItem(entryFor("vid-rotate-90"));

    expect(core).toEqual(expect.objectContaining({ type: "video", poster: expect.anything() }));
    expect(generated).toEqual(expect.objectContaining({ type: "video", poster: undefined }));
  });

  it("skips audio, and a fixture with no origin to load from", () => {
    expect(toViewerItem(entryFor("aud-fmt-wav"))).toBeNull();
    expect(toViewerItem({ ...entryFor("img-aspect-4x3"), uri: null })).toBeNull();
  });

  it("hands an intentionally missing path to the viewer: its error state is the point", () => {
    expect(toViewerItem(entryFor("src-404"))).toEqual(expect.objectContaining({ type: "image", key: "src-404" }));
  });

  it("shows the set size in each row", async () => {
    await render(section());

    expect(within(screen.getByTestId("viewer-set-scale")).getByText("60 items")).toBeTruthy();
  });
});
