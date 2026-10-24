/**
 * The Media Lab's Audio section: every audio fixture through `AudioPlayer`,
 * driven by the playground's variant. `expo-audio` is the opt-in fake and
 * `expo-image` a `View`, so the tests read what each tile asked the player for.
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as expoAudio from "@/test/mocks/expoAudio";
import type { FakeAudioPlayer } from "@/test/mocks/expoAudio";

jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

import { AudioSection } from "../MediaLabAudio";
import {
  DEFAULT_PLAYGROUND,
  renderers,
  type LabEntry,
  type PlaygroundState,
  type SectionRendererProps,
} from "../MediaLabScreen";
import { MEDIA_FIXTURES } from "../mediaFixtures";

const entry = (id: string, uri: string | number | null = `https://lab.test/${id}.mp3`): LabEntry => {
  const fixture = MEDIA_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`no fixture ${id}`);
  return { fixture, availability: "available", uri };
};

function section(overrides: Partial<SectionRendererProps> = {}, playground: Partial<PlaygroundState> = {}) {
  return (
    <AudioSection
      section="audio"
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

let useAudioPlayerSpy: jest.SpyInstance;
beforeEach(() => {
  useAudioPlayerSpy = jest.spyOn(expoAudio, "useAudioPlayer");
});

/** The players the section created, by the source each was given. */
const playerFor = (source: string): FakeAudioPlayer =>
  useAudioPlayerSpy.mock.results.map((result) => result.value as FakeAudioPlayer).find((player) => player.source === source) as FakeAudioPlayer;

const tile = (id: string) => within(screen.getByTestId(`audio-tile-${id}`));

describe("Media Lab: Audio renderer", () => {
  it("fills the audio slot", () => {
    expect(renderers.audio).toBe(AudioSection);
  });

  it("renders every audio fixture through AudioPlayer, labelled and described", async () => {
    const audio = MEDIA_FIXTURES.filter((fixture) => fixture.kind === "audio" && fixture.tier !== "remote");
    await render(section({ entries: audio.map((fixture) => entry(fixture.id)) }));

    for (const fixture of audio) {
      expect(screen.getByTestId(`audio-${fixture.id}`)).toBeTruthy();
      expect(tile(fixture.id).getByText(fixture.label)).toBeTruthy();
      expect(useAudioPlayerSpy).toHaveBeenCalledWith(`https://lab.test/${fixture.id}.mp3`, expect.anything());
    }
    expect(audio.length).toBeGreaterThanOrEqual(16);
  });

  it("describes a fixture's tier, category and length, with h:mm:ss past an hour", async () => {
    await render(section({ entries: [entry("aud-dur-1h05"), entry("aud-fmt-mp3-cbr")] }));

    expect(tile("aud-dur-1h05").getByText("generated · duration · 1:05:00")).toBeTruthy();
    expect(tile("aud-fmt-mp3-cbr").getByText("generated · format · 0:10")).toBeTruthy();
  });

  it("hands each player the bundled core file as a require() id", async () => {
    await render(section({ entries: [entry("core-tone", 7)] }));

    expect(useAudioPlayerSpy).toHaveBeenCalledWith(7, expect.anything());
  });

  describe("playground", () => {
    it("draws compact players for the compact variant", async () => {
      await render(section({ entries: [entry("core-tone")] }, { audioVariant: "compact" }));

      expect(screen.getByTestId("audio-core-tone-time", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByTestId("audio-core-tone-elapsed", { includeHiddenElements: true })).toBeNull();
    });

    it("draws full players, with the bundled artwork, for the full variant", async () => {
      await render(section({ entries: [entry("core-tone")] }, { audioVariant: "full" }));

      expect(screen.getByTestId("audio-core-tone-elapsed", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByTestId("audio-core-tone-title", { includeHiddenElements: true }).props.children).toBe("Tone M4A");
      expect(screen.getByTestId("expo-image", { includeHiddenElements: true })).toBeTruthy();
    });

    it("hands the loop switch to every player", async () => {
      await render(section({ entries: [entry("core-tone"), entry("aud-fmt-wav")] }, { loop: true }));

      expect(playerFor("https://lab.test/core-tone.mp3").loop).toBe(true);
      expect(playerFor("https://lab.test/aud-fmt-wav.mp3").loop).toBe(true);
    });
  });

  describe("what to look for", () => {
    it("says the ID3 cover art is the artwork prop, not the embedded cover", async () => {
      await render(section({ entries: [entry("aud-meta-id3-cover")] }, { audioVariant: "full" }));

      expect(screen.getByTestId("audio-note-aud-meta-id3-cover").props.children).toMatch(/artwork prop/);
      expect(screen.getByTestId("audio-note-aud-meta-id3-cover").props.children).toMatch(/not read/);
    });

    it("tells WebM Opus apart as the format most likely to fail on iOS", async () => {
      await render(section({ entries: [entry("aud-fmt-webm-opus")] }));

      expect(screen.getByTestId("audio-note-aud-fmt-webm-opus").props.children).toMatch(/iOS/);
    });
  });

  describe("expected errors", () => {
    it("says what a broken file is expected to do, then that it did", async () => {
      await render(section({ entries: [entry("aud-broken-text")] }));
      const outcome = () => screen.getByTestId("audio-outcome-aud-broken-text").props.children;
      expect(outcome()).toMatch(/Expects the error state/);

      await act(async () =>
        playerFor("https://lab.test/aud-broken-text.mp3").emit("playbackStatusUpdate", { error: "decode failed", isLoaded: false }),
      );

      expect(outcome()).toBe("Reached the error state: decode failed");
      expect(screen.getByText("Audio unavailable")).toBeTruthy();
    });

    it("leaves a fixture that is not expected to fail without an outcome line", async () => {
      await render(section({ entries: [entry("aud-fmt-wav")] }));

      expect(screen.queryByTestId("audio-outcome-aud-fmt-wav")).toBeNull();
    });
  });

  describe("remote streams", () => {
    const LIVE = "remote-live-mp3-bbc";
    const STREAM = "https://stream.example/live";

    it("waits for a tap before creating a player, so a live stream is not opened on every visit", async () => {
      await render(section({ entries: [entry(LIVE, STREAM), entry("aud-fmt-wav")] }));

      expect(screen.queryByTestId(`audio-${LIVE}`)).toBeNull();
      expect(useAudioPlayerSpy).toHaveBeenCalledTimes(1);
      expect(useAudioPlayerSpy).not.toHaveBeenCalledWith(STREAM, expect.anything());

      await act(async () => void fireEvent.press(screen.getByTestId(`audio-load-${LIVE}`)));

      expect(screen.getByTestId(`audio-${LIVE}`)).toBeTruthy();
      expect(useAudioPlayerSpy).toHaveBeenCalledWith(STREAM, expect.anything());
      expect(screen.queryByTestId(`audio-load-${LIVE}`)).toBeNull();
    });

    it("says to expect Live and a disabled scrubber", async () => {
      await render(section({ entries: [entry(LIVE, STREAM)] }));

      expect(screen.getByTestId(`audio-note-${LIVE}`).props.children).toMatch(/Live/);
    });
  });

  it("says what to run when nothing can be rendered", async () => {
    await render(section({ entries: [] }));

    expect(screen.getByTestId("audio-empty")).toBeTruthy();
  });
});
