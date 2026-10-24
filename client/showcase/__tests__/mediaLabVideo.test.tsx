/**
 * The Media Lab's Video section: every video fixture through `Video`, driven
 * by the playground, with at most one player mounted. `expo-video` is the
 * opt-in fake (`test/mocks/expoVideo`) and `expo-image` a `View` that captures
 * its props, so the tests read what each tile asked for and drive the player
 * events a device would send.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

// The lab also renders AudioPlayer, which imports expo-audio: opt in to the fake.
jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

// The app loads `Video` through `LazyVideo`'s `import()`, which Jest cannot run
// (no --experimental-vm-modules): hand the tiles the real `Video` directly.
jest.mock("@/client/components/LazyVideo", () => ({
  LazyVideo: jest.requireActual("@mrmeg/expo-ui/components/Video").Video,
}));

import { VideoSection } from "../MediaLabVideo";
import {
  DEFAULT_PLAYGROUND,
  renderers,
  type LabEntry,
  type PlaygroundState,
  type SectionRendererProps,
} from "../MediaLabScreen";
import { MEDIA_FIXTURES } from "../mediaFixtures";

const hidden = { includeHiddenElements: true } as const;
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const entry = (id: string, uri: string | number | null = `https://lab.test/${id}.mp4`): LabEntry => {
  const fixture = MEDIA_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`no fixture ${id}`);
  return { fixture, availability: "available", uri };
};

const VIDEO_IDS = MEDIA_FIXTURES.filter((fixture) => fixture.kind === "video").map((fixture) => fixture.id);

function section(overrides: Partial<SectionRendererProps> = {}, playground: Partial<PlaygroundState> = {}) {
  return (
    <VideoSection
      section="video"
      entries={[]}
      unavailable={[]}
      allEntries={[]}
      filtered={{ image: [], video: [], audio: [], viewer: [] }}
      playground={{ ...DEFAULT_PLAYGROUND, ...playground }}
      sourceKinds={[]}
      {...overrides}
    />
  );
}

const tile = (id: string) => screen.getByTestId(`video-tile-${id}`);
const load = (id: string) => fireEvent.press(screen.getByTestId(`video-load-${id}`, hidden));
const mounted = () => screen.queryAllByTestId(/^video-.+-view$/, hidden);
const view = (id: string) => screen.getByTestId(`video-${id}-view`, hidden);
const frame = (id: string) => screen.getByTestId(`video-${id}`, hidden);
const player = (id: string) =>
  view(id).props.player as {
    emit: (event: string, payload?: unknown) => void;
    play: jest.Mock;
    loop: boolean;
    muted: boolean;
    isLive: boolean;
    duration: number;
  };

describe("Media Lab: Video renderer", () => {
  it("fills the video slot", () => {
    expect(renderers.video).toBe(VideoSection);
  });

  it("renders every entry as a tile with its label and facts, and mounts no player", async () => {
    await render(section({ entries: [entry("core-video-landscape"), entry("vid-dur-1h05"), entry("vid-tracks-audio-only")] }));

    expect(within(tile("core-video-landscape")).getByText("Landscape video 640x360")).toBeTruthy();
    expect(within(tile("core-video-landscape")).getByText("core · 640×360 · 0:10")).toBeTruthy();
    expect(within(tile("vid-dur-1h05")).getByText("generated · 64×36 · 1:05:00")).toBeTruthy();
    expect(within(tile("vid-tracks-audio-only")).getByText("generated · 0:05")).toBeTruthy();
    expect(mounted()).toHaveLength(0);
  });

  it("says what to run when nothing can be rendered", async () => {
    await render(section({ entries: [] }));

    expect(screen.getByTestId("video-empty")).toBeTruthy();
  });

  it("has a tile for every video fixture in the manifest", async () => {
    await render(section({ entries: VIDEO_IDS.map((id) => entry(id)) }));

    expect(VIDEO_IDS.length).toBeGreaterThan(25);
    for (const id of VIDEO_IDS) expect(tile(id)).toBeTruthy();
    expect(mounted()).toHaveLength(0);
  });

  describe("one player at a time", () => {
    it("mounts a player for the tile that was tapped, with its source", async () => {
      await render(section({ entries: [entry("core-video-landscape"), entry("vid-aspect-1x1")] }));

      await load("vid-aspect-1x1");

      expect(mounted()).toHaveLength(1);
      expect(view("vid-aspect-1x1").props.player.source).toBe("https://lab.test/vid-aspect-1x1.mp4");
      expect(screen.queryByTestId("video-load-vid-aspect-1x1", hidden)).toBeNull();
      expect(screen.getByTestId("video-load-core-video-landscape", hidden)).toBeTruthy();
    });

    it("unmounts the previous player when another tile is tapped, so it stops", async () => {
      await render(section({ entries: [entry("core-video-landscape"), entry("vid-aspect-1x1")] }));
      await load("core-video-landscape");
      const first = player("core-video-landscape");

      await load("vid-aspect-1x1");

      expect(mounted()).toHaveLength(1);
      expect(screen.queryByTestId("video-core-video-landscape-view", hidden)).toBeNull();
      expect(screen.getByTestId("video-load-core-video-landscape", hidden)).toBeTruthy();
      expect((first as unknown as { pause: jest.Mock }).pause).toHaveBeenCalled();
    });

    it("never has more than one mounted across the whole corpus", async () => {
      await render(section({ entries: VIDEO_IDS.map((id) => entry(id)) }));

      for (const id of VIDEO_IDS.slice(0, 8)) {
        await load(id);
        expect(mounted()).toHaveLength(1);
      }
    });

    it("hands a bundled fixture's require() number to the player", async () => {
      await render(section({ entries: [entry("core-video-portrait", 42)] }));

      await load("core-video-portrait");

      expect(view("core-video-portrait").props.player.source).toBe(42);
    });
  });

  describe("playground", () => {
    it.each([
      ["native", true],
      ["custom", false],
      ["none", false],
    ] as const)("controls %s reaches the player", async (controls, nativeControls) => {
      await render(section({ entries: [entry("core-video-landscape")] }, { videoControls: controls }));
      await load("core-video-landscape");

      expect(view("core-video-landscape").props.nativeControls).toBe(nativeControls);
      expect(Boolean(screen.queryByTestId("video-core-video-landscape-chrome", hidden))).toBe(controls === "custom");
    });

    it("fit reaches the player", async () => {
      await render(section({ entries: [entry("core-video-landscape")] }, { videoFit: "cover" }));
      await load("core-video-landscape");

      expect(view("core-video-landscape").props.contentFit).toBe("cover");
    });

    it("autoplay and muted start the player muted; with it off nothing starts", async () => {
      const { rerender } = await render(section({ entries: [entry("core-video-landscape")] }, { autoplayMuted: true }));
      await load("core-video-landscape");
      expect(player("core-video-landscape")).toEqual(expect.objectContaining({ muted: true }));
      expect(player("core-video-landscape").play).toHaveBeenCalledTimes(1);

      await rerender(section({ entries: [entry("vid-aspect-1x1")] }, { autoplayMuted: false }));
      await load("vid-aspect-1x1");
      expect(player("vid-aspect-1x1").muted).toBe(false);
      expect(player("vid-aspect-1x1").play).not.toHaveBeenCalled();
    });

    it("loop reaches the player", async () => {
      await render(section({ entries: [entry("vid-dur-loop-2s")] }, { loop: true }));
      await load("vid-dur-loop-2s");

      expect(player("vid-dur-loop-2s").loop).toBe(true);
    });

    it("rebuilds the player when a creation-time option changes, and keeps it for the rest", async () => {
      const entries = [entry("core-video-landscape")];
      const { rerender } = await render(section({ entries }, { videoControls: "native", loop: false }));
      await load("core-video-landscape");
      const first = view("core-video-landscape").props.player;

      await rerender(section({ entries }, { videoControls: "native", loop: false, videoFit: "cover" }));
      expect(view("core-video-landscape").props.player).toBe(first);

      await rerender(section({ entries }, { videoControls: "custom", loop: false }));
      expect(view("core-video-landscape").props.player).not.toBe(first);
      expect(mounted()).toHaveLength(1);

      const second = view("core-video-landscape").props.player;
      await rerender(section({ entries }, { videoControls: "custom", loop: true }));
      expect(view("core-video-landscape").props.player).not.toBe(second);
    });

    describe("poster", () => {
      it("is the clip's own jpg on a core fixture, and a stand-in frame on the others, before any tap", async () => {
        await render(section({ entries: [entry("core-video-landscape"), entry("vid-aspect-1x1")] }, { poster: true }));

        for (const id of ["core-video-landscape", "vid-aspect-1x1"]) {
          expect(within(screen.getByTestId(`video-placeholder-${id}`, hidden)).getByTestId("expo-image", hidden)).toBeTruthy();
        }
      });

      it("reaches the player when it is on, and is left out when it is off", async () => {
        const { rerender } = await render(section({ entries: [entry("core-video-landscape")] }, { poster: true }));
        await load("core-video-landscape");
        expect(screen.getByTestId("video-core-video-landscape-poster", hidden)).toBeTruthy();

        await rerender(section({ entries: [entry("core-video-landscape")] }, { poster: false }));
        expect(screen.queryByTestId("video-core-video-landscape-poster", hidden)).toBeNull();
        expect(screen.queryByTestId("expo-image", hidden)).toBeNull();
      });
    });

    it("radius and max height reach the frame", async () => {
      await render(section({ entries: [entry("core-video-portrait")] }, { radius: "lg", maxHeight: true }));
      await load("core-video-portrait");
      await act(async () => {
        player("core-video-portrait").emit("videoTrackChange", { videoTrack: { size: { width: 360, height: 640 } } });
      });

      expect(flat(frame("core-video-portrait")).borderRadius).toBe(14);
      expect(flat(frame("core-video-portrait")).maxWidth).toBeCloseTo(160 * (360 / 640));
    });
  });

  describe("sizing", () => {
    it("draws the placeholder at the manifest ratio, 16:9 where it has none, and a rotation-flagged clip as portrait", async () => {
      await render(
        section({
          entries: [entry("core-video-landscape"), entry("vid-aspect-1x1"), entry("vid-tracks-audio-only"), entry("vid-rotate-90")],
        }),
      );

      const ratio = (id: string) => flat(screen.getByTestId(`video-placeholder-${id}`, hidden)).aspectRatio;
      expect(ratio("core-video-landscape")).toBeCloseTo(16 / 9);
      expect(ratio("vid-aspect-1x1")).toBeCloseTo(1);
      expect(ratio("vid-tracks-audio-only")).toBeCloseTo(16 / 9);
      expect(ratio("vid-rotate-90")).toBeCloseTo(360 / 640);
      expect(within(tile("vid-rotate-90")).getByText(/640×360 stored, must show 360×640/)).toBeTruthy();
    });

    it("draws a mounted tile at auto: 16:9 until the video reports its size, then at that size", async () => {
      await render(section({ entries: [entry("vid-rotate-90")] }));
      await load("vid-rotate-90");
      expect(flat(frame("vid-rotate-90")).aspectRatio).toBeCloseTo(16 / 9);

      await act(async () => {
        player("vid-rotate-90").emit("videoTrackChange", { videoTrack: { size: { width: 360, height: 640 } } });
      });

      expect(flat(frame("vid-rotate-90")).aspectRatio).toBeCloseTo(360 / 640);
    });

    it("prints the frame it ended up with, so a wrong orientation is visible", async () => {
      await render(section({ entries: [entry("vid-rotate-90")] }));
      await load("vid-rotate-90");

      await act(async () => {
        screen.getByTestId("video-active-vid-rotate-90", hidden).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } } });
      });
      expect(screen.getByTestId("video-frame-vid-rotate-90", hidden).props.children).toBe("Frame 360×640 (portrait)");

      await act(async () => {
        screen.getByTestId("video-active-vid-rotate-90", hidden).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 640, height: 360 } } });
      });
      expect(screen.getByTestId("video-frame-vid-rotate-90", hidden).props.children).toBe("Frame 640×360 (landscape)");
    });
  });

  describe("fixtures that must be handled", () => {
    it("an entry that expects an error reaches the error state, with a retry and no crash", async () => {
      await render(section({ entries: [entry("vid-broken-truncated"), entry("vid-broken-zero"), entry("vid-broken-text")] }));
      expect(within(tile("vid-broken-truncated")).getByText("expects error")).toBeTruthy();

      for (const id of ["vid-broken-truncated", "vid-broken-zero", "vid-broken-text"]) {
        await load(id);
        await act(async () => {
          player(id).emit("statusChange", { status: "error", error: { message: "decode failed" } });
        });

        expect(screen.getByTestId(`video-${id}-error`, hidden)).toBeTruthy();
        expect(screen.getByTestId(`video-${id}-retry`, hidden)).toBeTruthy();
      }
    });

    it("a live stream reads Live under custom controls", async () => {
      await render(section({ entries: [entry("remote-live-hls-akamai", "https://lab.test/live.m3u8")] }, { videoControls: "custom" }));
      await load("remote-live-hls-akamai");
      player("remote-live-hls-akamai").isLive = true;
      player("remote-live-hls-akamai").duration = Number.POSITIVE_INFINITY;

      await act(async () => {
        player("remote-live-hls-akamai").emit("timeUpdate", { currentTime: 100, bufferedPosition: 0 });
      });

      expect(screen.getByTestId("video-remote-live-hls-akamai-time", hidden).props.children).toBe("Live");
    });

    it("a stream with subtitle tracks offers the captions toggle", async () => {
      await render(section({ entries: [entry("remote-hls-mux-subtitles", "https://lab.test/subs.m3u8")] }, { videoControls: "custom" }));
      await load("remote-hls-mux-subtitles");

      await act(async () => {
        player("remote-hls-mux-subtitles").emit("availableSubtitleTracksChange", {
          availableSubtitleTracks: [{ language: "en", label: "English" }],
        });
      });

      expect(screen.getByTestId("video-remote-hls-mux-subtitles-captions", hidden)).toBeTruthy();
    });
  });
});
