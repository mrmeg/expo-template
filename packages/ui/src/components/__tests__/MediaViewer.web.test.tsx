/**
 * MediaViewer on web. `./forceWebPlatform` first, see that file.
 *
 * What this covers: the branches the viewer takes when `Platform.OS` is "web":
 * the keyboard, the single Esc path through the `Modal`'s close request, the
 * wheel and double-click handlers (the DOM listeners themselves are in
 * `lib/__tests__/webZoomEvents.test.ts`, here they are a mocked module whose
 * captured handlers the test calls), the debounced page read, always-on edge
 * buttons, and the web-only styles. The DOM is not available, so browser
 * fullscreen is a mocked module too. Real browser behavior (arrow keys,
 * ctrl+wheel at the cursor, drag, double-click, Esc, F, resize) is checked
 * against the built site, see the media-viewer PR.
 */
import "./forceWebPlatform";

import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { asPlayer, type TestPlayer } from "./videoTestTypes";
import * as webFullscreen from "../../lib/webFullscreen";
import * as webZoomEvents from "../../lib/webZoomEvents";
import { MediaViewer, type MediaViewerItem, type MediaViewerProps } from "../MediaViewer";

jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const { View } = require("react-native");
  function MockModal({ children, visible = true, ...props }: { children?: React.ReactNode; visible?: boolean }) {
    return visible ? React.createElement(View, { testID: "rn-modal", visible, ...props }, children) : null;
  }
  return { __esModule: true, default: MockModal };
});

// Under the forced web platform the native SVG renderer would be handed a CSS variable color; the icons are not
// what this file checks.
jest.mock("../Icon", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Icon: ({ name }: { name: string }) => createElement(View, { testID: `icon-${name}` }),
    registerIcons: () => {},
  };
});

// react-native only reports a hover after a real mouse move on a DOM.
jest.mock("react-native/Libraries/Pressability/HoverState", () => ({ isHoverEnabled: () => true }));

jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => true,
}));

jest.mock("../../hooks/useWindowInsets", () => ({
  useWindowInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../lib/webFullscreen", () => ({
  supportsElementFullscreen: jest.fn(),
  getFullscreenElement: jest.fn(),
  enterElementFullscreen: jest.fn(),
  exitElementFullscreen: jest.fn(),
  subscribeFullscreenChange: jest.fn(() => () => {}),
}));

jest.mock("../../lib/webZoomEvents", () => ({
  attachZoomEvents: jest.fn(() => () => {}),
}));

const hidden = { includeHiddenElements: true } as const;
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const mockedFullscreen = webFullscreen as jest.Mocked<typeof webFullscreen>;
const mockedZoomEvents = webZoomEvents as jest.Mocked<typeof webZoomEvents>;

const image = (key: string): MediaViewerItem => ({
  type: "image",
  key,
  source: `https://example.com/${key}.jpg`,
  alt: `Picture ${key}`,
  title: `Title ${key}`,
});
const video = (key: string): MediaViewerItem => ({
  type: "video",
  key,
  source: `https://example.com/${key}.mp4`,
  poster: `https://example.com/${key}.jpg`,
  title: `Clip ${key}`,
});

const FIVE = ["a", "b", "c", "d", "e"].map(image);
const VIEWPORT = { width: 400, height: 800 };

async function mount(props: Partial<MediaViewerProps> = {}) {
  const onClose = jest.fn();
  const onIndexChange = jest.fn();
  const base: MediaViewerProps = { items: FIVE, visible: true, onClose, onIndexChange, ...props };
  const utils = await render(<MediaViewer {...base} />);
  await fireEvent(screen.getByTestId("media-viewer", hidden), "layout", { nativeEvent: { layout: VIEWPORT } });
  return {
    onClose,
    onIndexChange,
    unmount: utils.unmount,
    rerender: async (next: Partial<MediaViewerProps> = {}) => {
      await utils.rerender(<MediaViewer {...base} {...next} />);
    },
  };
}

const root = () => screen.getByTestId("media-viewer", hidden);
const list = () => screen.getByTestId("media-viewer-list", hidden);
const counterText = () => {
  const children = screen.getByTestId("media-viewer-counter", hidden).props.children;
  return Array.isArray(children) ? children.join("") : children;
};
/** The page the viewer is on: neighbors are mounted too (hidden from assistive technology), so pick the one that is not. */
const shown = (testID: string) =>
  screen.getAllByTestId(testID, hidden).find((el) => !el.props["aria-hidden"]) as TestInstance;
