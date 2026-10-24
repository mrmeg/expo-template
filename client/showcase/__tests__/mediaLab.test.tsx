/**
 * Media Lab screen tests.
 *
 * Mounts the real screen with `fetch` mocked, then checks the contract the
 * component specs build on: the four availability states look different from
 * one another (and from an intentionally broken fixture), a section with no
 * renderer says which spec fills it, only available fixtures reach a renderer,
 * and the playground state reaches that renderer.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";

// jest-expo reports Platform.OS === "ios", so SegmentedControl routes to the
// native @expo/ui community module. Stand it in with pressable segments.
jest.mock("@expo/ui/community/segmented-control", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    SegmentedControl: ({
      values,
      onValueChange,
    }: {
      values: string[];
      onValueChange: (value: string) => void;
    }) => (
      <View>
        {values.map((value) => (
          <Pressable key={value} accessibilityRole="button" onPress={() => onValueChange(value)}>
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

// `AudioPlayer` (in the Audio section and the previews) imports `expo-audio`, which has no native module under Jest: opt in to the fake.
jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

import * as ImagePicker from "expo-image-picker";
import MediaLabScreen, {
  ObservedStatus,
  AVAILABILITY_LOOKS,
  AvailabilityTag,
  GENERATE_HINT,
  renderers,
  type Availability,
  type SectionRendererProps,
} from "../MediaLabScreen";
import { MEDIA_FIXTURES, type MediaFixture } from "../mediaFixtures";

const globalWithDev = globalThis as unknown as { __DEV__: boolean };
const originalDev = globalWithDev.__DEV__;
const originalFetch = global.fetch;
// The renderers the screen ships with (the Images section's, from
// `media-image`). These tests probe the slot contract with their own
// renderers, so each starts from an empty map and restores this one after.
const SHIPPED_RENDERERS = { ...renderers };

/** Generated fixtures that "exist" on the mocked server; every other generated path 404s. */
const BUILT = new Set([
  "/media-fixtures/images/aspect-4x3.jpg",
  "/media-fixtures/images/broken-zero.jpg",
  "/media-fixtures/video/aspect-1x1.mp4",
  "/media-fixtures/audio/fmt-mp3-cbr.mp3",
]);
/** Remote hosts that refuse every request. */
const DEAD_HOSTS = ["bbcmedia.co.uk"];

const response = (status: number, contentType = "application/octet-stream") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
  }) as unknown as Response;

let fetchCalls: string[] = [];
let inFlight = 0;
let maxInFlight = 0;

function installFetch() {
  fetchCalls = [];
  inFlight = 0;
  maxInFlight = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;

    if (/^https:\/\//.test(url)) {
      if (DEAD_HOSTS.some((host) => url.includes(host))) throw new TypeError("Network request failed");
      return response(200, "application/vnd.apple.mpegurl");
    }
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    return BUILT.has(path) ? response(200, "image/jpeg") : response(404, "text/plain");
  }) as unknown as typeof fetch;
}

function setScheme(scheme: "light" | "dark") {
  useThemeStore.setState({ userTheme: scheme, systemTheme: scheme, colorOverrides: {} });
}

const section = (id: string) => within(screen.getByTestId(`section-${id}`));
const row = (sectionId: string, fixtureId: string) => section(sectionId).getByTestId(`fixture-${fixtureId}`);

async function settle() {
  // Every generated and remote fixture has answered once none is still "checking".
  await waitFor(() => expect(screen.queryAllByTestId("availability-checking")).toHaveLength(0), { timeout: 4000 });
}

beforeEach(() => {
  for (const id of Object.keys(renderers) as (keyof typeof renderers)[]) delete renderers[id];
  setScheme("light");
  globalWithDev.__DEV__ = true;
  installFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
  globalWithDev.__DEV__ = originalDev;
  for (const id of Object.keys(renderers) as (keyof typeof renderers)[]) delete renderers[id];
  Object.assign(renderers, SHIPPED_RENDERERS);
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", colorOverrides: {} });
});

