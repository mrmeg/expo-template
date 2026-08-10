/**
 * Carousel tests.
 *
 * Three concerns:
 *   - `getCarouselIndex` / `resolveCarouselItemWidth`: the pure math that turns
 *     a scroll offset + measured width into an active page (clamping is what
 *     keeps overscroll from reporting a page that doesn't exist).
 *   - Render smoke with N children: every slide must be in the tree, because
 *     that's the SSR contract this component exists to preserve.
 *   - `onIndexChange` firing exactly once per settle from simulated
 *     scroll/momentum events.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Carousel, getCarouselIndex, resolveCarouselItemWidth } from "../Carousel";

// Sentinel tokens so the dot assertions name the token, not a palette value.
// Mocking `../../hooks/useTheme` (not the `@mrmeg/expo-ui/hooks` barrel) is what
// reaches Carousel's own import.
const ACCENT = "#111111";
const BORDER = "#222222";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { dark: false, colors: { accent: "#111111", border: "#222222" } },
  }),
}));

function backgroundColorOf(testID: string) {
  const value = flatten(screen.getByTestId(testID).props.style).backgroundColor;
  return typeof value === "string" ? value.toLowerCase() : value;
}

function scrollEvent(x: number, layoutWidth = 400) {
  return {
    nativeEvent: {
      contentOffset: { x, y: 0 },
      contentSize: { width: layoutWidth * 4, height: 200 },
      layoutMeasurement: { width: layoutWidth, height: 200 },
    },
  };
}

function layoutEvent(width: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height: 200 } } };
}

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

function slides(count: number) {
  return Array.from({ length: count }).map((_, i) => (
    <View key={`slide-${i}`}>
      <Text>{`Slide ${i + 1}`}</Text>
    </View>
  ));
}

describe("getCarouselIndex", () => {
  it("rounds the offset to the nearest slide pitch", () => {
    expect(getCarouselIndex(0, 100, 5)).toBe(0);
    expect(getCarouselIndex(49, 100, 5)).toBe(0);
    expect(getCarouselIndex(50, 100, 5)).toBe(1);
    expect(getCarouselIndex(100, 100, 5)).toBe(1);
    expect(getCarouselIndex(250, 100, 5)).toBe(3);
  });

  it("clamps negative (rubber-band) offsets to the first slide", () => {
    expect(getCarouselIndex(-120, 100, 5)).toBe(0);
  });

  it("clamps past-the-end offsets to the last slide", () => {
    expect(getCarouselIndex(9999, 100, 5)).toBe(4);
  });

  it("returns 0 for a degenerate interval or an empty carousel", () => {
    expect(getCarouselIndex(300, 0, 5)).toBe(0);
    expect(getCarouselIndex(300, -10, 5)).toBe(0);
    expect(getCarouselIndex(300, 100, 0)).toBe(0);
    expect(getCarouselIndex(Number.NaN, 100, 5)).toBe(0);
  });

  it("uses the real pitch (item width + gap), not the item width alone", () => {
    // 340px card + 16px gap: page 2 starts at 712, not 680.
    expect(getCarouselIndex(712, 356, 4)).toBe(2);
  });
});

describe("resolveCarouselItemWidth", () => {
  it("treats values <= 1 as a fraction of the container", () => {
    expect(resolveCarouselItemWidth(0.85, 400)).toBe(340);
    expect(resolveCarouselItemWidth(1, 400)).toBe(400);
  });

  it("treats values > 1 as absolute pixels, ignoring the container", () => {
    expect(resolveCarouselItemWidth(280, 400)).toBe(280);
    expect(resolveCarouselItemWidth(280, 0)).toBe(280);
  });

  it("returns 0 when neither the fraction nor the container can produce a width", () => {
    expect(resolveCarouselItemWidth(0.85, 0)).toBe(0);
    expect(resolveCarouselItemWidth(0, 400)).toBe(0);
    expect(resolveCarouselItemWidth(-1, 400)).toBe(0);
  });
});

describe("Carousel — render", () => {
  it("renders every child as a slide (all content in the tree, no virtualization)", async () => {
    await render(<Carousel>{slides(5)}</Carousel>);

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Slide ${i}`)).toBeTruthy();
    }
    expect(screen.getByTestId("carousel-item-0")).toBeTruthy();
    expect(screen.getByTestId("carousel-item-4")).toBeTruthy();
  });

  it("renders one dot per slide with the accent on the active one", async () => {
    await render(<Carousel>{slides(3)}</Carousel>);

    expect(screen.getByTestId("carousel-dots")).toBeTruthy();
    expect(backgroundColorOf("carousel-dot-0")).toBe(ACCENT);
    expect(backgroundColorOf("carousel-dot-1")).toBe(BORDER);
    expect(backgroundColorOf("carousel-dot-2")).toBe(BORDER);
  });

  it("hides the dots when showDots is false", async () => {
    await render(<Carousel showDots={false}>{slides(3)}</Carousel>);
    expect(screen.queryByTestId("carousel-dots")).toBeNull();
  });

  it("hides the dots for a single slide even with showDots default", async () => {
    await render(<Carousel>{slides(1)}</Carousel>);

    expect(screen.getByText("Slide 1")).toBeTruthy();
    expect(screen.queryByTestId("carousel-dots")).toBeNull();
  });

  it("renders nothing but the container for no children", async () => {
    await render(<Carousel>{null}</Carousel>);

    expect(screen.getByTestId("carousel")).toBeTruthy();
    expect(screen.queryByTestId("carousel-item-0")).toBeNull();
    expect(screen.queryByTestId("carousel-dots")).toBeNull();
  });

  it("announces the page as 'N of total' in a live region", async () => {
    await render(<Carousel>{slides(5)}</Carousel>);
    expect(screen.getByText("1 of 5")).toBeTruthy();
  });

  it("labels each dot for screen readers and marks the active one selected", async () => {
    await render(<Carousel>{slides(3)}</Carousel>);

    const dot = screen.getByTestId("carousel-dot-1");
    expect(dot.props.accessibilityLabel).toBe("Slide 2 of 3");
    expect(dot.props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId("carousel-dot-0").props.accessibilityState.selected).toBe(true);
  });

  it("sizes slides from the measured container width by default (0.85 → peek)", async () => {
    await render(<Carousel>{slides(3)}</Carousel>);

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));

    expect(flatten(screen.getByTestId("carousel-item-0").props.style).width).toBe(340);
  });

  it("uses an absolute itemWidth verbatim", async () => {
    await render(<Carousel itemWidth={280}>{slides(3)}</Carousel>);

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));

    expect(flatten(screen.getByTestId("carousel-item-0").props.style).width).toBe(280);
  });

  it("derives the native snap interval from item width + gap", async () => {
    await render(
      <Carousel itemWidth={280} gap={20}>
        {slides(3)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));

    expect(screen.getByTestId("carousel-scroll").props.snapToInterval).toBe(300);
  });

  it("drops the snap interval when snap is disabled", async () => {
    await render(
      <Carousel itemWidth={280} snap={false}>
        {slides(3)}
      </Carousel>,
    );

    const scroll = screen.getByTestId("carousel-scroll");
    expect(scroll.props.snapToInterval).toBeUndefined();
    expect(scroll.props.decelerationRate).toBe("normal");
  });

  it("starts on initialIndex", async () => {
    await render(<Carousel initialIndex={2}>{slides(4)}</Carousel>);

    expect(screen.getByText("3 of 4")).toBeTruthy();
    expect(screen.getByTestId("carousel-dot-2").props.accessibilityState.selected).toBe(true);
  });

  it("clamps an out-of-range initialIndex", async () => {
    await render(<Carousel initialIndex={99}>{slides(3)}</Carousel>);
    expect(screen.getByText("3 of 3")).toBeTruthy();
  });

  it("applies the content padding and gap to the scroll row", async () => {
    await render(
      <Carousel contentPadding={12} gap={10}>
        {slides(3)}
      </Carousel>,
    );

    const content = flatten(screen.getByTestId("carousel-scroll").props.contentContainerStyle);
    expect(content.paddingHorizontal).toBe(12);
    expect(content.gap).toBe(10);
  });
});

describe("Carousel — index tracking", () => {
  it("fires onIndexChange on momentum end with the settled page", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(4)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    // pitch = 280 + 20 = 300
    await fireEvent(screen.getByTestId("carousel-scroll"), "momentumScrollEnd", scrollEvent(600));

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("3 of 4")).toBeTruthy();
    expect(screen.getByTestId("carousel-dot-2").props.accessibilityState.selected).toBe(true);
  });

  it("updates the dots from plain scroll ticks (web wheel/trackpad has no momentum event)", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(4)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    await fireEvent(screen.getByTestId("carousel-scroll"), "scroll", scrollEvent(300));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("carousel-dot-1").props.accessibilityState.selected).toBe(true);
  });

  it("fires once per page, not once per scroll event", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(4)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    const scroll = screen.getByTestId("carousel-scroll");

    // A single drag from page 0 to page 1: many ticks, one page change.
    for (const x of [40, 120, 220, 280, 300]) {
      await fireEvent(scroll, "scroll", scrollEvent(x));
    }
    await fireEvent(scroll, "momentumScrollEnd", scrollEvent(300));

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("does not report a page past the end when overscrolled", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(3)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    await fireEvent(screen.getByTestId("carousel-scroll"), "scroll", scrollEvent(5000));

    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("3 of 3")).toBeTruthy();
  });

  it("does not fire when scrolling back to the page it started on", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(3)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    await fireEvent(screen.getByTestId("carousel-scroll"), "scroll", scrollEvent(20));

    expect(onIndexChange).not.toHaveBeenCalled();
  });
});
