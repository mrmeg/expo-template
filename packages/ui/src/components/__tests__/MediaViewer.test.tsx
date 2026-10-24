/**
 * MediaViewer on iOS (the jest-expo default; web has its own file).
 *
 * `expo-video` is the opt-in fake (`test/mocks/expoVideo`) and `expo-image` a
 * `View` that receives every prop (so a test can call its `onLoad`). The native
 * `Modal` is a tagged `View` that keeps its props and renders nothing while it
 * is not visible. Gestures are driven by calling the page's responder handlers
 * with a hand-built `touchHistory`, the way the responder system would: this is
 * what Jest can say about the pinch and swipe code. Whether the platform's
 * scroller lets a pinch through is a device question (see the media-viewer PR's
 * spike).
 */
import React from "react";
import { AccessibilityInfo, Animated, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { asPlayer, type TestPlayer } from "./videoTestTypes";
import { MediaViewer, type MediaViewerItem, type MediaViewerProps } from "../MediaViewer";
import * as componentsBarrel from "../index";

jest.mock("expo-video", () => require("@/test/mocks/expoVideo"));

jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { ...props, testID: "expo-image" }),
  };
});

// RNTL 14 has no by-type query, so the native Modal is a tagged View that keeps its props and, like the real
// one, renders nothing while it is not visible.
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const { View } = require("react-native");
  function MockModal({ children, visible = true, ...props }: { children?: React.ReactNode; visible?: boolean }) {
    return visible ? React.createElement(View, { testID: "rn-modal", visible, ...props }, children) : null;
  }
  return { __esModule: true, default: MockModal };
});

// A host instance has no native tag in Jest: hand out one so the screen-reader focus call has a target.
jest.mock("react-native/Libraries/ReactNative/RendererProxy", () => ({
  ...jest.requireActual("react-native/Libraries/ReactNative/RendererProxy"),
  findNodeHandle: () => 7,
}));

let mockReducedMotion = true;
jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
jest.mock("../../hooks/useWindowInsets", () => ({
  useWindowInsets: () => mockInsets,
}));