describe("AvailabilityTag", () => {
  const STATES = Object.keys(AVAILABILITY_LOOKS) as Availability[];

  it.each(STATES)("renders the %s state", async (state) => {
    await render(<AvailabilityTag state={state} />);

    expect(screen.getByTestId(`availability-${state}`)).toBeTruthy();
    expect(screen.getByText(AVAILABILITY_LOOKS[state].label)).toBeTruthy();
    // The glyph is decorative, so it is hidden from the accessibility tree.
    expect(screen.getByTestId(`icon-${AVAILABILITY_LOOKS[state].icon}`, { includeHiddenElements: true })).toBeTruthy();
  });

  it("gives each state its own label and icon", () => {
    const labels = STATES.map((state) => AVAILABILITY_LOOKS[state].label);
    const icons = STATES.map((state) => AVAILABILITY_LOOKS[state].icon);

    expect(new Set(labels).size).toBe(STATES.length);
    expect(new Set(icons).size).toBe(STATES.length);
    expect(AVAILABILITY_LOOKS["not-generated"].color).not.toBe(AVAILABILITY_LOOKS.available.color);
    expect(AVAILABILITY_LOOKS.unreachable.color).not.toBe(AVAILABILITY_LOOKS.available.color);
  });

  it("shows the generator hint under `not generated` only", async () => {
    const view = await render(<AvailabilityTag state="not-generated" />);
    expect(screen.getByText(GENERATE_HINT)).toBeTruthy();

    await act(async () => view.unmount());
    await render(<AvailabilityTag state="available" />);
    expect(screen.queryByText(GENERATE_HINT)).toBeNull();
  });
});

describe("Media Lab: availability", () => {
  it("shows available, not generated and unreachable fixtures differently", async () => {
    await render(<MediaLabScreen />);
    await settle();

    // Built on the mocked server.
    expect(within(row("image", "img-aspect-4x3")).getByTestId("availability-available")).toBeTruthy();
    // Not built: the hint, and not an error tile.
    const missing = row("image", "img-aspect-3x1");
    expect(within(missing).getByTestId("availability-not-generated")).toBeTruthy();
    expect(within(missing).getByText(GENERATE_HINT)).toBeTruthy();
    // Remote host refuses everything.
    expect(within(row("audio", "remote-live-mp3-bbc")).getByTestId("availability-unreachable")).toBeTruthy();
    // Remote host answers.
    expect(within(row("video", "remote-hls-apple-hevc")).getByTestId("availability-available")).toBeTruthy();
    // Core files never need a check.
    expect(within(row("image", "core-landscape")).getByTestId("availability-available")).toBeTruthy();
  });

  it("does not let an intentionally broken fixture look like a missing file", async () => {
    await render(<MediaLabScreen />);
    await settle();

    const broken = row("image", "img-broken-zero");
    expect(within(broken).getByTestId("availability-available")).toBeTruthy();
    expect(within(broken).getByText("expects error")).toBeTruthy();
    expect(within(broken).queryByText(GENERATE_HINT)).toBeNull();

    const missing = row("image", "img-aspect-3x1");
    expect(within(missing).queryByText("expects error")).toBeNull();
    expect(within(missing).queryByTestId("availability-available")).toBeNull();
  });

  it("treats the 404 source kind as available by design and never probes it", async () => {
    await render(<MediaLabScreen />);
    await settle();

    expect(within(row("image", "src-404")).getByTestId("availability-available")).toBeTruthy();
    expect(within(row("image", "src-404")).getByText("expects error")).toBeTruthy();
    expect(fetchCalls.some((url) => url.includes("does-not-exist"))).toBe(false);
  });

  it("checks every generated and remote fixture once, six at a time", async () => {
    await render(<MediaLabScreen />);
    await settle();

    const probed = MEDIA_FIXTURES.filter((f) => (f.tier === "generated" && !f.intentionallyMissing) || f.tier === "remote");
    const headCalls = (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === "HEAD");
    expect(headCalls).toHaveLength(probed.length);
    expect(maxInFlight).toBeLessThanOrEqual(6);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("falls back to a ranged GET when a remote host refuses HEAD", async () => {
    const bbc = "stream.live.vc.bbcmedia.co.uk";
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(bbc)) {
        return init?.method === "HEAD" ? response(400) : response(200, "audio/mpeg");
      }
      return /^https:\/\//.test(url) ? response(200) : response(404, "text/plain");
    }) as unknown as typeof fetch;

    await render(<MediaLabScreen />);
    await settle();

    expect(within(row("audio", "remote-live-mp3-bbc")).getByTestId("availability-available")).toBeTruthy();
    const rangedCalls = (global.fetch as jest.Mock).mock.calls.filter(([url, init]) => String(url).includes(bbc) && init?.headers?.Range);
    expect(rangedCalls).toHaveLength(1);
  });

  it("reads an HTML answer for a generated path as not generated", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) =>
      /^https:\/\//.test(String(input)) ? response(200) : response(200, "text/html; charset=utf-8"),
    ) as unknown as typeof fetch;

    await render(<MediaLabScreen />);
    await settle();

    expect(within(row("image", "img-aspect-4x3")).getByTestId("availability-not-generated")).toBeTruthy();
  });

  it("shows no origin for generated fixtures on a native build without one, and never requests them", async () => {
    globalWithDev.__DEV__ = false;
    await render(<MediaLabScreen />);
    await settle();

    expect(within(row("image", "img-aspect-4x3")).getByTestId("availability-no-origin")).toBeTruthy();
    expect(within(row("image", "src-404")).getByTestId("availability-no-origin")).toBeTruthy();
    expect(fetchCalls.some((url) => url.includes("/media-fixtures/"))).toBe(false);
    // Core and remote do not depend on the origin.
    expect(within(row("image", "core-landscape")).getByTestId("availability-available")).toBeTruthy();
    expect(within(row("video", "remote-hls-apple-hevc")).getByTestId("availability-available")).toBeTruthy();
  });

  it("collapses a fixture with nothing observed into one unverified line", async () => {
    await render(<ObservedStatus fixture={{ ...MEDIA_FIXTURES[0], observed: {} }} />);

    expect(screen.getByText("Not verified on any surface yet")).toBeTruthy();
    expect(screen.queryByText(/^iOS /)).toBeNull();
  });

  it("shows chips only for observed surfaces and lists the untested ones", async () => {
    const fixture: MediaFixture = { ...MEDIA_FIXTURES[0], observed: { ios: "works", "web-firefox": "fails" } };
    await render(<ObservedStatus fixture={fixture} />);

    expect(screen.getByText("iOS works")).toBeTruthy();
    expect(screen.getByText("Firefox fails")).toBeTruthy();
    expect(screen.getByText("Unverified: Android, Chrome, Safari")).toBeTruthy();
  });
});

