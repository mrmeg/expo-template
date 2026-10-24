/**
 * AudioPlayer on web. `./forceWebPlatform` first, see that file.
 *
 * What this covers: the server and hydration shell (no player until hydrated,
 * because expo-audio's web player builds an `HTMLAudioElement`, which a server
 * does not have), and the keyboard shortcuts. `expo-audio` is the opt-in fake;
 * the `<audio>` element itself is checked in a browser (see the media-audio PR).
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as expoAudio from "@/test/mocks/expoAudio";
import { createAudioPlayer, type FakeAudioPlayer, type FakeAudioStatus } from "@/test/mocks/expoAudio";
import { AudioPlayer, type AudioPlayerProps } from "../AudioPlayer";

jest.mock("expo-audio", () => require("@/test/mocks/expoAudio"));
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

// Under the forced web platform the native SVG renderer would be handed a CSS
// variable color; the icons are not what this file checks.
jest.mock("../Icon", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Icon: ({ name }: { name: string }) => createElement(View, { testID: `icon-${name}` }),
    // `test/setup.ts` registers the app's icons through this module.
    registerIcons: () => {},
  };
});

const mockHydrated = { value: false };
jest.mock("../../hooks/useHydrated", () => ({ useHydrated: () => mockHydrated.value }));

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const SOURCE = "https://example.com/a.mp3";

let useAudioPlayerSpy: jest.SpyInstance;
beforeEach(() => {
  mockHydrated.value = false;
  useAudioPlayerSpy = jest.spyOn(expoAudio, "useAudioPlayer");
});

const created = (): FakeAudioPlayer => useAudioPlayerSpy.mock.results.at(-1)?.value as FakeAudioPlayer;
const emit = (player: FakeAudioPlayer, status: Partial<FakeAudioStatus>) =>
  act(async () => player.emit("playbackStatusUpdate", status));

const root = () => screen.getByTestId("player");
const playButton = () => screen.getByTestId("player-play");
const isDisabled = (el: TestInstance) => el.props.accessibilityState?.disabled === true;
const textOf = (testID: string) => screen.getByTestId(testID, { includeHiddenElements: true }).props.children;

/** Every `player-*` test id in the tree: the structure the server HTML carries. */
const testIds = () =>
  screen.root!
    .queryAll((node) => typeof node.props.testID === "string" && node.props.testID.startsWith("player"))
    .map((node) => node.props.testID as string)
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort();

const FULL: Partial<AudioPlayerProps> = {
  variant: "full",
  title: "Episode 12",
  subtitle: "The Show",
  artwork: "https://example.com/c.jpg",
  showMute: true,
};

