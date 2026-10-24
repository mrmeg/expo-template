/**
 * Image on web. `./forceWebPlatform` first, see that file.
 *
 * What this covers: the branches `Image` itself takes when `Platform.OS` is
 * "web". Jest still resolves `expo-image`'s native view here, so it is
 * replaced by a `View` that captures props: the DOM `<img>` (its `alt`, its
 * `fetchpriority`) is `expo-image`'s own, and is checked against the built
 * site instead (see the media-image PR).
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { Image } from "../Image";

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

// Under the forced web platform the native SVG renderer would be handed a CSS
// variable color; the icon is not what this file checks.
jest.mock("../Icon", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Icon: ({ name }: { name: string }) => createElement(View, { testID: `icon-${name}` }),
    // `test/setup.ts` registers the app's icons through this module.
    registerIcons: () => {},
  };
});

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
const frame = () => screen.getByTestId("frame", { includeHiddenElements: true });
const picture = () => screen.getByTestId("expo-image", { includeHiddenElements: true });

const URI = "https://example.com/a.jpg";

describe("Image (web)", () => {
  it("passes alt to expo-image as accessibilityLabel, which becomes the <img>'s alt", async () => {
    await render(<Image source={URI} alt="A tabby cat" testID="frame" />);

    expect(picture().props.accessibilityLabel).toBe("A tabby cat");
  });

  it("gives a decorative image an empty alt, the standard way to say 'skip this'", async () => {
    await render(<Image source={URI} alt="" testID="frame" />);

    expect(picture().props.accessibilityLabel).toBe("");
  });

  it("names the frame as an image for react-native-web to emit role=img and aria-label", async () => {
    await render(<Image source={URI} alt="A tabby cat" testID="frame" />);

    expect(frame().props).toEqual(
      expect.objectContaining({ accessibilityRole: "image", accessibilityLabel: "A tabby cat" }),
    );
    expect(frame().props).not.toHaveProperty("aria-hidden");
  });

  it("hides a decorative frame with aria-hidden", async () => {
    await render(<Image source={URI} alt="" testID="frame" />);

    expect(frame().props["aria-hidden"]).toBe(true);
    expect(frame().props.accessible).toBe(false);
    expect(frame().props).not.toHaveProperty("accessibilityRole");
  });

  it("renders the sized frame before anything loads, so a server render carries the final box", async () => {
    await render(<Image source={URI} alt="A tabby cat" testID="frame" aspectRatio="16:9" maxHeight={200} radius="md" />);

    const style = flat(frame());
    expect(style).toEqual(expect.objectContaining({ width: "100%", alignSelf: "center", overflow: "hidden", borderRadius: 10 }));
    expect(style.aspectRatio).toBeCloseTo(16 / 9);
    expect(style.maxWidth).toBeCloseTo(200 * (16 / 9));
    expect(style.backgroundColor).toBeDefined();
  });

  it("forwards priority to expo-image, which sets fetchpriority on the <img>", async () => {
    await render(<Image source={URI} alt="Hero" priority="high" />);

    expect(picture().props.priority).toBe("high");
  });

  it("reaches the error state and clears it on a new source, as on native", async () => {
    const { rerender } = await render(<Image source={URI} alt="A tabby cat" testID="frame" />);
    await act(async () => {
      picture().props.onError({ error: "Failed to load image from url: " + URI });
    });
    expect(screen.queryByTestId("icon-image-off", { includeHiddenElements: true })).not.toBeNull();

    await rerender(<Image source="https://example.com/b.jpg" alt="A tabby cat" testID="frame" />);
    expect(screen.queryByTestId("icon-image-off", { includeHiddenElements: true })).toBeNull();
  });
});
