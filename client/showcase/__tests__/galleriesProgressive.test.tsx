/**
 * The galleries' mount schedule after a client-side navigation.
 *
 * `galleries.test.tsx` is the OTHER half of this pair and it is deliberately
 * untouched: it never records an entry pathname, so every screen it renders looks
 * like the one the visitor arrived on and every preview mounts at once. That
 * suite passing unmodified IS the assertion that a direct URL load still ships a
 * complete gallery. This file covers what a screen reached by a *client-side
 * navigation* renders — card chrome and `Skeleton`s first, live previews streamed
 * in per frame.
 *
 * How the navigation is simulated: the screens read `usePathname()`, which
 * test/setup.ts mocks to `"/"`. Recording a DIFFERENT entry pathname
 * (`recordPathname("/entry")`, which `RootLayout` does for real) therefore makes
 * every screen mounted here a navigated-to screen.
 *
 * The mocks mirror `galleries.test.tsx` because the same screens are mounted:
 * jest-expo reports `Platform.OS === "ios"`, so the three native
 * `@expo/ui/community/*` modules the previews reach for need stand-ins (the
 * global setup only intercepts the bare `@expo/ui` entry).
 */

import React from "react";
import { act, render, screen } from "@testing-library/react-native";

import { recordPathname } from "@/client/lib/clientNavigation";

import { BLOCKS, COMPONENTS } from "../registry";
import {
  BLOCK_STAGE_SCHEDULE,
  COMPONENT_PREVIEW_SCHEDULE,
} from "../useProgressivePreviewCount";

jest.mock("@expo/ui/community/slider", () => {
  const { View } = require("react-native");
  return { Slider: (props: object) => <View testID="native-slider" {...props} /> };
});

jest.mock("@expo/ui/community/segmented-control", () => {
  const { View } = require("react-native");
  return {
    SegmentedControl: (props: object) => (
      <View testID="native-segmented-control" {...props} />
    ),
  };
});

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const { View } = require("react-native");
  return {
    BottomSheet: ({ children }: { children?: React.ReactNode }) => (
      <View testID="native-bottom-sheet">{children}</View>
    ),
  };
});

// Imported after the mocks so the screens resolve the mocked modules.
import BlocksGalleryScreen from "@/app/(main)/(demos)/blocks/index";
import ComponentsGalleryScreen from "@/app/(main)/(demos)/components/index";

/** Advances one animation frame (jest-expo polyfills rAF onto setTimeout). */
async function flushFrames(count: number) {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      jest.advanceTimersByTime(16);
    });
  }
}

/**
 * The screens render their sections in registry order, so the cards that mount
 * live first are the leading `n` of this flattened order — not the first `n` of
 * `COMPONENTS` (which is alphabetical, not grouped by category).
 */
function componentIdsInRenderOrder(): string[] {
  const { groupComponentsByCategory } = require("../filters");
  return groupComponentsByCategory(COMPONENTS)
    .flatMap((section: { entries: { id: string }[] }) => section.entries)
    .map((entry: { id: string }) => entry.id);
}