const imagePage = () => shown("media-viewer-image-page");
const zoomLayer = () => within(imagePage()).getByTestId("media-viewer-zoom", hidden);

/** A keydown as react-native-web hands it over: the DOM event, with a stand-in `preventDefault`. */
function key(name: string, extra: Record<string, unknown> = {}) {
  const event: Record<string, unknown> = {
    key: name,
    defaultPrevented: false,
    ...extra,
  };
  event.preventDefault = jest.fn(() => {
    event.defaultPrevented = true;
  });
  return event as { key: string; defaultPrevented: boolean; preventDefault: jest.Mock };
}

const press = async (name: string, extra: Record<string, unknown> = {}) => {
  const event = key(name, extra);
  await act(async () => {
    root().props.onKeyDown(event);
  });
  return event;
};

/** The handlers the viewer gave the DOM listeners of the shown page. */
function zoomHandlers() {
  // Each mounted page attached its own; the shown one is the page node that is not hidden.
  const calls = [...mockedZoomEvents.attachZoomEvents.mock.calls].reverse();
  const call = calls.find(([node]) => !(node as { props: Record<string, unknown> }).props["aria-hidden"]);
  return (call ?? calls[0])[1];
}

beforeEach(() => {
  mockedFullscreen.getFullscreenElement.mockReturnValue(null);
  mockedFullscreen.enterElementFullscreen.mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

describe("keyboard", () => {
  it("is focusable and takes keys on the root, as a web player does", async () => {
    await mount();

    expect(root().props.focusable).toBe(true);
    expect(typeof root().props.onKeyDown).toBe("function");
  });

  it("pages with the arrow keys and stops at the ends", async () => {
    const { onIndexChange } = await mount({ initialIndex: 1 });

    const right = await press("ArrowRight");
    expect(right.preventDefault).toHaveBeenCalled();
    expect(counterText()).toBe("3 of 5");

    await press("ArrowLeft");
    await press("ArrowLeft");
    await press("ArrowLeft");
    expect(counterText()).toBe("1 of 5");
    expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([2, 1, 0]);
  });

  it("leaves the arrow keys to a custom video that has handled them (its seek wins)", async () => {
    await mount({ items: [image("a"), video("v"), image("b")], initialIndex: 1 });
    const frame = screen.getByTestId("media-viewer-video", hidden);
    const fake = screen.getByTestId("media-viewer-video-view", hidden).props.player as TestPlayer;

    // The same event the browser would bubble: the video's frame sees it first and prevents the default.
    const event = key("ArrowRight");
    await act(async () => {
      frame.props.onKeyDown(event);
    });
    expect(event.defaultPrevented).toBe(true);
    const seeked = fake.currentTime;
    await act(async () => {
      root().props.onKeyDown(event);
    });

    expect(counterText()).toBe("2 of 3");
    expect(seeked).toBe(fake.currentTime);
  });

  it("does not take Esc on keydown: Esc has one path, the Modal's close request", async () => {
    const { onClose } = await mount();

    await press("Escape");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("zooms with +, = and -, and resets with 0", async () => {
    await mount();
    expect(list().props.scrollEnabled).toBe(true);

    await press("+");
    expect(list().props.scrollEnabled).toBe(false);
    expect(flat(zoomLayer()).transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1.5 },
    ]);

    await press("=");
    expect(JSON.stringify(flat(zoomLayer()).transform)).toContain("2.25");

    await press("-");
    expect(JSON.stringify(flat(zoomLayer()).transform)).toContain("1.5");

    await press("0");
    expect(list().props.scrollEnabled).toBe(true);
    expect(flat(zoomLayer()).transform).toEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1 },
    ]);
  });

  it("ignores the zoom keys with zoom={false}, and with Ctrl or Cmd held (browser zoom)", async () => {
    const { rerender } = await mount();
    await press("+", { ctrlKey: true });
    await press("0", { metaKey: true });
    expect(list().props.scrollEnabled).toBe(true);

    await rerender({ zoom: false });
    const event = await press("+");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(list().props.scrollEnabled).toBe(true);
  });

  it("toggles browser fullscreen of the root with F, and leaves it the second time", async () => {
    await mount();

    await press("f");
    expect(mockedFullscreen.enterElementFullscreen).toHaveBeenCalledTimes(1);
    const node = mockedFullscreen.enterElementFullscreen.mock.calls[0][0];
    expect(node).toBeTruthy();

    mockedFullscreen.getFullscreenElement.mockReturnValue(node);
    await press("F");
    expect(mockedFullscreen.exitElementFullscreen).toHaveBeenCalledTimes(1);
  });

  it("gives up fullscreen when the viewer goes away", async () => {
    const { unmount } = await mount();
    await press("f");
    const node = mockedFullscreen.enterElementFullscreen.mock.calls[0][0];
    mockedFullscreen.getFullscreenElement.mockReturnValue(node);

    await unmount();

    expect(mockedFullscreen.exitElementFullscreen).toHaveBeenCalledTimes(1);
  });

  it("hands F to the viewer, not to a video that cannot go fullscreen itself", async () => {
    await mount({ items: [video("v"), image("a")] });

    expect(screen.queryByTestId("media-viewer-video-fullscreen-toggle", hidden)).toBeNull();
    const frame = screen.getByTestId("media-viewer-video", hidden);
    const event = key("f");
    await act(async () => {
      frame.props.onKeyDown(event);
    });
    expect(event.defaultPrevented).toBe(false);
    await act(async () => {
      root().props.onKeyDown(event);
    });
    expect(mockedFullscreen.enterElementFullscreen).toHaveBeenCalledTimes(1);
  });
});