describe("Media Lab: sections", () => {
  it("lists every image, video and audio fixture in its section", async () => {
    await render(<MediaLabScreen />);

    for (const [sectionId, kind] of [["image", "image"], ["video", "video"], ["audio", "audio"]] as const) {
      const expected = MEDIA_FIXTURES.filter((f) => f.kind === kind);
      for (const fixture of expected) {
        expect(row(sectionId, fixture.id)).toBeTruthy();
      }
    }
  });

  it("shows the pending line for a section with no renderer", async () => {
    await render(<MediaLabScreen />);

    expect(screen.getByText("Component arrives with spec media-image")).toBeTruthy();
    expect(screen.getByText("Component arrives with spec media-video")).toBeTruthy();
    expect(screen.getByText("Component arrives with spec media-audio")).toBeTruthy();
    expect(screen.getByText("Component arrives with spec media-viewer")).toBeTruthy();
  });

  it("replaces only the pending line of the section whose renderer is set", async () => {
    renderers.image = jest.fn(() => null);
    await render(<MediaLabScreen />);

    expect(screen.queryByText("Component arrives with spec media-image")).toBeNull();
    expect(screen.getByText("Component arrives with spec media-video")).toBeTruthy();
  });

  it("filters a section by category, tier and expected errors", async () => {
    await render(<MediaLabScreen />);

    await fireEvent.press(screen.getByTestId("image-category-orientation"));
    expect(row("image", "img-orient-exif6")).toBeTruthy();
    expect(section("image").queryByTestId("fixture-core-landscape")).toBeNull();
    // Another section is untouched.
    expect(row("video", "core-video-landscape")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("image-category-all"));
    await fireEvent.press(screen.getByTestId("image-tier-core"));
    expect(row("image", "core-alpha")).toBeTruthy();
    expect(section("image").queryByTestId("fixture-img-aspect-4x3")).toBeNull();

    await fireEvent.press(screen.getByTestId("image-tier-all"));
    await fireEvent.press(screen.getByTestId("image-errors-errors"));
    expect(row("image", "img-broken-zero")).toBeTruthy();
    expect(section("image").queryByTestId("fixture-img-aspect-4x3")).toBeNull();
  });
});

