/**
 * `LazyVideo`: the frame the server and the hydration pass render while the
 * `Video` chunk is not there, which must be laid out like the player that
 * replaces it. (Jest cannot run the real `import()`, so the live path is the
 * showcase's: see `lazyGallery.test.tsx` for the same gate.)
 */
import React from "react";
import { Text } from "react-native";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

const mockHydrated = { value: false };
jest.mock("@mrmeg/expo-ui/hooks/useHydrated", () => ({
  useHydrated: () => mockHydrated.value,
}));

import { LazyVideo } from "../LazyVideo";

const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
const frame = () => screen.getByTestId("clip-loading-frame", { includeHiddenElements: true });

afterEach(() => {
  mockHydrated.value = false;
});

describe("LazyVideo before the chunk and hydration", () => {
  it("renders a black frame at the video's own ratio", async () => {
    await render(<LazyVideo source="x.mp4" aspectRatio={{ width: 360, height: 640 }} testID="clip" />);

    expect(flat(frame())).toEqual(expect.objectContaining({ backgroundColor: "#000000", width: "100%", alignSelf: "center" }));
    expect(flat(frame()).aspectRatio).toBeCloseTo(360 / 640);
  });

  it("draws auto, and a ratio it cannot parse, at 16:9, like Video does until it knows better", async () => {
    const { rerender } = await render(<LazyVideo source="x.mp4" aspectRatio="auto" testID="clip" />);
    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);

    await rerender(<LazyVideo source="x.mp4" aspectRatio={"wide" as unknown as "16:9"} testID="clip" />);
    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);

    await rerender(<LazyVideo source="x.mp4" testID="clip" />);
    expect(flat(frame()).aspectRatio).toBeCloseTo(16 / 9);
  });

  it("caps the height through the width, fills a positioned parent, and takes the caller's style", async () => {
    const { rerender } = await render(<LazyVideo source="x.mp4" aspectRatio="9:16" maxHeight={320} style={{ marginTop: 8 }} testID="clip" />);
    expect(flat(frame()).maxWidth).toBeCloseTo(320 * (9 / 16));
    expect(flat(frame()).marginTop).toBe(8);

    await rerender(<LazyVideo source="x.mp4" fill testID="clip" />);
    expect(flat(frame())).toEqual(expect.objectContaining({ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }));
  });

  it("renders the caller's fallback instead when given one", async () => {
    await render(<LazyVideo source="x.mp4" fallback={<Text>soon</Text>} testID="clip" />);

    expect(screen.getByText("soon")).toBeTruthy();
    expect(screen.queryByTestId("clip-loading-frame", { includeHiddenElements: true })).toBeNull();
  });
});