describe("AudioPlayer (web): the shell before hydration", () => {
  it("renders the layout without creating a player", async () => {
    await render(<AudioPlayer source={SOURCE} testID="player" />);

    expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    expect(isDisabled(playButton())).toBe(true);
    expect(textOf("player-time")).toBe("--:--");
    expect(screen.getByRole("adjustable").props.accessibilityState).toEqual({ disabled: true });
  });

  it("does the same for the full layout", async () => {
    await render(<AudioPlayer source={SOURCE} testID="player" {...FULL} />);

    expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    expect(isDisabled(playButton())).toBe(true);
    expect(textOf("player-title")).toBe("Episode 12");
    expect(textOf("player-elapsed")).toBe("--:--");
    expect(textOf("player-remaining")).toBe("--:--");
    expect(isDisabled(screen.getByTestId("player-speed"))).toBe(true);
    expect(isDisabled(screen.getByTestId("player-mute"))).toBe(true);
  });

  it("sets no keyboard handler yet: there is nothing to control", async () => {
    await render(<AudioPlayer source={SOURCE} testID="player" />);

    expect(root().props.focusable).toBeUndefined();
    expect(root().props.onKeyDown).toBeUndefined();
  });

  it.each([
    ["compact", {}],
    ["full", FULL],
  ] as const)("draws the same tree as the live %s player, so the first client frame matches the server HTML", async (_name, props) => {
    const { rerender } = await render(<AudioPlayer source={SOURCE} testID="player" {...props} />);
    const shell = { ids: testIds(), style: flat(root()), role: root().props.role, label: root().props["aria-label"] };

    mockHydrated.value = true;
    await rerender(<AudioPlayer source={SOURCE} testID="player" {...props} />);

    expect(useAudioPlayerSpy).toHaveBeenCalledTimes(1);
    expect(testIds()).toEqual(shell.ids);
    expect(flat(root())).toEqual(shell.style);
    expect(root().props.role).toBe(shell.role);
    expect(root().props["aria-label"]).toBe(shell.label);
  });

  it("creates the player once hydrated, and enables the controls", async () => {
    const { rerender } = await render(<AudioPlayer source={SOURCE} testID="player" />);
    expect(useAudioPlayerSpy).not.toHaveBeenCalled();

    mockHydrated.value = true;
    await rerender(<AudioPlayer source={SOURCE} testID="player" />);

    expect(useAudioPlayerSpy).toHaveBeenCalledTimes(1);
    expect(useAudioPlayerSpy).toHaveBeenCalledWith(SOURCE, expect.anything());
    expect(isDisabled(playButton())).toBe(false);
    expect(root().props.focusable).toBe(true);
  });

  it("mounts at once for a player the caller passed, because it already exists", async () => {
    const own = createAudioPlayer();
    await render(<AudioPlayer player={own as never} testID="player" />);

    expect(useAudioPlayerSpy).not.toHaveBeenCalled();
    expect(isDisabled(playButton())).toBe(false);
  });

  it("a missing source shows the unavailable state in the shell, and never creates a player", async () => {
    const onError = jest.fn();
    mockHydrated.value = true;
    await render(<AudioPlayer source={null} onError={onError} testID="player" />);

    expect(screen.getByText("Audio unavailable")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(useAudioPlayerSpy).not.toHaveBeenCalled();
  });
});

describe("AudioPlayer (web): keyboard", () => {
  const keydown = (key: string, extra: Record<string, unknown> = {}) => ({ key, preventDefault: jest.fn(), ...extra });
  const send = async (event: ReturnType<typeof keydown>) => {
    await act(async () => void root().props.onKeyDown(event));
    return event;
  };

  async function mount(props: Partial<AudioPlayerProps> = {}) {
    mockHydrated.value = true;
    await render(<AudioPlayer source={SOURCE} testID="player" {...props} />);
    const player = created();
    await emit(player, { isLoaded: true, duration: 100, currentTime: 30 });
    return player;
  }

  it("makes the root focusable and labels it as a group", async () => {
    await mount({ title: "Episode 12" });

    expect(root().props.focusable).toBe(true);
    expect(root().props.role).toBe("group");
    expect(root().props["aria-label"]).toBe("Episode 12");
  });

  it("labels an untitled player", async () => {
    await mount();

    expect(root().props["aria-label"]).toBe("Audio player");
  });

  it.each([" ", "k", "K"])("%j plays and pauses", async (key) => {
    const player = await mount();

    const event = await send(keydown(key));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);

    await emit(player, { playing: true });
    await send(keydown(key));
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it("ArrowRight and ArrowLeft seek 5 seconds, within the clip", async () => {
    const player = await mount();

    const right = await send(keydown("ArrowRight"));
    expect(player.seekTo).toHaveBeenLastCalledWith(35);
    expect(right.preventDefault).toHaveBeenCalledTimes(1);

    await emit(player, { currentTime: 35 });
    await send(keydown("ArrowLeft"));
    expect(player.seekTo).toHaveBeenLastCalledWith(30);

    await emit(player, { currentTime: 3 });
    await send(keydown("ArrowLeft"));
    expect(player.seekTo).toHaveBeenLastCalledWith(0);

    await emit(player, { currentTime: 98 });
    await send(keydown("ArrowRight"));
    expect(player.seekTo).toHaveBeenLastCalledWith(100);
  });

  it("M mutes with showMute, and the icon follows", async () => {
    const player = await mount({ showMute: true });

    await send(keydown("m"));
    expect(player.muted).toBe(true);
    expect(screen.getByTestId("icon-volume-x")).toBeTruthy();

    await send(keydown("M"));
    expect(player.muted).toBe(false);
  });

  it("M mutes without a mute button too (there is just no icon to show it)", async () => {
    const player = await mount();

    const event = await send(keydown("m"));

    expect(player.muted).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("player-mute")).toBeNull();
  });

  it("does not seek a live stream, which has no length", async () => {
    const player = await mount();
    await emit(player, { isLive: true, duration: 0 });

    const event = await send(keydown("ArrowRight"));

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    // It still plays and pauses.
    await send(keydown("k"));
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("ignores every key once the file has failed to load", async () => {
    const player = await mount({ showMute: true });
    await emit(player, { error: "Cannot decode", isLoaded: false });

    const event = await send(keydown(" "));
    await send(keydown("ArrowRight"));
    await send(keydown("m"));

    expect(player.play).not.toHaveBeenCalled();
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.muted).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("passes through other keys, modified keys, and Space aimed at a button inside", async () => {
    const player = await mount();

    const tab = await send(keydown("Tab"));
    const meta = await send(keydown("k", { metaKey: true }));
    const onButton = await send(
      keydown(" ", { target: { closest: () => ({}) }, currentTarget: { not: "the target" } }),
    );

    expect(player.play).not.toHaveBeenCalled();
    for (const event of [tab, meta, onButton]) expect(event.preventDefault).not.toHaveBeenCalled();
  });

  describe("focus ring", () => {
    const focusEvent = (target: unknown, currentTarget: unknown) => ({
      nativeEvent: { target: { matches: () => true } },
      target,
      currentTarget,
    });
    const ring = () => flat(root()).boxShadow;

    it("shows on the root when the root itself takes keyboard focus", async () => {
      await mount();
      const self = {};

      await act(async () => root().props.onFocus(focusEvent(self, self)));
      expect(ring()).toEqual(expect.stringContaining("0 0 0"));

      await act(async () => root().props.onBlur({}));
      expect(ring()).toBeUndefined();
    });

    it("stays off when focus bubbles up from a control inside, which draws its own ring", async () => {
      await mount();

      await act(async () => root().props.onFocus(focusEvent({ inner: true }, { root: true })));

      expect(ring()).toBeUndefined();
    });
  });
});
