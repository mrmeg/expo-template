/**
 * Carousel tests — web platform.
 *
 * react-native-web drops `snapToInterval`/`snapToAlignment` (they aren't in its
 * forwarded-prop list), so web snapping has to come from CSS scroll-snap
 * instead. These assertions pin that: `scroll-snap-type` on the scroller,
 * `scroll-snap-align` on each slide, and `scroll-padding-left` matching
 * `contentPadding` so page `i` still lands on `i * (itemWidth + gap)` — the
 * same offset `getCarouselIndex` decodes.
 *
 * They also pin the web half of the index wiring: RNW emits no momentum
 * events, so throttled `onScroll` ticks are the only channel that can keep the
 * dots live for wheel/trackpad scrolling (native uses momentum/drag end
 * instead — see `Carousel.test.tsx`).
 *
 * `./forceWebPlatform` must be the first import so `Platform.OS` is already
 * "web" when Carousel (and its transitive constants) resolve.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Carousel } from "../Carousel";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { dark: false, colors: { accent: "#111111", border: "#222222" } },
  }),
}));

// `Platform.OS = "web"` sends the real hook down its `window.addEventListener`
// branch, which the native-flavored Jest environment has no DOM for. The seeded
// width isn't what these assertions are about.
jest.mock("../../hooks/useDimensions", () => ({
  useDimensions: () => ({
    width: 1280,
    height: 800,
    orientation: "landscape",
    isSmallScreen: false,
    isMediumScreen: false,
    isLargeScreen: true,
  }),
}));

function flatten(style: unknown) {
  // `snap={false}` passes no style at all, and flatten(undefined) is undefined.
  return (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
}

function slides(count: number) {
  return Array.from({ length: count }).map((_, i) => (
    <View key={`slide-${i}`}>
      <Text>{`Slide ${i + 1}`}</Text>
    </View>
  ));
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

describe("Carousel (web)", () => {
  it("puts CSS scroll-snap on the scroller and each slide", async () => {
    await render(<Carousel contentPadding={24}>{slides(3)}</Carousel>);

    const scroller = flatten(screen.getByTestId("carousel-scroll").props.style);
    expect(scroller.scrollSnapType).toBe("x mandatory");
    // Keeps the leading inset when the browser snaps slide 0 to the
    // scrollport start.
    expect(scroller.scrollPaddingLeft).toBe(24);

    expect(flatten(screen.getByTestId("carousel-item-0").props.style).scrollSnapAlign).toBe("start");
    expect(flatten(screen.getByTestId("carousel-item-2").props.style).scrollSnapAlign).toBe("start");
  });

  it("omits the CSS snap styles when snap is disabled", async () => {
    await render(<Carousel snap={false}>{slides(3)}</Carousel>);

    expect(flatten(screen.getByTestId("carousel-scroll").props.style).scrollSnapType).toBeUndefined();
    expect(
      flatten(screen.getByTestId("carousel-item-0").props.style).scrollSnapAlign,
    ).toBeUndefined();
  });

  it("still renders every slide (the SSR content contract)", async () => {
    await render(<Carousel>{slides(4)}</Carousel>);

    for (let i = 1; i <= 4; i++) {
      expect(screen.getByText(`Slide ${i}`)).toBeTruthy();
    }
  });

  it("tracks the index from throttled scroll ticks, not momentum events", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(4)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    const scroll = screen.getByTestId("carousel-scroll");

    // RNW delivers a single event unless the throttle is > 0.
    expect(scroll.props.scrollEventThrottle).toBe(16);
    expect(scroll.props.onMomentumScrollEnd).toBeUndefined();
    expect(scroll.props.onScrollEndDrag).toBeUndefined();

    // pitch = 300
    await fireEvent(scroll, "scroll", scrollEvent(300));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    // Host-level only: jest renders through RN's mocks even under a forced
    // web Platform, and RN normalizes `aria-selected` into accessibilityState
    // on the host. Whether the attribute reaches the real DOM is only
    // observable in a browser (react-native-web maps the aria-* prop, never
    // accessibilityState).
    expect(screen.getByTestId("carousel-dot-1").props.accessibilityState.selected).toBe(true);
  });

  it("reports one page change per page, not per scroll tick", async () => {
    const onIndexChange = jest.fn();
    await render(
      <Carousel itemWidth={280} gap={20} onIndexChange={onIndexChange}>
        {slides(4)}
      </Carousel>,
    );

    await fireEvent(screen.getByTestId("carousel"), "layout", layoutEvent(400));
    const scroll = screen.getByTestId("carousel-scroll");

    for (const x of [40, 120, 220, 280, 300]) {
      await fireEvent(scroll, "scroll", scrollEvent(x));
    }

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