beforeEach(() => {
  // What a client-side navigation looks like: the app was entered on some other
  // route, so a screen rendering for "/" (the mocked pathname) is one the visitor
  // navigated to and is free to defer.
  recordPathname("/entry");
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Components gallery
// ---------------------------------------------------------------------------

describe("components gallery after a navigation", () => {
  it("mounts card chrome for every component immediately", async () => {
    await render(<ComponentsGalleryScreen />);

    // The point of the change: nothing is missing from the grid on frame one.
    for (const entry of COMPONENTS) {
      expect(screen.getByTestId(`component-card-${entry.id}`)).toBeTruthy();
      expect(screen.getByText(entry.id)).toBeTruthy();
    }
  });

  it("renders only the initial burst live and skeletons the rest", async () => {
    await render(<ComponentsGalleryScreen />);

    const order = componentIdsInRenderOrder();
    const live = order.slice(0, COMPONENT_PREVIEW_SCHEDULE.initialBurst);
    const deferred = order.slice(COMPONENT_PREVIEW_SCHEDULE.initialBurst);

    expect(deferred.length).toBeGreaterThan(0);
    for (const id of live) {
      expect(screen.queryByTestId(`component-card-skeleton-${id}`)).toBeNull();
    }
    for (const id of deferred) {
      expect(screen.getByTestId(`component-card-skeleton-${id}`)).toBeTruthy();
    }
  });

  it("counts the mount budget across category sections, not per section", async () => {
    await render(<ComponentsGalleryScreen />);

    // A per-section budget would give every section its own burst, so the total
    // number of live cards would exceed the schedule's.
    const liveCount = COMPONENTS.filter(
      (entry) => screen.queryByTestId(`component-card-skeleton-${entry.id}`) === null,
    ).length;
    expect(liveCount).toBe(COMPONENT_PREVIEW_SCHEDULE.initialBurst);
  });

  it("streams every preview in once the frames run", async () => {
    await render(<ComponentsGalleryScreen />);

    const frames = Math.ceil(
      (COMPONENTS.length - COMPONENT_PREVIEW_SCHEDULE.initialBurst) /
        COMPONENT_PREVIEW_SCHEDULE.batchSize,
    );
    await flushFrames(frames);

    for (const entry of COMPONENTS) {
      expect(screen.queryByTestId(`component-card-skeleton-${entry.id}`)).toBeNull();
      expect(screen.getByTestId(`component-card-${entry.id}`)).toBeTruthy();
    }
  });

  it("grows the live set monotonically, a batch at a time", async () => {
    await render(<ComponentsGalleryScreen />);

    const liveCount = () =>
      COMPONENTS.filter(
        (entry) => screen.queryByTestId(`component-card-skeleton-${entry.id}`) === null,
      ).length;

    let previous = liveCount();
    expect(previous).toBe(COMPONENT_PREVIEW_SCHEDULE.initialBurst);

    for (let frame = 0; frame < 3; frame++) {
      await flushFrames(1);
      const current = liveCount();
      expect(current).toBe(
        Math.min(previous + COMPONENT_PREVIEW_SCHEDULE.batchSize, COMPONENTS.length),
      );
      previous = current;
    }
  });
});

// ---------------------------------------------------------------------------
// Blocks gallery
// ---------------------------------------------------------------------------

describe("blocks gallery after a navigation", () => {
  it("mounts every block card, skeletoning the stages past the burst", async () => {
    await render(<BlocksGalleryScreen />);

    const live = BLOCKS.slice(0, BLOCK_STAGE_SCHEDULE.initialBurst);
    const deferred = BLOCKS.slice(BLOCK_STAGE_SCHEDULE.initialBurst);
    expect(deferred.length).toBeGreaterThan(0);

    for (const entry of BLOCKS) {
      // Chrome first: the label and the recipe strip don't wait for the stage.
      expect(screen.getByTestId(`block-card-${entry.id}`)).toBeTruthy();
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
    for (const entry of live) {
      expect(screen.queryByTestId(`block-card-skeleton-${entry.id}`)).toBeNull();
    }
    for (const entry of deferred) {
      expect(screen.getByTestId(`block-card-skeleton-${entry.id}`)).toBeTruthy();
    }
  });

  it("streams every stage in once the frames run", async () => {
    await render(<BlocksGalleryScreen />);

    const frames = Math.ceil(
      (BLOCKS.length - BLOCK_STAGE_SCHEDULE.initialBurst) /
        BLOCK_STAGE_SCHEDULE.batchSize,
    );
    await flushFrames(frames);

    for (const entry of BLOCKS) {
      expect(screen.queryByTestId(`block-card-skeleton-${entry.id}`)).toBeNull();
    }
    // Strings owned by the block components themselves — the live content that
    // `galleries.test.tsx` asserts on the arrival path.
    expect(screen.getByText("Ship your next screen in an afternoon")).toBeTruthy();
    expect(screen.getByText("Common questions")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// The arrival path, in this file's own mock environment
// ---------------------------------------------------------------------------

/**
 * `galleries.test.tsx` owns the real version of this assertion. It is repeated
 * here so both paths are compared under ONE set of mocks: if a future change made
 * the deferral depend on something other than route identity, the suites above
 * would still pass while these tests caught it.
 */
describe("on the route the visitor arrived on (SSR / hydration render)", () => {
  it("mounts every preview and never skeletons a card", async () => {
    const { resetClientNavigationForTests } = require("@/client/lib/clientNavigation");
    resetClientNavigationForTests();
    // Entry pathname == the pathname the screen renders for: exactly what the
    // hydration render of a direct load sees.
    recordPathname("/");

    await render(<ComponentsGalleryScreen />);

    for (const entry of COMPONENTS) {
      expect(screen.getByTestId(`component-card-${entry.id}`)).toBeTruthy();
      expect(screen.queryByTestId(`component-card-skeleton-${entry.id}`)).toBeNull();
    }
  });

  it("mounts every block stage on the first render", async () => {
    const { resetClientNavigationForTests } = require("@/client/lib/clientNavigation");
    resetClientNavigationForTests();
    recordPathname("/");

    await render(<BlocksGalleryScreen />);

    for (const entry of BLOCKS) {
      expect(screen.queryByTestId(`block-card-skeleton-${entry.id}`)).toBeNull();
    }
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("mounts every preview when the root layout has recorded nothing yet", async () => {
    // Belt and braces for the worst case the old flag got wrong: a leaf that
    // renders before anything upstream recorded a pathname must still render
    // the complete tree.
    const { resetClientNavigationForTests } = require("@/client/lib/clientNavigation");
    resetClientNavigationForTests();

    await render(<ComponentsGalleryScreen />);

    for (const entry of COMPONENTS) {
      expect(screen.queryByTestId(`component-card-skeleton-${entry.id}`)).toBeNull();
    }
  });
});