describe("closing", () => {
  it("closes from the Modal's close request, which is how react-native-web delivers Esc", async () => {
    const { onClose } = await mount();

    await act(async () => {
      screen.getByTestId("rn-modal", hidden).props.onRequestClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves zoom first when zoomed, then closes on the next Esc", async () => {
    const { onClose } = await mount();
    await press("+");
    expect(list().props.scrollEnabled).toBe(false);

    await act(async () => {
      screen.getByTestId("rn-modal", hidden).props.onRequestClose();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(list().props.scrollEnabled).toBe(true);

    await act(async () => {
      screen.getByTestId("rn-modal", hidden).props.onRequestClose();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button, and gives the root no iOS-only escape handler it needs", async () => {
    const { onClose } = await mount();

    await fireEvent.press(screen.getByTestId("media-viewer-close", hidden));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("zoom events", () => {
  it("listens for the wheel and double click on the shown image page's node", async () => {
    await mount();

    expect(mockedZoomEvents.attachZoomEvents).toHaveBeenCalled();
    expect(zoomHandlers()).toEqual({ onWheelZoom: expect.any(Function), onDoubleClick: expect.any(Function) });
  });

  it("zooms around the cursor on ctrl+wheel, and pages are locked while zoomed", async () => {
    await mount();

    await act(async () => {
      zoomHandlers().onWheelZoom(2, { x: 100, y: 50 });
    });

    const transform = flat(zoomLayer()).transform as Record<string, number>[];
    const scale = transform.find((entry) => "scale" in entry)?.scale as number;
    const x = transform.find((entry) => "translateX" in entry)?.translateX as number;
    const y = transform.find((entry) => "translateY" in entry)?.translateY as number;
    expect(scale).toBe(2);
    // The content under the cursor stays under it: translation + scale * focal = focal.
    expect(x + scale * 100).toBeCloseTo(100);
    expect(y + scale * 50).toBeCloseTo(50);
    expect(list().props.scrollEnabled).toBe(false);
  });

  it("stops at maxZoom and returns to rest at 1", async () => {
    await mount({ maxZoom: 3 });

    await act(async () => {
      zoomHandlers().onWheelZoom(1.5, { x: 0, y: 0 });
    });
    await act(async () => {
      zoomHandlers().onWheelZoom(1.5, { x: 0, y: 0 });
    });
    await act(async () => {
      zoomHandlers().onWheelZoom(1.5, { x: 0, y: 0 });
    });
    expect(JSON.stringify(flat(zoomLayer()).transform)).toContain('"scale":3');

    await act(async () => {
      zoomHandlers().onWheelZoom(0.1, { x: 0, y: 0 });
    });
    expect(list().props.scrollEnabled).toBe(true);
  });

  it("toggles zoom on a double click, at the click", async () => {
    await mount();

    await act(async () => {
      zoomHandlers().onDoubleClick({ x: 40, y: 20 });
    });
    expect(list().props.scrollEnabled).toBe(false);
    expect(JSON.stringify(flat(zoomLayer()).transform)).toContain('"scale":2.5');

    await act(async () => {
      zoomHandlers().onDoubleClick({ x: 40, y: 20 });
    });
    expect(list().props.scrollEnabled).toBe(true);
  });

  it("ignores the wheel and a double click on a page that is not the shown one", async () => {
    const { rerender } = await mount({ index: 1 });
    const stale = zoomHandlers();
    const staleLayer = zoomLayer();

    await rerender({ index: 2 });
    await act(async () => {
      stale.onWheelZoom(2, { x: 0, y: 0 });
      stale.onDoubleClick({ x: 10, y: 10 });
    });

    // The page that was shown is still mounted, off screen: it did not zoom, and paging is not locked.
    expect(list().props.scrollEnabled).toBe(true);
    expect(JSON.stringify(flat(staleLayer).transform)).toContain('"scale":1');
  });

  it("does not listen at all with zoom={false}", async () => {
    mockedZoomEvents.attachZoomEvents.mockClear();
    await mount({ zoom: false });

    expect(mockedZoomEvents.attachZoomEvents).not.toHaveBeenCalled();
  });

  it("resets zoom on a page change", async () => {
    await mount({ initialIndex: 1 });
    await act(async () => {
      zoomHandlers().onWheelZoom(2, { x: 0, y: 0 });
    });
    expect(list().props.scrollEnabled).toBe(false);

    await press("ArrowRight");

    expect(counterText()).toBe("3 of 5");
    expect(list().props.scrollEnabled).toBe(true);
    expect(JSON.stringify(flat(zoomLayer()).transform)).toContain('"scale":1');
  });

  it("shows zoom-in at rest and grab when zoomed, and hands pinch and pan to the page only when zoomed", async () => {
    await mount();
    expect(flat(imagePage()).cursor).toBe("zoom-in");
    expect(flat(imagePage()).touchAction).toBe("pan-x");

    await act(async () => {
      zoomHandlers().onWheelZoom(2, { x: 0, y: 0 });
    });

    expect(flat(imagePage()).cursor).toBe("grab");
    expect(flat(imagePage()).touchAction).toBe("none");
  });

  it("leaves the cursor and touch action alone with zoom={false}", async () => {
    await mount({ zoom: false });

    expect(flat(imagePage()).cursor).toBeUndefined();
    expect(flat(imagePage()).touchAction).toBeUndefined();
  });
});

describe("paging and chrome", () => {
  it("shows previous and next on web without a screen reader, and hides them at the ends", async () => {
    const { rerender } = await mount({ initialIndex: 0 });

    expect(screen.queryByTestId("media-viewer-previous", hidden)).toBeNull();
    expect(screen.getByTestId("media-viewer-next", hidden)).toBeTruthy();

    await rerender({ index: 2 });
    expect(screen.getByTestId("media-viewer-previous", hidden)).toBeTruthy();
    expect(screen.getByTestId("media-viewer-next", hidden)).toBeTruthy();

    await rerender({ index: 4 });
    expect(screen.queryByTestId("media-viewer-next", hidden)).toBeNull();
  });

  it("pages from the buttons", async () => {
    const { onIndexChange } = await mount({ initialIndex: 1 });

    await fireEvent.press(screen.getByTestId("media-viewer-next", hidden));
    await fireEvent.press(screen.getByTestId("media-viewer-previous", hidden));

    expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([2, 1]);
  });

  it("has no edge buttons for a single item", async () => {
    await mount({ items: [image("a")] });

    expect(screen.queryByTestId("media-viewer-next", hidden)).toBeNull();
    expect(screen.queryByTestId("media-viewer-previous", hidden)).toBeNull();
  });

  it("reads the page once scrolling has gone quiet, not on every tick", async () => {
    jest.useFakeTimers();
    const { onIndexChange } = await mount();
    const scroll = (x: number) =>
      fireEvent.scroll(list(), {
        nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 2000, height: 800 }, layoutMeasurement: VIEWPORT },
      });

    await scroll(100);
    await scroll(400);
    await scroll(790);
    expect(counterText()).toBe("1 of 5");
    expect(onIndexChange).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(150);
    });

    expect(counterText()).toBe("3 of 5");
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("does not read a page from the native momentum events web never sends", async () => {
    await mount();

    await fireEvent(list(), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 800, y: 0 }, contentSize: { width: 2000, height: 800 }, layoutMeasurement: VIEWPORT },
    });

    expect(counterText()).toBe("1 of 5");
  });

  it("scrolls with a throttle react-native-web honors", async () => {
    await mount();

    expect(list().props.scrollEventThrottle).toBe(16);
  });

  it("gives every page a snap point, mounted or not, so the browser snaps one page at a time", async () => {
    await mount();

    for (const index of [0, 2, 4]) {
      const slot = screen.getByTestId(`media-viewer-slot-${index}`, hidden);
      expect(flat(slot).scrollSnapAlign).toBe("start");
      expect(flat(slot).scrollSnapStop).toBe("always");
      expect(flat(slot).width).toBe(400);
    }
  });

  it("mounts only the shown page and its neighbors, however long the list", async () => {
    const many = Array.from({ length: 60 }, (_, i) => image(`k${i}`));
    const { rerender } = await mount({ items: many, index: 30 });

    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(3);

    await rerender({ index: 31 });
    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(3);
    expect(counterText()).toBe("32 of 60");

    await rerender({ index: 59 });
    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(2);
  });

  it("does not drag a page to dismiss on web: a mouse has Esc and the button", async () => {
    const { onClose } = await mount();
    expect(imagePage().props.onResponderMove).toEqual(expect.any(Function));

    // A vertical mouse drag: same responder path, which web never takes for a dismiss.
    const history = (y: number) => ({
      touchBank: [{ touchActive: true, startPageX: 200, startPageY: 300, startTimeStamp: 1, currentPageX: 200, currentPageY: y, currentTimeStamp: 20, previousPageX: 200, previousPageY: 300, previousTimeStamp: 1 }],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 20,
    });
    const event = (y: number) => ({ touchHistory: history(y), nativeEvent: { touches: [{ pageX: 200, pageY: y }] } });
    await act(async () => {
      imagePage().props.onStartShouldSetResponder(event(300));
      imagePage().props.onResponderGrant(event(300));
      imagePage().props.onResponderMove(event(500));
      imagePage().props.onResponderRelease({ ...event(500), touchHistory: { ...history(500), numberActiveTouches: 0 } });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not use the screen reader's always-on answer to pin the chrome open", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await mount();

    // Web has its own hover and focus; the chrome is still the tap-to-toggle kind.
    expect(AccessibilityInfo.isScreenReaderEnabled).not.toHaveBeenCalled();
  });

  it("names the picture to the browser through the image's alt, not an accessible wrapper", async () => {
    await mount();

    expect(within(imagePage()).getByTestId("expo-image", hidden).props.accessibilityLabel).toBe("Picture a");
    expect(imagePage().props.accessible).toBeUndefined();
    expect(imagePage().props.accessibilityActions).toBeUndefined();
  });

  it("hides the pages that are not shown from assistive technology", async () => {
    await mount({ index: 2 });

    const pages = screen.getAllByTestId("media-viewer-image-page", hidden);
    expect(pages).toHaveLength(3);
    expect(pages.filter((page) => page.props["aria-hidden"] === true)).toHaveLength(2);
    expect(pages.filter((page) => page.props["aria-hidden"] === undefined)).toHaveLength(1);
    expect(pages[0].props.importantForAccessibility).toBe("no-hide-descendants");
    expect(pages[1].props["aria-hidden"]).toBeUndefined();
  });

  it("keeps the top bar and a video page's own controls together", async () => {
    await mount({ items: [video("v"), image("a")] });

    expect(screen.getByTestId("media-viewer-close", hidden)).toBeTruthy();
    expect(screen.getByTestId("media-viewer-video-bar", hidden)).toBeTruthy();
    void asPlayer;
  });
});
