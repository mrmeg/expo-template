/**
 * Image: frame sizing, load and error states, accessibility and the props it
 * hands `expo-image`. iOS is the jest-expo default; web has its own file.
 *
 * `expo-image` is replaced by a `View` that receives every prop, so a test
 * reads what the component passed and calls `onLoad` / `onError` as the native
 * view would.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { rawThemeColors } from "../../constants/colors";
import { Image } from "../Image";
import * as componentsBarrel from "../index";

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

let mockReducedMotion = false;
jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const frame = () => screen.getByTestId("frame", { includeHiddenElements: true });
const picture = () => screen.getByTestId("expo-image", { includeHiddenElements: true });
const maybePicture = () => screen.queryByTestId("expo-image", { includeHiddenElements: true });
const errorIcon = () => screen.queryByTestId("icon-image-off", { includeHiddenElements: true });

const URI = "https://example.com/a.jpg";
const loadEvent = (width: number, height: number) => ({
  cacheType: "none",
  source: { url: URI, width, height, mediaType: "image/jpeg" },
});

const load = (width = 1600, height = 900) =>
  act(async () => {
    picture().props.onLoad(loadEvent(width, height));
  });
const fail = (message = "boom") =>
  act(async () => {
    picture().props.onError({ error: message });
  });
const layOut = (width: number, height: number) =>
  act(async () => {
    screen.getByTestId("frame-error", { includeHiddenElements: true }).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    });
  });

const MUTED = rawThemeColors.light.muted;
const MUTED_FOREGROUND = rawThemeColors.light.mutedForeground;

beforeEach(() => {
  mockReducedMotion = false;
});

describe("Image: frame sizing", () => {
  it("sizes nothing without a ratio, fill or caller style: the caller owns the box", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);

    const style = flat(frame());
    expect(style).not.toHaveProperty("width");
    expect(style).not.toHaveProperty("height");
    expect(style).not.toHaveProperty("aspectRatio");
    expect(style.overflow).toBe("hidden");
  });

  it("applies the caller's width, height and margins to the frame", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" style={[{ width: 96, height: 64 }, { margin: 8 }]} />);

    expect(flat(frame())).toEqual(expect.objectContaining({ width: 96, height: 64, margin: 8 }));
  });

  it("lets the caller's width win over the ratio's full width", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="1:1" style={{ width: 120 }} />);

    expect(flat(frame())).toEqual(expect.objectContaining({ width: 120, aspectRatio: 1 }));
  });

  it.each<[string, React.ComponentProps<typeof Image>["aspectRatio"], number]>([
    ["a number", 1.5, 1.5],
    ["a 'w:h' string", "16:9", 16 / 9],
    ["a { width, height } pair", { width: 1080, height: 1920 }, 0.5625],
  ])("draws full width at %s", async (_label, aspectRatio, expected) => {
    await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio={aspectRatio} />);

    expect(flat(frame())).toEqual(
      expect.objectContaining({ width: "100%", aspectRatio: expected, alignSelf: "center" }),
    );
  });

  it("clamps the width with maxWidth, centered", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="16:9" maxWidth={300} />);

    expect(flat(frame())).toEqual(expect.objectContaining({ maxWidth: 300, alignSelf: "center" }));
  });

  it("turns maxHeight into a width cap of maxHeight * ratio", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="16:9" maxHeight={200} />);

    expect(flat(frame()).maxWidth).toBeCloseTo(200 * (16 / 9));
  });

  it("takes the narrower of maxWidth and maxHeight * ratio", async () => {
    const { rerender } = await render(
      <Image source={URI} alt="Cat" testID="frame" aspectRatio="16:9" maxWidth={240} maxHeight={200} />,
    );
    expect(flat(frame()).maxWidth).toBe(240);

    await rerender(<Image source={URI} alt="Cat" testID="frame" aspectRatio="16:9" maxWidth={600} maxHeight={200} />);
    expect(flat(frame()).maxWidth).toBeCloseTo(200 * (16 / 9));
  });

  it("caps a plain frame with maxHeight when there is no ratio", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" maxHeight={120} />);

    expect(flat(frame())).toEqual(expect.objectContaining({ maxHeight: 120 }));
  });

  it("fill absolutely fills the parent and wins over aspectRatio", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" fill aspectRatio="16:9" />);

    const style = flat(frame());
    expect(style).toEqual(expect.objectContaining({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }));
    expect(style).not.toHaveProperty("aspectRatio");
  });

  it("falls back for a ratio that does not parse, so a typo cannot collapse the frame", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio={"wide" as never} fallbackAspectRatio={2} />);

    expect(flat(frame()).aspectRatio).toBe(2);
  });

  describe("aspectRatio='auto'", () => {
    it("starts at fallbackAspectRatio, 1 by default", async () => {
      const { rerender } = await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" />);
      expect(flat(frame()).aspectRatio).toBe(1);

      await rerender(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" fallbackAspectRatio={4 / 3} />);
      expect(flat(frame()).aspectRatio).toBeCloseTo(4 / 3);
    });

    it("switches to the natural ratio after onLoad, once", async () => {
      await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" />);

      await load(1600, 900);
      expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);

      await load(900, 1600);
      expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
    });

    it("still clamps with maxHeight at the natural ratio", async () => {
      await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" maxHeight={100} />);

      await load(200, 400);
      expect(flat(frame())).toEqual(expect.objectContaining({ aspectRatio: 0.5, maxWidth: 50 }));
    });

    it("ignores an unusable natural size", async () => {
      await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" fallbackAspectRatio={2} />);

      await load(0, 0);

      expect(flat(frame()).aspectRatio).toBe(2);
    });

    it("is not moved by onLoad when the ratio is explicit", async () => {
      await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="4:3" />);

      await load(1600, 900);

      expect(flat(frame()).aspectRatio).toBeCloseTo(4 / 3);
    });

    it("keeps an earlier load when the author switches to auto afterwards", async () => {
      const { rerender } = await render(<Image source={URI} alt="Cat" testID="frame" aspectRatio="4:3" />);
      await load(1600, 900);

      await rerender(<Image source={URI} alt="Cat" testID="frame" aspectRatio="auto" />);

      expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
    });
  });
});

describe("Image: radius", () => {
  it("defaults to none, on the frame and the image", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);

    expect(flat(frame()).borderRadius).toBe(0);
    expect(flat(picture()).borderRadius).toBe(0);
  });

  it.each([
    ["xs", 4],
    ["sm", 8],
    ["md", 10],
    ["lg", 14],
    ["xl", 18],
    ["2xl", 24],
    ["full", 9999],
  ] as const)("radius %s is %i on the frame and on the image", async (radius, value) => {
    await render(<Image source={URI} alt="Cat" testID="frame" radius={radius} />);

    expect(flat(frame()).borderRadius).toBe(value);
    expect(flat(picture()).borderRadius).toBe(value);
  });

  it("insets the image over the whole frame, with an explicit size for react-native-web", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);

    expect(flat(picture())).toEqual(
      expect.objectContaining({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }),
    );
  });
});

describe("Image: loading, loaded and error states", () => {
  it("paints the muted surface while loading", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);

    expect(flat(frame()).backgroundColor).toBe(MUTED);
    expect(errorIcon()).toBeNull();
  });

  it("goes transparent once loaded, so a transparent image shows what is behind it", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);

    await load();

    expect(flat(frame())).not.toHaveProperty("backgroundColor");
    expect(maybePicture()).not.toBeNull();
  });

  it("reports the natural size from onLoad", async () => {
    const onLoad = jest.fn();
    await render(<Image source={URI} alt="Cat" testID="frame" onLoad={onLoad} />);

    await load(800, 450);

    expect(onLoad).toHaveBeenCalledWith({ width: 800, height: 450 });
  });

  it("hands the muted surface back when a new source starts loading", async () => {
    const { rerender } = await render(<Image source={URI} alt="Cat" testID="frame" />);
    await load();
    expect(flat(frame())).not.toHaveProperty("backgroundColor");

    await rerender(<Image source="https://example.com/b.jpg" alt="Cat" testID="frame" />);

    expect(flat(frame()).backgroundColor).toBe(MUTED);
  });

  it("shows the default image-off icon on a failed load, over the muted frame", async () => {
    const onError = jest.fn();
    await render(<Image source={URI} alt="Cat" testID="frame" onError={onError} />);

    await fail("404");

    expect(onError).toHaveBeenCalledWith({ error: "404" });
    expect(errorIcon()).not.toBeNull();
    expect(errorIcon()?.props.color).toBe(MUTED_FOREGROUND);
    expect(flat(frame()).backgroundColor).toBe(MUTED);
    expect(maybePicture()).toBeNull();
  });

  it("draws the error icon at 24 pt until the frame says it is small", async () => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);
    await fail();

    expect(flat(errorIcon() as TestInstance)).toEqual(expect.objectContaining({ width: 24, height: 24 }));
  });

  it.each([
    [47, 47, 16],
    [48, 48, 24],
    [200, 40, 16],
    [320, 180, 24],
  ])("a %i x %i frame draws a %i pt error icon", async (width, height, size) => {
    await render(<Image source={URI} alt="Cat" testID="frame" />);
    await fail();

    await layOut(width, height);

    expect(flat(errorIcon() as TestInstance)).toEqual(expect.objectContaining({ width: size, height: size }));
  });

  it("replaces the default state with a custom fallback", async () => {
    const { Text } = require("react-native");
    await render(<Image source={URI} alt="Cat" testID="frame" fallback={<Text testID="custom">No photo</Text>} />);

    await fail();

    expect(screen.getByTestId("custom", { includeHiddenElements: true })).toBeTruthy();
    expect(errorIcon()).toBeNull();
  });

  it("clears the error when the source changes", async () => {
    const { rerender } = await render(<Image source={URI} alt="Cat" testID="frame" />);
    await fail();
    expect(errorIcon()).not.toBeNull();

    await rerender(<Image source="https://example.com/b.jpg" alt="Cat" testID="frame" />);

    expect(errorIcon()).toBeNull();
    expect(maybePicture()).not.toBeNull();
  });

  it("keeps the error across renders of the same source, even as a fresh object", async () => {
    const { rerender } = await render(
      <Image source={{ uri: URI, cacheKey: "k" }} alt="Cat" testID="frame" />,
    );
    await fail();

    await rerender(<Image source={{ uri: URI, cacheKey: "k" }} alt="Cat" testID="frame" />);
    await rerender(<Image source={{ uri: URI, cacheKey: "k" }} alt="Cat" testID="frame" />);

    expect(errorIcon()).not.toBeNull();
    expect(maybePicture()).toBeNull();
  });

  it("a different cacheKey is a different source", async () => {
    const { rerender } = await render(<Image source={{ uri: URI, cacheKey: "one" }} alt="Cat" testID="frame" />);
    await fail();

    await rerender(<Image source={{ uri: URI, cacheKey: "two" }} alt="Cat" testID="frame" />);

    expect(errorIcon()).toBeNull();
  });

  it("keeps a null source in its loading look: nothing failed", async () => {
    const onError = jest.fn();
    await render(<Image source={null} alt="Cat" testID="frame" onError={onError} />);

    expect(flat(frame()).backgroundColor).toBe(MUTED);
    expect(errorIcon()).toBeNull();
    expect(picture().props.source).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("Image: alt", () => {
  it("names a described image: accessible, role image, label alt", async () => {
    await render(<Image source={URI} alt="A tabby cat" testID="frame" />);

    expect(frame().props).toEqual(
      expect.objectContaining({ accessible: true, accessibilityRole: "image", accessibilityLabel: "A tabby cat" }),
    );
    expect(screen.getByRole("image", { name: "A tabby cat" })).toBeTruthy();
  });

  it("hides a decorative image from assistive tech", async () => {
    await render(<Image source={URI} alt="" testID="frame" />);

    expect(frame().props).toEqual(
      expect.objectContaining({ accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true }),
    );
    expect(frame().props).not.toHaveProperty("accessibilityLabel");
    expect(screen.queryByRole("image")).toBeNull();
  });

  it("does not give the inner image a label natively: the frame is the one accessible element", async () => {
    await render(<Image source={URI} alt="A tabby cat" testID="frame" />);

    expect(picture().props.accessibilityLabel).toBeUndefined();
  });

  it("treats a blank alt as decorative", async () => {
    await render(<Image source={URI} alt="   " testID="frame" />);

    expect(frame().props.accessible).toBe(false);
  });

  describe("a JS caller that omits alt", () => {
    // Jest restores spies after every test (`restoreMocks`), so spy per test.
    let warn: jest.SpyInstance;
    const globalWithDev = globalThis as unknown as { __DEV__: boolean };
    const originalDev = globalWithDev.__DEV__;

    beforeEach(() => {
      warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      globalWithDev.__DEV__ = originalDev;
    });

    it("warns once in development, however often it re-renders, and treats the image as decorative", async () => {
      globalWithDev.__DEV__ = true;
      const { rerender } = await render(<Image source={URI} alt={undefined as never} testID="frame" />);
      await rerender(<Image source={URI} alt={undefined as never} testID="frame" />);
      await rerender(<Image source="https://example.com/b.jpg" alt={undefined as never} testID="frame" />);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("`alt` is required");
      expect(frame().props.accessible).toBe(false);
    });

    it("stays quiet outside development", async () => {
      globalWithDev.__DEV__ = false;
      await render(<Image source={URI} alt={undefined as never} testID="frame" />);

      expect(warn).not.toHaveBeenCalled();
    });

    it("stays quiet for an empty alt", async () => {
      globalWithDev.__DEV__ = true;
      await render(<Image source={URI} alt="" testID="frame" />);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe("Image: motion", () => {
  it("cross-dissolves for 200 ms by default", async () => {
    await render(<Image source={URI} alt="Cat" />);

    expect(picture().props.transition).toBe(200);
  });

  it("passes a custom transition through", async () => {
    await render(<Image source={URI} alt="Cat" transition={350} />);

    expect(picture().props.transition).toBe(350);
  });

  it("forces the transition to 0 under reduced motion", async () => {
    mockReducedMotion = true;
    const { rerender } = await render(<Image source={URI} alt="Cat" transition={350} />);
    expect(picture().props.transition).toBe(0);

    await rerender(<Image source={URI} alt="Cat" />);
    expect(picture().props.transition).toBe(0);
  });
});

describe("Image: what reaches expo-image", () => {
  it("defaults to fit cover at the center", async () => {
    await render(<Image source={URI} alt="Cat" />);

    expect(picture().props).toEqual(
      expect.objectContaining({ contentFit: "cover", contentPosition: "center", placeholderContentFit: "cover" }),
    );
  });

  it.each(["cover", "contain", "fill", "none", "scale-down"] as const)("passes fit %s through", async (fit) => {
    await render(<Image source={URI} alt="Cat" fit={fit} />);

    expect(picture().props.contentFit).toBe(fit);
    expect(picture().props.placeholderContentFit).toBe(fit);
  });

  it("passes position through, string or object", async () => {
    const { rerender } = await render(<Image source={URI} alt="Cat" position="top" />);
    expect(picture().props.contentPosition).toBe("top");

    await rerender(<Image source={URI} alt="Cat" position={{ top: "20%", left: 0 }} />);
    expect(picture().props.contentPosition).toEqual({ top: "20%", left: 0 });
  });

  it("lets placeholderFit differ from fit", async () => {
    await render(<Image source={URI} alt="Cat" fit="cover" placeholderFit="scale-down" />);

    expect(picture().props.placeholderContentFit).toBe("scale-down");
  });

  it("passes the source through untouched, cacheKey and all", async () => {
    const source = { uri: URI, cacheKey: "uploads/cat.jpg" };
    await render(<Image source={source} alt="Cat" />);

    expect(picture().props.source).toBe(source);
  });

  it("passes a source array and a bundled asset through", async () => {
    const sources = [
      { uri: "https://example.com/400.jpg", width: 400, height: 225 },
      { uri: "https://example.com/800.jpg", width: 800, height: 450 },
    ];
    const { rerender } = await render(<Image source={sources} alt="Cat" />);
    expect(picture().props.source).toBe(sources);

    await rerender(<Image source={7} alt="Cat" />);
    expect(picture().props.source).toBe(7);
  });

  it("passes priority, cachePolicy and recyclingKey through", async () => {
    await render(<Image source={URI} alt="Cat" priority="high" cachePolicy="memory-disk" recyclingKey="item-7" />);

    expect(picture().props).toEqual(
      expect.objectContaining({ priority: "high", cachePolicy: "memory-disk", recyclingKey: "item-7" }),
    );
  });

  describe("placeholder", () => {
    it("hands a bare blurhash over as a blurhash, not a URL", async () => {
      await render(<Image source={URI} alt="Cat" placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4" />);

      expect(picture().props.placeholder).toEqual({ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" });
    });

    it("keeps the scheme of a blurhash:/ or thumbhash:/ string", async () => {
      const { rerender } = await render(<Image source={URI} alt="Cat" placeholder="blurhash:/L6PZfSi_.AyE/32/32" />);
      expect(picture().props.placeholder).toEqual({ blurhash: "blurhash:/L6PZfSi_.AyE/32/32" });

      await rerender(<Image source={URI} alt="Cat" placeholder="thumbhash:/3OcRJYB4d3h/iIeHeEh3eIhw+j2w" />);
      expect(picture().props.placeholder).toEqual({ thumbhash: "thumbhash:/3OcRJYB4d3h/iIeHeEh3eIhw+j2w" });
    });

    it.each(["https://example.com/tiny.jpg", "/media/tiny.jpg", "file:///tmp/tiny.jpg", "data:image/png;base64,AAAA"])(
      "treats %s as a low-resolution source",
      async (uri) => {
        await render(<Image source={URI} alt="Cat" placeholder={uri} />);

        expect(picture().props.placeholder).toEqual({ uri });
      },
    );

    it("passes a source object through", async () => {
      const placeholder = { uri: "https://example.com/tiny.jpg", width: 16, height: 9 };
      await render(<Image source={URI} alt="Cat" placeholder={placeholder} />);

      expect(picture().props.placeholder).toBe(placeholder);
    });

    it("passes nothing when there is no placeholder", async () => {
      await render(<Image source={URI} alt="Cat" />);

      expect(picture().props.placeholder).toBeUndefined();
    });
  });
});

describe("Image: packaging", () => {
  it("stays out of the components barrel (subpath-only)", () => {
    expect(componentsBarrel).not.toHaveProperty("Image");
  });
});