describe("Media Lab: renderers", () => {
  const lastProps = (renderer: jest.Mock): SectionRendererProps => renderer.mock.calls.at(-1)[0];

  it("hands a renderer only fixtures that can be rendered", async () => {
    const image = jest.fn(() => null);
    renderers.image = image;
    await render(<MediaLabScreen />);
    await settle();

    const { entries, unavailable, section: id } = lastProps(image);
    expect(id).toBe("image");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.availability === "available")).toBe(true);
    expect(entries.every((entry) => entry.fixture.kind === "image")).toBe(true);
    expect(entries.map((entry) => entry.fixture.id)).toContain("img-aspect-4x3");
    expect(entries.map((entry) => entry.fixture.id)).not.toContain("img-aspect-3x1");
    expect(unavailable.map((entry) => entry.fixture.id)).toContain("img-aspect-3x1");
    expect(unavailable.every((entry) => entry.availability !== "available")).toBe(true);
  });

  it("gives the viewer every fixture, and each section's current filter, not only its own list", async () => {
    const viewer = jest.fn(() => null);
    renderers.viewer = viewer;
    await render(<MediaLabScreen />);
    await settle();

    const { entries, allEntries, filtered } = lastProps(viewer);
    // The viewer's own pool leaves the list-scale thumbnails out; allEntries keeps them.
    expect(entries.some((entry) => entry.fixture.category === "scale")).toBe(false);
    expect(allEntries).toHaveLength(MEDIA_FIXTURES.length);
    expect(allEntries.filter((entry) => entry.fixture.category === "scale")).toHaveLength(60);
    expect(filtered.image.every((entry) => entry.availability === "available")).toBe(true);

    // Narrowing the Images section changes `filtered.image` and nothing else.
    const videoBefore = filtered.video.map((entry) => entry.fixture.id);
    await fireEvent.press(screen.getByTestId("image-tier-core"));
    const after = lastProps(viewer).filtered;
    expect(after.image.length).toBeGreaterThan(0);
    expect(after.image.every((entry) => entry.fixture.tier === "core" && entry.fixture.kind === "image")).toBe(true);
    expect(after.video.map((entry) => entry.fixture.id)).toEqual(videoBefore);
  });

  it("passes the playground state to every renderer", async () => {
    const image = jest.fn(() => null);
    const video = jest.fn(() => null);
    renderers.image = image;
    renderers.video = video;
    await render(<MediaLabScreen />);

    expect(lastProps(image).playground).toMatchObject({
      imageFit: "cover",
      imageSizing: "ratio",
      width: "full",
      videoControls: "native",
      loop: false,
    });

    await fireEvent.press(within(screen.getByTestId("playground-sizing")).getByText("Fill"));
    await fireEvent.press(within(screen.getByTestId("playground-width")).getByText("375"));
    await fireEvent.press(within(screen.getByTestId("playground-video-controls")).getByText("Custom"));
    await fireEvent.press(within(screen.getByTestId("playground-audio-variant")).getByText("Full"));
    await fireEvent.press(within(screen.getByTestId("playground-radius")).getByText("LG"));
    await fireEvent.press(within(screen.getByTestId("playground-loop")).getByRole("switch"));

    for (const renderer of [image, video]) {
      expect(lastProps(renderer).playground).toMatchObject({
        imageSizing: "fill",
        width: 375,
        videoControls: "custom",
        audioVariant: "full",
        radius: "lg",
        loop: true,
      });
    }
  });

  it("hands the source kinds to a renderer", async () => {
    const image = jest.fn(() => null);
    renderers.image = image;
    await render(<MediaLabScreen />);

    const kinds = lastProps(image).sourceKinds;
    expect(kinds.map((kind) => kind.id)).toEqual(["bundled", "public", "remote", "data-uri"]);
    // A require()d asset: a module id under Metro, never a string path.
    expect(typeof kinds[0].uri).not.toBe("string");
    expect(kinds[0].uri).not.toBeNull();
    expect(String(kinds[1].uri)).toMatch(/\/media-fixtures\/images\//);
    expect(String(kinds[2].uri)).toMatch(/^https:\/\//);
    expect(String(kinds[3].uri)).toMatch(/^data:image\/png;base64,/);
  });

  it("sizes the stage to the container width preset, centered", async () => {
    await render(<MediaLabScreen />);
    expect(StyleSheet.flatten(screen.getByTestId("media-lab-stage").props.style).maxWidth).toBeUndefined();

    await fireEvent.press(within(screen.getByTestId("playground-width")).getByText("768"));
    expect(StyleSheet.flatten(screen.getByTestId("media-lab-stage").props.style)).toMatchObject({
      maxWidth: 768,
      alignSelf: "center",
    });
  });
});

describe("Media Lab: picking from the library", () => {
  it("shows the picked file in the matching section and passes it to a renderer", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///var/mobile/picked.jpg", type: "image" }],
    });
    const image = jest.fn(() => null);
    renderers.image = image;
    await render(<MediaLabScreen />);

    await fireEvent.press(screen.getByTestId("source-kind-pick"));

    await waitFor(() => expect(section("image").getByText("file:///var/mobile/picked.jpg")).toBeTruthy());
    expect(section("video").queryByTestId("picked-video")).toBeNull();
    const kinds = (image.mock.calls.at(-1) as unknown as [SectionRendererProps])[0].sourceKinds;
    expect(kinds.at(-1)).toEqual({ id: "picked", label: "Picked from library", uri: "file:///var/mobile/picked.jpg" });
  });

  it("leaves the screen alone when the picker is cancelled", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    await render(<MediaLabScreen />);

    await fireEvent.press(screen.getByTestId("source-kind-pick"));

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.queryByTestId("picked-image")).toBeNull();
  });
});