const hidden = { includeHiddenElements: true } as const;
const flat = (el: TestInstance) => (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

const image = (key: string, extra: Partial<Extract<MediaViewerItem, { type: "image" }>> = {}): MediaViewerItem => ({
  type: "image",
  key,
  source: `https://example.com/${key}.jpg`,
  alt: `Picture ${key}`,
  title: `Title ${key}`,
  ...extra,
});
const video = (key: string): MediaViewerItem => ({
  type: "video",
  key,
  source: `https://example.com/${key}.mp4`,
  poster: `https://example.com/${key}.jpg`,
  title: `Clip ${key}`,
});

const FIVE = ["a", "b", "c", "d", "e"].map((key) => image(key));

const VIEWPORT = { width: 400, height: 800 };

interface Mounted {
  onClose: jest.Mock;
  onIndexChange: jest.Mock;
  rerender: (next?: Partial<MediaViewerProps>) => Promise<void>;
}

/** Render, then give the viewer the window the platform would measure. */
async function mount(props: Partial<MediaViewerProps> = {}): Promise<Mounted> {
  const onClose = jest.fn();
  const onIndexChange = jest.fn();
  const base: MediaViewerProps = { items: FIVE, visible: true, onClose, onIndexChange, ...props };
  const utils = await render(<MediaViewer {...base} />);
  await fireEvent(screen.getByTestId("media-viewer", hidden), "layout", { nativeEvent: { layout: VIEWPORT } });
  return {
    onClose,
    onIndexChange,
    rerender: async (next = {}) => {
      await utils.rerender(<MediaViewer {...base} {...next} />);
    },
  };
}

const counter = () => screen.queryByTestId("media-viewer-counter", hidden);
const counterText = () => {
  const children = counter()?.props.children;
  return Array.isArray(children) ? children.join("") : children;
};
const titleText = () => screen.getByTestId("media-viewer-title", hidden).props.children;
const list = () => screen.getByTestId("media-viewer-list", hidden);
const chrome = () => screen.getByTestId("media-viewer-chrome", hidden);
/** The page the viewer is on: neighbors are mounted too (hidden from the screen reader), so pick the one that is not. */
const shown = (testID: string) =>
  screen.getAllByTestId(testID, hidden).find((el) => !el.props.accessibilityElementsHidden) as TestInstance;
const imagePage = () => shown("media-viewer-image-page");
const zoomLayer = () => within(imagePage()).getByTestId("media-viewer-zoom", hidden);

/** The zoom layer's transform as plain numbers. */
function transformOf() {
  const entries = (flat(zoomLayer()).transform ?? []) as Record<string, number>[];
  const find = (key: string) => entries.find((entry) => key in entry)?.[key] ?? Number.NaN;
  return { scale: find("scale"), x: find("translateX"), y: find("translateY") };
}

/** A hand-built responder `touchHistory` and the calls the responder system makes for a gesture. */
class Gesture {
  private time = 1000;
  /** Milliseconds between events: slow it down for a drag that must not read as a flick. */
  step = 16;
  private fingers = new Map<number, { x: number; y: number; px: number; py: number; sx: number; sy: number; at: number; pat: number }>();

  constructor(private readonly target: () => TestInstance) {}

  private history(active: Set<number>) {
    const touchBank: unknown[] = [];
    for (const [id, f] of this.fingers) {
      touchBank[id] = {
        touchActive: active.has(id),
        startPageX: f.sx,
        startPageY: f.sy,
        startTimeStamp: f.at,
        currentPageX: f.x,
        currentPageY: f.y,
        currentTimeStamp: this.time,
        previousPageX: f.px,
        previousPageY: f.py,
        previousTimeStamp: f.pat,
      };
    }
    const ids = [...active];
    return {
      touchBank,
      numberActiveTouches: ids.length,
      indexOfSingleActiveTouch: ids.length === 1 ? ids[0] : -1,
      mostRecentTimeStamp: this.time,
    };
  }

  private event(active: Set<number>) {
    const touches = [...active].map((id) => {
      const f = this.fingers.get(id);
      return { identifier: id, pageX: f?.x ?? 0, pageY: f?.y ?? 0, locationX: f?.x ?? 0, locationY: f?.y ?? 0 };
    });
    return { touchHistory: this.history(active), nativeEvent: { touches, changedTouches: touches }, persist: () => {} };
  }

  private call(name: string, event: unknown) {
    const handler = this.target().props[name] as ((e: unknown) => unknown) | undefined;
    return handler?.(event);
  }

  /** Put fingers down (ids 0, 1, ...) at the given points. */
  async down(...points: [number, number][]) {
    this.time += this.step;
    points.forEach(([x, y], id) => this.fingers.set(id, { x, y, px: x, py: y, sx: x, sy: y, at: this.time, pat: this.time }));
    const event = this.event(new Set(points.map((_, id) => id)));
    await act(async () => {
      const capture = this.call("onStartShouldSetResponderCapture", event);
      const start = this.call("onStartShouldSetResponder", event);
      if (capture || start) this.call("onResponderGrant", event);
    });
  }

  /** A second finger lands while the first is already down. */
  async addFinger(x: number, y: number) {
    this.time += this.step;
    const id = this.fingers.size;
    this.fingers.set(id, { x, y, px: x, py: y, sx: x, sy: y, at: this.time, pat: this.time });
    const event = this.event(new Set(this.fingers.keys()));
    await act(async () => {
      this.call("onMoveShouldSetResponderCapture", event);
    });
  }

  /** Move the active fingers to the given points (by id). */
  async move(...points: [number, number][]) {
    this.time += this.step;
    points.forEach(([x, y], id) => {
      const f = this.fingers.get(id);
      if (!f) return;
      f.px = f.x;
      f.py = f.y;
      f.pat = f.at;
      f.x = x;
      f.y = y;
      f.at = this.time;
    });
    const event = this.event(new Set(points.map((_, id) => id)));
    await act(async () => {
      this.call("onResponderMove", event);
    });
  }

  /** Lift a finger (by id) and keep the rest down. */
  async lift(id: number) {
    this.time += this.step;
    const remaining = new Set([...this.fingers.keys()].filter((key) => key !== id));
    const event = this.event(remaining);
    await act(async () => {
      this.call("onResponderMove", event);
    });
    this.fingers.delete(id);
  }

  async up() {
    this.time += this.step;
    const event = this.event(new Set());
    await act(async () => {
      this.call("onResponderRelease", event);
    });
    this.fingers.clear();
  }

  async cancel() {
    this.time += this.step;
    const event = this.event(new Set());
    await act(async () => {
      this.call("onResponderTerminate", event);
    });
    this.fingers.clear();
  }

  /** What the responder system asks before handing the touch to another view. */
  terminationRequested(): boolean {
    return this.call("onResponderTerminationRequest", this.event(new Set(this.fingers.keys()))) as boolean;
  }
}

const gesture = () => new Gesture(imagePage);

/** Tell the active page its picture's natural size, as `expo-image` does on load. */
async function loadActiveImage(width: number, height: number) {
  const picture = within(imagePage()).getByTestId("expo-image", hidden);
  await act(async () => {
    (picture.props.onLoad as (event: unknown) => void)({ source: { width, height } });
  });
}

beforeEach(() => {
  mockReducedMotion = true;
  mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the barrel", () => {
  it("does not export MediaViewer: it is subpath-only", () => {
    expect(Object.keys(componentsBarrel)).not.toContain("MediaViewer");
  });
});

describe("render and navigation", () => {
  it("renders the item at initialIndex, and the counter matches", async () => {
    await mount({ initialIndex: 2 });

    expect(counterText()).toBe("3 of 5");
    expect(screen.getByTestId("media-viewer-title", hidden).props.children).toBe("Title c");
    expect(within(imagePage()).getByTestId("expo-image", hidden).props.source).toBe("https://example.com/c.jpg");
  });

  it("starts on the first item by default", async () => {
    await mount();

    expect(counterText()).toBe("1 of 5");
    expect(within(imagePage()).getByTestId("expo-image", hidden).props.source).toBe("https://example.com/a.jpg");
  });

  it("clamps an out-of-range initialIndex, negative or past the end", async () => {
    await mount({ initialIndex: 99 });
    expect(counterText()).toBe("5 of 5");
  });

  it("clamps a negative index", async () => {
    await mount({ index: -3 });
    expect(counterText()).toBe("1 of 5");
  });

  it("hides the counter for a single item, and renders nothing for none", async () => {
    const { rerender } = await mount({ items: [image("only")] });
    expect(counter()).toBeNull();
    expect(screen.getByTestId("media-viewer-title", hidden)).toBeTruthy();

    await rerender({ items: [] });
    expect(screen.queryByTestId("rn-modal", hidden)).toBeNull();
    expect(screen.queryByTestId("media-viewer", hidden)).toBeNull();
  });

  it("renders nothing while not visible, and a new open starts from initialIndex again", async () => {
    const { rerender } = await mount({ initialIndex: 1 });
    await rerender({ visible: false });
    expect(screen.queryByTestId("media-viewer", hidden)).toBeNull();

    await rerender({ visible: true, initialIndex: 3 });
    await fireEvent(screen.getByTestId("media-viewer", hidden), "layout", { nativeEvent: { layout: VIEWPORT } });
    expect(counterText()).toBe("4 of 5");
  });

  it("goes to the next and previous item from the screen-reader buttons, reporting each", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    const { onIndexChange } = await mount({ initialIndex: 1 });

    await fireEvent.press(await screen.findByTestId("media-viewer-next", hidden));
    expect(counterText()).toBe("3 of 5");
    expect(onIndexChange).toHaveBeenLastCalledWith(2);

    await fireEvent.press(screen.getByTestId("media-viewer-previous", hidden));
    await fireEvent.press(screen.getByTestId("media-viewer-previous", hidden));
    expect(counterText()).toBe("1 of 5");
    expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([2, 1, 0]);
  });

  it("hides previous on the first item and next on the last", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    const { rerender } = await mount({ initialIndex: 0 });

    expect(await screen.findByTestId("media-viewer-next", hidden)).toBeTruthy();
    expect(screen.queryByTestId("media-viewer-previous", hidden)).toBeNull();

    await rerender({ index: 4 });
    expect(screen.queryByTestId("media-viewer-next", hidden)).toBeNull();
    expect(screen.getByTestId("media-viewer-previous", hidden)).toBeTruthy();
  });

  it("leaves the edge buttons out of the touch UI: swipe is the affordance unless a screen reader is on", async () => {
    await mount({ initialIndex: 2 });

    expect(screen.queryByTestId("media-viewer-next", hidden)).toBeNull();
    expect(screen.queryByTestId("media-viewer-previous", hidden)).toBeNull();
  });

  it("pages with the increment and decrement accessibility actions", async () => {
    const { onIndexChange } = await mount({ initialIndex: 1 });
    const act_ = async (actionName: string) =>
      act(async () => {
        imagePage().props.onAccessibilityAction({ nativeEvent: { actionName } });
      });

    await act_("increment");
    expect(counterText()).toBe("3 of 5");

    await act_("decrement");
    await act_("decrement");
    expect(counterText()).toBe("1 of 5");
    expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([2, 1, 0]);
  });

  it("offers increment, decrement and escape on an image page, and escape closes", async () => {
    const { onClose } = await mount();

    expect(imagePage().props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      "increment",
      "decrement",
      "escape",
    ]);
    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "escape" } });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("names an image page with its alt, and leaves the inner picture to it", async () => {
    await mount();

    expect(imagePage().props.accessibilityLabel).toBe("Picture a");
    expect(imagePage().props.accessibilityRole).toBe("image");
    expect(within(imagePage()).getByTestId("media-viewer-image", hidden)).toBeTruthy();
  });

  it("stops at the ends: no step past the last or before the first", async () => {
    const { onIndexChange } = await mount({ initialIndex: 4 });
    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });

    expect(counterText()).toBe("5 of 5");
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("reads the page from momentum end on native", async () => {
    const { onIndexChange } = await mount();

    await fireEvent(list(), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 800, y: 0 }, contentSize: { width: 2000, height: 800 }, layoutMeasurement: VIEWPORT },
    });

    expect(counterText()).toBe("3 of 5");
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("does not scroll the list back to a page the list itself just reported", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    await mount();
    scrollTo.mockClear();

    await fireEvent(list(), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 400, y: 0 }, contentSize: { width: 2000, height: 800 }, layoutMeasurement: VIEWPORT },
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the page for a button or action, and keeps the page on a resize", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    await mount({ initialIndex: 1 });
    scrollTo.mockClear();

    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 800, animated: false });

    scrollTo.mockClear();
    await fireEvent(screen.getByTestId("media-viewer", hidden), "layout", {
      nativeEvent: { layout: { width: 800, height: 400 } },
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 1600, animated: false });
  });

  it("announces the title and position on a page change, and not on open", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await mount({ initialIndex: 1 });
    expect(announce).not.toHaveBeenCalled();

    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });

    expect(announce).toHaveBeenCalledWith("Title c, 3 of 5");
  });

  it("hides the pages that are not shown from the screen reader", async () => {
    await mount({ index: 2 });

    const pages = screen.getAllByTestId("media-viewer-image-page", hidden);
    expect(pages).toHaveLength(3);
    expect(pages.filter((page) => page.props.accessibilityElementsHidden === true)).toHaveLength(2);
    expect(pages.filter((page) => page.props.accessibilityElementsHidden === undefined)).toHaveLength(1);
    expect(pages[0].props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("mounts only the shown page and its neighbors, however long the list", async () => {
    const many = Array.from({ length: 60 }, (_, i) => image(`k${i}`));
    const { rerender } = await mount({ items: many, index: 30 });

    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(3);
    expect(screen.getAllByTestId(/^media-viewer-slot-/, hidden)).toHaveLength(60);

    await rerender({ index: 31 });
    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(3);
    expect(counterText()).toBe("32 of 60");

    await rerender({ index: 0 });
    expect(screen.getAllByTestId("media-viewer-image-page", hidden)).toHaveLength(2);
  });

  it("gives every slot the page's size, so the scroller pages by it", async () => {
    await mount();

    for (const index of [0, 2, 4]) {
      const slot = screen.getByTestId(`media-viewer-slot-${index}`, hidden);
      expect(flat(slot)).toEqual(expect.objectContaining({ width: 400, height: 800 }));
    }
    expect(list().props.pagingEnabled).toBe(true);
    expect(list().props.horizontal).toBe(true);
  });

  it("is a modal view", async () => {
    await mount();

    expect(screen.getByTestId("media-viewer", hidden).props.accessibilityViewIsModal).toBe(true);
  });

  it("moves screen-reader focus to the close button on open", async () => {
    jest.useFakeTimers();
    const setFocus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
    await mount();

    await act(async () => {
      jest.advanceTimersByTime(150);
    });

    expect(setFocus).toHaveBeenCalledTimes(1);
    expect(setFocus).toHaveBeenCalledWith(7);
  });
});

describe("controlled index", () => {
  it("shows the index it is given, and follows a change", async () => {
    const { rerender, onIndexChange } = await mount({ index: 3 });
    expect(counterText()).toBe("4 of 5");

    await rerender({ index: 1 });
    expect(counterText()).toBe("2 of 5");
    // The parent moved it itself: it is not told about its own change.
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("reports a user's move and shows it only once the parent applies it", async () => {
    const { rerender, onIndexChange } = await mount({ index: 1 });

    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(counterText()).toBe("2 of 5");

    await rerender({ index: 2 });
    expect(counterText()).toBe("3 of 5");
    expect(onIndexChange).toHaveBeenCalledTimes(1);
  });

  it("tells the parent when an index past the list had to be clamped", async () => {
    const { onIndexChange } = await mount({ index: 12 });

    expect(counterText()).toBe("5 of 5");
    expect(onIndexChange).toHaveBeenCalledWith(4);
  });
});

describe("when items change while open", () => {
  it("stays on the same key when an item before it is deleted, and reports the new index", async () => {
    const { rerender, onIndexChange } = await mount({ initialIndex: 2 });

    await rerender({ items: FIVE.filter((item) => item.key !== "a") });

    expect(counterText()).toBe("2 of 4");
    expect(titleText()).toBe("Title c");
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("clamps when the shown item is the one deleted", async () => {
    const { rerender, onIndexChange } = await mount({ initialIndex: 4 });

    await rerender({ items: FIVE.filter((item) => item.key !== "e") });

    expect(counterText()).toBe("4 of 4");
    expect(titleText()).toBe("Title d");
    expect(onIndexChange).toHaveBeenCalledWith(3);
  });

  it("clamps into the middle of the list when a middle item is deleted", async () => {
    const { rerender } = await mount({ initialIndex: 2 });

    await rerender({ items: FIVE.filter((item) => item.key !== "c") });

    expect(counterText()).toBe("3 of 4");
    expect(titleText()).toBe("Title d");
  });

  it("follows a reorder by key", async () => {
    const { rerender } = await mount({ initialIndex: 1 });

    await rerender({ items: [...FIVE].reverse() });

    expect(counterText()).toBe("4 of 5");
    expect(titleText()).toBe("Title b");
  });
});

describe("closing", () => {
  it("closes from the close button, which is labelled", async () => {
    const { onClose } = await mount();

    const close = screen.getByTestId("media-viewer-close", hidden);
    expect(close.props.accessibilityLabel).toBe("Close");
    await fireEvent.press(close);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the Modal's close request (Android back)", async () => {
    const { onClose } = await mount();

    await act(async () => {
      screen.getByTestId("rn-modal", hidden).props.onRequestClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the iOS escape gesture on the root", async () => {
    const { onClose } = await mount();

    await act(async () => {
      screen.getByTestId("media-viewer", hidden).props.onAccessibilityEscape();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a transparent, translucent, orientation-free Modal that fades", async () => {
    mockReducedMotion = false;
    await mount();

    expect(screen.getByTestId("rn-modal", hidden).props).toEqual(
      expect.objectContaining({
        transparent: true,
        animationType: "fade",
        statusBarTranslucent: true,
        supportedOrientations: ["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"],
      }),
    );
  });

  it("does not animate under reduced motion", async () => {
    await mount();

    expect(screen.getByTestId("rn-modal", hidden).props.animationType).toBe("none");
  });

  it("pads the top bar by the top safe area", async () => {
    mockInsets = { top: 47, right: 0, bottom: 34, left: 0 };
    await mount();

    expect(flat(screen.getByTestId("media-viewer-top-bar", hidden)).paddingTop).toBe(47 + 4);
  });
});

describe("swipe to dismiss", () => {
  it("closes on a swipe down past 120 pt, and does not page", async () => {
    const { onClose } = await mount();
    const swipe = gesture();

    await swipe.down([200, 300]);
    await swipe.move([202, 340]);
    await swipe.move([205, 470]);
    await swipe.up();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(counterText()).toBe("1 of 5");
  });

  it("closes on a swipe up too", async () => {
    const { onClose } = await mount();
    const swipe = gesture();

    await swipe.down([200, 500]);
    await swipe.move([200, 450]);
    await swipe.move([198, 300]);
    await swipe.up();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back from a short drag, without closing", async () => {
    const { onClose } = await mount();
    const swipe = gesture();
    swipe.step = 300;

    await swipe.down([200, 300]);
    await swipe.move([200, 330]);
    await swipe.move([200, 360]);
    await swipe.up();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a short but fast flick", async () => {
    const { onClose } = await mount();
    const swipe = gesture();

    await swipe.down([200, 300]);
    await swipe.move([200, 330]);
    await swipe.move([200, 360]);
    await swipe.up();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("holds on to the touch once a vertical drag has begun, so the pager cannot take it", async () => {
    await mount();
    const swipe = gesture();

    await swipe.down([200, 300]);
    expect(swipe.terminationRequested()).toBe(true);
    await swipe.move([202, 330]);

    expect(swipe.terminationRequested()).toBe(false);
    await swipe.cancel();
  });

  it("lets a horizontal drag go to the pager", async () => {
    const { onClose } = await mount();
    const swipe = gesture();

    await swipe.down([200, 300]);
    await swipe.move([260, 304]);
    await swipe.move([340, 306]);

    expect(swipe.terminationRequested()).toBe(true);
    await swipe.up();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is off with swipeToDismiss={false}", async () => {
    const { onClose } = await mount({ swipeToDismiss: false });
    const swipe = gesture();

    await swipe.down([200, 300]);
    await swipe.move([200, 420]);
    await swipe.move([200, 520]);
    await swipe.up();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("is off while zoomed: the drag pans instead", async () => {
    const { onClose } = await mount();
    const swipe = gesture();
    await swipe.down([100, 300], [300, 300]);
    await swipe.move([20, 300], [380, 300]);
    await swipe.up();
    expect(transformOf().scale).toBeGreaterThan(1);

    await swipe.down([200, 300]);
    await swipe.move([200, 460]);
    await swipe.move([200, 520]);
    await swipe.up();

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("video pages", () => {
  const MIXED: MediaViewerItem[] = [image("a"), video("v1"), image("b"), video("v2")];
  const players = () => screen.queryAllByTestId("media-viewer-video-view", hidden);
  const posters = () => screen.queryAllByTestId("media-viewer-poster", hidden);
  const videoPage = () => shown("media-viewer-video-page");

  it("mounts a player for the shown video page only, with the viewer's video settings", async () => {
    await mount({ items: MIXED, initialIndex: 1 });

    expect(players()).toHaveLength(1);
    const props = players()[0].props;
    expect(props.nativeControls).toBe(false);
    expect(props.fullscreenOptions).toEqual({ enable: false });
    expect(screen.queryByTestId("media-viewer-video-fullscreen-toggle", hidden)).toBeNull();
    expect(screen.getByTestId("media-viewer-video-bar", hidden)).toBeTruthy();
  });

  it("mounts no player while an image is shown", async () => {
    await mount({ items: MIXED, initialIndex: 0 });

    expect(players()).toHaveLength(0);
  });

  it("shows a poster and a play glyph, and no player, on a video page that is not shown", async () => {
    // Move off the video page after it is in the window, so its page stays mounted as a neighbor.
    const { rerender } = await mount({ items: MIXED, index: 1 });
    expect(players()).toHaveLength(1);

    await rerender({ index: 0 });

    expect(players()).toHaveLength(0);
    // The video page may sit outside the list's current window; when it is mounted it must be a poster.
    for (const poster of posters()) {
      expect(within(poster).getByTestId("media-viewer-play-glyph", hidden)).toBeTruthy();
    }
  });

  it("shows a neighboring video page as its poster with a play glyph, and mounts no player for it", async () => {
    await mount({ items: [video("v1"), video("v2"), image("a")], initialIndex: 0 });

    expect(players()).toHaveLength(1);
    expect(posters()).toHaveLength(1);
    expect(within(posters()[0]).getByTestId("media-viewer-play-glyph", hidden)).toBeTruthy();
    expect(within(posters()[0]).getByTestId("expo-image", hidden).props.source).toBe("https://example.com/v2.jpg");
  });

  it("shows black and a play glyph for a neighboring clip with no poster", async () => {
    await mount({ items: [image("a"), { type: "video", key: "bare", source: "https://example.com/bare.mp4" }], initialIndex: 0 });

    expect(players()).toHaveLength(0);
    expect(within(posters()[0]).queryByTestId("expo-image", hidden)).toBeNull();
    expect(within(posters()[0]).getByTestId("media-viewer-play-glyph", hidden)).toBeTruthy();
  });

  it("insets the player by the safe area, so its bar clears the home indicator and the notch", async () => {
    mockInsets = { top: 47, right: 44, bottom: 34, left: 44 };
    await mount({ items: MIXED, initialIndex: 1 });

    const inset = screen.getByTestId("media-viewer-video-inset", hidden);
    expect(flat(inset)).toEqual(expect.objectContaining({ position: "absolute", top: 0, left: 44, right: 44, bottom: 34 }));
    expect(within(inset).getByTestId("media-viewer-video", hidden)).toBeTruthy();
  });

  it("uses the platform's controls for videoControls=\"native\"", async () => {
    await mount({ items: MIXED, initialIndex: 1, videoControls: "native" });

    expect(players()[0].props.nativeControls).toBe(true);
    expect(screen.queryByTestId("media-viewer-video-bar", hidden)).toBeNull();
  });

  it("pauses and unmounts the player when the viewer pages away from it", async () => {
    const { rerender } = await mount({ items: MIXED, index: 1 });
    const fake = players()[0].props.player as TestPlayer;
    expect(fake.pause).not.toHaveBeenCalled();

    await rerender({ index: 2 });

    expect(fake.pause).toHaveBeenCalled();
    expect(players()).toHaveLength(0);
  });

  it("mounts a fresh player for each video page it lands on", async () => {
    const { rerender } = await mount({ items: MIXED, index: 1 });
    const first = players()[0].props.player as TestPlayer;

    await rerender({ index: 3 });

    expect(players()).toHaveLength(1);
    expect(players()[0].props.player).not.toBe(first);
  });

  it("offers no step actions of its own: the video's frame owns increment and decrement", async () => {
    await mount({ items: MIXED, initialIndex: 1 });

    expect(videoPage().props.accessibilityActions).toBeUndefined();
    expect(videoPage().props.accessible).not.toBe(true);
  });

  it("keeps the top bar on a video page even after a tap hid it on an image page", async () => {
    jest.useFakeTimers({ now: 10_000 });
    const { rerender } = await mount({ items: MIXED, index: 0 });
    const tap = gesture();
    await tap.down([200, 400]);
    await tap.up();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(flat(chrome()).opacity).toBe(0);

    await rerender({ index: 1 });

    expect(flat(chrome()).opacity).toBe(1);
  });

  it("closes on a vertical drag that no control claimed", async () => {
    const { onClose } = await mount({ items: MIXED, initialIndex: 1 });
    const swipe = new Gesture(videoPage);

    // Only a drag that is already vertical is claimed; a still touch or a sideways one is left alone.
    const claims = (dx: number, dy: number) =>
      videoPage().props.onMoveShouldSetResponder({
        nativeEvent: { touches: [{}] },
        touchHistory: { numberActiveTouches: 1, touchBank: [], mostRecentTimeStamp: 0 },
        __dx: dx,
        __dy: dy,
      });
    void claims;

    await swipe.down([200, 300]);
    await swipe.move([200, 330]);
    await swipe.move([200, 470]);
    await swipe.up();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("zoom", () => {
  it("pinches: two fingers apart zoom in, the pager is switched off, and the touch is held", async () => {
    await mount();
    const pinch = gesture();

    await pinch.down([180, 400], [220, 400]);
    expect(list().props.scrollEnabled).toBe(false);
    expect(pinch.terminationRequested()).toBe(false);

    await pinch.move([140, 400], [260, 400]);

    // Distance 40 -> 120: scale 3.
    expect(transformOf().scale).toBeCloseTo(3);
    expect(list().props.scrollEnabled).toBe(false);
  });

  it("captures a second finger so the pager never sees a pinch", async () => {
    await mount();
    const pinch = gesture();

    await pinch.down([180, 400]);
    await pinch.addFinger(220, 400);

    expect(imagePage().props.onMoveShouldSetResponderCapture({
      touchHistory: { numberActiveTouches: 2, touchBank: [
        { touchActive: true, currentPageX: 1, currentPageY: 1 },
        { touchActive: true, currentPageX: 2, currentPageY: 2 },
      ] },
    })).toBe(true);
    expect(imagePage().props.onMoveShouldSetResponderCapture({
      touchHistory: { numberActiveTouches: 1, touchBank: [{ touchActive: true, currentPageX: 1, currentPageY: 1 }] },
    })).toBe(false);
    await pinch.cancel();
  });

  it("clamps to maxZoom", async () => {
    await mount({ maxZoom: 3 });
    const pinch = gesture();

    await pinch.down([190, 400], [210, 400]);
    await pinch.move([0, 400], [400, 400]);

    expect(transformOf().scale).toBe(3);
  });

  it("springs back to 1 when released below 1", async () => {
    await mount();
    const pinch = gesture();

    await pinch.down([100, 400], [300, 400]);
    await pinch.move([180, 400], [220, 400]);
    expect(transformOf().scale).toBeLessThan(1);

    await pinch.up();

    expect(transformOf()).toEqual({ scale: 1, x: 0, y: 0 });
    expect(list().props.scrollEnabled).toBe(true);
  });

  it("anchors the pinch at its midpoint", async () => {
    await mount();
    const pinch = gesture();

    // Midpoint (260, 500) is (60, 100) from the 400 x 800 center. Doubling the distance doubles the scale.
    await pinch.down([240, 500], [280, 500]);
    await pinch.move([220, 500], [300, 500]);

    const { scale, x, y } = transformOf();
    expect(scale).toBeCloseTo(2);
    expect(x + scale * 60).toBeCloseTo(60);
    expect(y + scale * 100).toBeCloseTo(100);
  });

  it("pans with one finger while zoomed, and never past the picture's edge", async () => {
    await mount();
    await loadActiveImage(3000, 2000);
    const pinch = gesture();
    await pinch.down([190, 400], [210, 400]);
    await pinch.move([140, 400], [260, 400]);
    await pinch.lift(1);
    await pinch.up();
    // Contained 400 x 266.7 at scale 6 -> clamped to maxZoom 4: 1600 x 1066.7, bounds (600, 133.3).
    expect(transformOf().scale).toBe(4);

    const pan = gesture();
    await pan.down([200, 400]);
    await pan.move([-100, 400]);
    await pan.up();
    // Inside the bounds: the picture follows the finger.
    expect(transformOf().x).toBeCloseTo(-300);

    await pan.down([200, 400]);
    await pan.move([-800, 400]);
    await pan.up();
    expect(transformOf().x).toBeCloseTo(-600);

    await pan.down([200, 400]);
    await pan.move([2400, 1500]);
    await pan.up();
    expect(transformOf().x).toBeCloseTo(600);
    expect(transformOf().y).toBeCloseTo(133.33, 1);
  });

  it("holds the touch while zoomed, so the pager cannot take a pan", async () => {
    await mount();
    const pinch = gesture();
    await pinch.down([190, 400], [210, 400]);
    await pinch.move([140, 400], [260, 400]);
    await pinch.up();

    const pan = gesture();
    await pan.down([200, 400]);
    expect(pan.terminationRequested()).toBe(false);
    await pan.cancel();
  });

  it("zooms on a double tap at the tap point, and a second double tap goes back", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount();
    const tap = gesture();

    await tap.down([300, 500]);
    await tap.up();
    jest.setSystemTime(10_100);
    await tap.down([302, 501]);
    await tap.up();

    // The second tap is the one that counts: (302, 501) is (102, 101) from the center, and 2.5x about it moves
    // the picture by -1.5 times that, inside the bounds of a picture whose size is not known yet.
    expect(transformOf().scale).toBe(2.5);
    expect(transformOf().x).toBeCloseTo(-153);
    expect(transformOf().y).toBeCloseTo(-151.5);
    expect(list().props.scrollEnabled).toBe(false);

    jest.setSystemTime(12_000);
    await tap.down([200, 400]);
    await tap.up();
    jest.setSystemTime(12_100);
    await tap.down([201, 400]);
    await tap.up();

    expect(transformOf()).toEqual({ scale: 1, x: 0, y: 0 });
    expect(list().props.scrollEnabled).toBe(true);
  });

  it("honors doubleTapZoom and clamps it to maxZoom", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount({ doubleTapZoom: 6, maxZoom: 3 });
    const tap = gesture();

    await tap.down([200, 400]);
    await tap.up();
    jest.setSystemTime(10_050);
    await tap.down([200, 400]);
    await tap.up();

    expect(transformOf().scale).toBe(3);
  });

  it("does not count two slow taps, or two far apart, as a double tap", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount();
    const tap = gesture();

    await tap.down([200, 400]);
    await tap.up();
    jest.setSystemTime(10_400);
    await tap.down([200, 400]);
    await tap.up();
    expect(transformOf().scale).toBe(1);

    jest.setSystemTime(10_450);
    await tap.down([300, 400]);
    await tap.up();
    expect(transformOf().scale).toBe(1);
  });

  it("disables paging while zoomed, and a page change resets zoom", async () => {
    const { onIndexChange } = await mount({ initialIndex: 1 });
    const pinch = gesture();
    await pinch.down([190, 400], [210, 400]);
    await pinch.move([160, 400], [240, 400]);
    await pinch.up();
    expect(transformOf().scale).toBe(4);
    expect(list().props.scrollEnabled).toBe(false);

    // The page steps by an accessibility action (a screen reader is not blocked by the scroll lock).
    await act(async () => {
      imagePage().props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });

    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(list().props.scrollEnabled).toBe(true);
    expect(transformOf()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("is off with zoom={false}: no pinch capture, no double tap", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount({ zoom: false });
    const pinch = gesture();

    await pinch.down([190, 400], [210, 400]);
    await pinch.move([100, 400], [300, 400]);
    await pinch.up();
    expect(transformOf().scale).toBe(1);

    const tap = gesture();
    await tap.down([200, 400]);
    await tap.up();
    jest.setSystemTime(10_050);
    await tap.down([200, 400]);
    await tap.up();
    expect(transformOf().scale).toBe(1);
  });

  it("springs the zoom when motion is allowed, on the native driver for transform only", async () => {
    mockReducedMotion = false;
    jest.useFakeTimers({ now: 10_000 });
    const spring = jest.spyOn(Animated, "spring");
    await mount();
    const tap = gesture();

    await tap.down([200, 400]);
    await tap.up();
    jest.setSystemTime(10_050);
    await tap.down([200, 400]);
    await tap.up();

    expect(list().props.scrollEnabled).toBe(false);
    const targets = spring.mock.calls.map(([, config]) => config.toValue);
    expect(targets).toEqual(expect.arrayContaining([2.5]));
    expect(spring.mock.calls.every(([, config]) => config.useNativeDriver === true)).toBe(true);
  });
});

describe("the chrome", () => {
  it("hides and shows on a tap of an image page, after the double-tap window", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount();
    expect(flat(chrome()).opacity).toBe(1);

    const tap = gesture();
    await tap.down([200, 400]);
    await tap.up();
    expect(flat(chrome()).opacity).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    expect(flat(chrome()).opacity).toBe(0);
    expect(chrome().props.importantForAccessibility).toBe("no-hide-descendants");

    await tap.down([200, 400]);
    await tap.up();
    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    expect(flat(chrome()).opacity).toBe(1);
  });

  it("toggles at once when zoom is off, since there is no double tap to wait for", async () => {
    await mount({ zoom: false });

    const tap = gesture();
    await tap.down([200, 400]);
    await tap.up();

    expect(flat(chrome()).opacity).toBe(0);
  });

  it("does not toggle on a drag", async () => {
    jest.useFakeTimers({ now: 10_000 });
    await mount({ swipeToDismiss: false });

    const drag = gesture();
    await drag.down([200, 400]);
    await drag.move([200, 440]);
    await drag.up();
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(flat(chrome()).opacity).toBe(1);
  });

  it("never hides under a screen reader", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await mount({ zoom: false });
    await screen.findByTestId("media-viewer-next", hidden);

    const tap = gesture();
    await tap.down([200, 400]);
    await tap.up();

    expect(flat(chrome()).opacity).toBe(1);
  });
});
