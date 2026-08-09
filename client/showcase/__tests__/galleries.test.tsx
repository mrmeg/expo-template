/**
 * Gallery render smoke tests — Explore plus the three scale galleries.
 *
 * These are the first tests in the repo that mount an `app/` route file, which
 * is deliberate: each gallery's job is to turn a registry into a screen, and the
 * regression that matters is "a registry entry stopped rendering", not "a helper
 * returned the wrong array" (`filters.test.ts` covers that). Every screen is
 * rendered in **both** schemes so a `createStyles` factory that only resolves
 * light-theme colors fails here rather than in a screenshot.
 *
 * Every card renders a live component instance, so these tests pull in most of
 * `@mrmeg/expo-ui`. Three native `@expo/ui/community/*` modules are mocked
 * per-file (the global setup only intercepts the bare `@expo/ui` entry) and
 * `expo-clipboard` is mocked for the detail screen's copy button.
 */

import React from "react";
import { Pressable, View } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { colors } from "@mrmeg/expo-ui/constants";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import {
  BLOCKS,
  COMPONENTS,
  DEMOS,
  SCREEN_TEMPLATES,
} from "../registry";
import { COMPONENT_DETAILS } from "../details";
import {
  COMPONENT_CATEGORIES,
  COMPONENT_CATEGORY_DESCRIPTIONS,
  EXPLORE_RAIL_IDS,
  EXPLORE_TEMPLATE_PREVIEW_COUNT,
} from "../filters";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * `useLocalSearchParams` is a fixed `{}` in test/setup.ts, but the component
 * detail route is entirely driven by its `id` param. Re-declare the router mock
 * here with a mutable params object; everything else matches the global shape so
 * the two mocks stay interchangeable.
 */
const routeParams: { id?: string } = {};

jest.mock("expo-router", () => {
  const React_ = require("react");
  const { Text } = require("react-native");
  // The REAL slot expo-router renders for `asChild`, not a stand-in. It is what
  // decides whether a child's `style` survives the prop merge, and it's the
  // whole reason the "Link asChild style flattening" block below has teeth: a
  // hand-rolled passthrough would let these screens pass here while web SSR
  // serializes a broken style attribute (see that block for the mechanism).
  const { Slot } = require("expo-router/build/ui/Slot");

  /** Every `asChild` child's raw `style`, in render order. Reset per test. */
  const linkAsChildStyles: { testID?: string; style: unknown }[] = [];

  function Link({ asChild, href, children, ...rest }: Record<string, unknown> & {
    asChild?: boolean;
    children?: React.ReactNode;
  }) {
    if (asChild && React_.isValidElement(children)) {
      const { testID, style } = (
        children as React.ReactElement<{ testID?: string; style?: unknown }>
      ).props;
      linkAsChildStyles.push({ testID, style });
    }
    const Component = asChild ? Slot : Text;
    return React_.createElement(Component, rest, children);
  }

  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
    }),
    useLocalSearchParams: () => routeParams,
    useSegments: () => [],
    usePathname: () => "/",
    Link,
    Stack: { Screen: "Screen" },
    Redirect: "Redirect",
    __linkAsChildStyles: linkAsChildStyles,
  };
});

/** The recorder the mocked `Link` writes into. */
const linkAsChildStyles: { testID?: string; style: unknown }[] =
  require("expo-router").__linkAsChildStyles;

// jest-expo reports Platform.OS === "ios", so Slider / SegmentedControl /
// BottomSheet all route to their native @expo/ui community modules.
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

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

// Imported after the mocks so the screens resolve the mocked modules.
import ExploreScreen from "@/app/(main)/(tabs)/index";
import BlocksGalleryScreen from "@/app/(main)/(demos)/blocks/index";
import ComponentDetailScreen from "@/app/(main)/(demos)/components/[id]";
import ComponentsGalleryScreen from "@/app/(main)/(demos)/components/index";
import TemplatesGalleryScreen from "@/app/(main)/(demos)/templates/index";

// ---------------------------------------------------------------------------
// Scheme matrix
// ---------------------------------------------------------------------------

const SCHEMES = ["light", "dark"] as const;

function setScheme(scheme: (typeof SCHEMES)[number]) {
  useThemeStore.setState({ userTheme: scheme, systemTheme: scheme, colorOverrides: {} });
}

beforeEach(() => {
  setScheme("light");
  delete routeParams.id;
  linkAsChildStyles.length = 0;
});

afterEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", colorOverrides: {} });
});

// ---------------------------------------------------------------------------
// Every screen renders in both schemes
// ---------------------------------------------------------------------------

describe.each(SCHEMES)("galleries render (%s)", (scheme) => {
  beforeEach(() => {
    setScheme(scheme);
  });

  it("Explore shows all three scales and the demo list", async () => {
    await render(<ExploreScreen />);

    expect(screen.getByTestId("explore-screen")).toBeTruthy();
    expect(screen.getByTestId("explore-component-rail")).toBeTruthy();
    expect(screen.getByText("Components")).toBeTruthy();
    expect(screen.getByText("Blocks")).toBeTruthy();
    expect(screen.getByText("Templates")).toBeTruthy();
    expect(screen.getByText("Demos & Tools")).toBeTruthy();
  });

  it("components gallery renders one card per registered component", async () => {
    await render(<ComponentsGalleryScreen />);

    expect(screen.getByTestId("components-gallery")).toBeTruthy();
    for (const entry of COMPONENTS) {
      expect(screen.getByTestId(`component-card-${entry.id}`)).toBeTruthy();
    }
  });

  it("blocks gallery renders one live stage per registered block", async () => {
    await render(<BlocksGalleryScreen />);

    expect(screen.getByTestId("blocks-gallery")).toBeTruthy();
    for (const entry of BLOCKS) {
      expect(screen.getByTestId(`block-card-${entry.id}`)).toBeTruthy();
    }
  });

  it("templates gallery renders one card per registered template", async () => {
    await render(<TemplatesGalleryScreen />);

    expect(screen.getByTestId("templates-gallery")).toBeTruthy();
    for (const entry of SCREEN_TEMPLATES) {
      expect(screen.getByTestId(`template-card-${entry.id}`)).toBeTruthy();
    }
  });

  it("component detail renders a seeded component", async () => {
    routeParams.id = "Button";
    await render(<ComponentDetailScreen />);

    expect(screen.getByTestId("component-detail")).toBeTruthy();
    expect(screen.getByTestId("component-detail-variants")).toBeTruthy();
    expect(screen.getByTestId("component-detail-usage")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Explore
// ---------------------------------------------------------------------------

describe("Explore", () => {
  it("renders the rail in EXPLORE_RAIL_IDS order", async () => {
    await render(<ExploreScreen />);

    for (const id of EXPLORE_RAIL_IDS) {
      expect(screen.getByTestId(`explore-rail-${id}`)).toBeTruthy();
    }
  });

  it("shows counts from the registries, never hardcoded numbers", async () => {
    await render(<ExploreScreen />);

    expect(screen.getByLabelText(`All ${COMPONENTS.length} components`)).toBeTruthy();
    expect(screen.getByLabelText(`All ${BLOCKS.length} blocks`)).toBeTruthy();
    expect(screen.getByLabelText(`All ${SCREEN_TEMPLATES.length} templates`)).toBeTruthy();
  });

  it("previews only the first EXPLORE_TEMPLATE_PREVIEW_COUNT templates", async () => {
    await render(<ExploreScreen />);

    const previewed = SCREEN_TEMPLATES.slice(0, EXPLORE_TEMPLATE_PREVIEW_COUNT);
    const deferred = SCREEN_TEMPLATES.slice(EXPLORE_TEMPLATE_PREVIEW_COUNT);

    for (const entry of previewed) {
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
    // Everything else lives in the templates gallery.
    for (const entry of deferred) {
      expect(screen.queryByText(entry.description)).toBeNull();
    }
  });

  it("keeps the Pricing card in the previewed set (.maestro/templates.yml taps it)", async () => {
    await render(<ExploreScreen />);

    expect(screen.getByText("Pricing")).toBeTruthy();
    expect(screen.getByText("Plans & comparison")).toBeTruthy();
  });

  it("renders every demo row", async () => {
    await render(<ExploreScreen />);

    for (const demo of DEMOS) {
      expect(screen.getByText(demo.label)).toBeTruthy();
    }
  });

  it("replaces the scale sections with search results while typing", async () => {
    await render(<ExploreScreen />);

    await fireEvent.changeText(screen.getByTestId("explore-search"), "switch");

    expect(screen.getByTestId("explore-search-results")).toBeTruthy();
    expect(screen.getByTestId("explore-hit-component-Switch")).toBeTruthy();
    // The scale sections stand down while a query is active.
    expect(screen.queryByTestId("explore-component-rail")).toBeNull();
    expect(screen.queryByText("Demos & Tools")).toBeNull();
  });

  it("restores the scale sections when the query is cleared", async () => {
    await render(<ExploreScreen />);
    const field = screen.getByTestId("explore-search");

    await fireEvent.changeText(field, "switch");
    expect(screen.getByTestId("explore-search-results")).toBeTruthy();

    await fireEvent.changeText(field, "");
    expect(screen.getByTestId("explore-component-rail")).toBeTruthy();
    expect(screen.queryByTestId("explore-search-results")).toBeNull();
  });

  it("shows an empty state for a query that matches nothing", async () => {
    await render(<ExploreScreen />);

    await fireEvent.changeText(screen.getByTestId("explore-search"), "zzzzz");

    expect(screen.getByTestId("explore-search-empty")).toBeTruthy();
    expect(screen.queryByTestId("explore-search-results")).toBeNull();
  });

  it("finds hits across all three tiers from one query", async () => {
    await render(<ExploreScreen />);

    await fireEvent.changeText(screen.getByTestId("explore-search"), "hero");

    // `hero` is a block id and a template id; the badge is what tells them apart.
    expect(screen.getByTestId("explore-hit-block-hero")).toBeTruthy();
    expect(screen.getByTestId("explore-hit-template-hero")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Components gallery
// ---------------------------------------------------------------------------

describe("components gallery", () => {
  // Asserted via the section descriptions, not the labels: a label like "Form"
  // appears on both the chip and the heading, so it isn't a unique selector.
  it("groups every component under a category heading by default", async () => {
    await render(<ComponentsGalleryScreen />);

    for (const category of COMPONENT_CATEGORIES) {
      expect(screen.getByText(COMPONENT_CATEGORY_DESCRIPTIONS[category])).toBeTruthy();
    }
  });

  it("narrows the grid to one category when a chip is selected", async () => {
    await render(<ComponentsGalleryScreen />);

    await fireEvent.press(screen.getByTestId("components-chips-overlay"));

    expect(screen.getByTestId("component-card-Dialog")).toBeTruthy();
    expect(screen.queryByTestId("component-card-Button")).toBeNull();
    // The other headings go with their cards.
    expect(screen.getByText(COMPONENT_CATEGORY_DESCRIPTIONS.overlay)).toBeTruthy();
    expect(screen.queryByText(COMPONENT_CATEGORY_DESCRIPTIONS.form)).toBeNull();
  });

  it("returns to the full grid via the All chip", async () => {
    await render(<ComponentsGalleryScreen />);

    await fireEvent.press(screen.getByTestId("components-chips-overlay"));
    expect(screen.queryByTestId("component-card-Button")).toBeNull();

    await fireEvent.press(screen.getByTestId("components-chips-all"));
    expect(screen.getByTestId("component-card-Button")).toBeTruthy();
  });

  it("keeps the kitchen-sink showcase reachable from the header", async () => {
    await render(<ComponentsGalleryScreen />);
    expect(screen.getByTestId("components-kitchen-sink-link")).toBeTruthy();
  });

  it("shows the registry count, not a hardcoded one", async () => {
    await render(<ComponentsGalleryScreen />);
    expect(screen.getByText(`${COMPONENTS.length} components`)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Blocks gallery
// ---------------------------------------------------------------------------

describe("blocks gallery", () => {
  it("renders each block's live content, not a placeholder", async () => {
    await render(<BlocksGalleryScreen />);

    // Strings owned by the block components themselves.
    expect(screen.getByText("Ship your next screen in an afternoon")).toBeTruthy();
    expect(screen.getByText("Common questions")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
  });

  it("lists each block's recipe as links into the component detail", async () => {
    await render(<BlocksGalleryScreen />);

    const statRow = BLOCKS.find((block) => block.id === "stat-row");
    expect(statRow).toBeTruthy();

    // Scoped to the card: recipes overlap (several blocks use SectionHeader), so
    // the chip testIDs are only unique within a block.
    const card = within(screen.getByTestId("block-card-stat-row"));
    for (const componentId of statRow!.recipe) {
      expect(card.getByTestId(`recipe-chip-${componentId}`)).toBeTruthy();
    }
  });

  it("filters to one category via a chip", async () => {
    await render(<BlocksGalleryScreen />);

    await fireEvent.press(screen.getByTestId("blocks-chips-auth"));

    expect(screen.getByTestId("block-card-sign-in-form")).toBeTruthy();
    expect(screen.queryByTestId("block-card-hero")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Templates gallery
// ---------------------------------------------------------------------------

describe("templates gallery", () => {
  it("labels the All chip with the registry total", async () => {
    await render(<TemplatesGalleryScreen />);
    expect(screen.getByTestId("templates-chips-all")).toBeTruthy();
    expect(screen.getByText(String(SCREEN_TEMPLATES.length))).toBeTruthy();
  });

  it("filters to one category via a chip", async () => {
    await render(<TemplatesGalleryScreen />);

    await fireEvent.press(screen.getByTestId("templates-chips-marketing"));

    const marketing = SCREEN_TEMPLATES.filter((entry) => entry.category === "marketing");
    const rest = SCREEN_TEMPLATES.filter((entry) => entry.category !== "marketing");
    expect(marketing.length).toBeGreaterThan(0);

    for (const entry of marketing) {
      expect(screen.getByTestId(`template-card-${entry.id}`)).toBeTruthy();
    }
    for (const entry of rest) {
      expect(screen.queryByTestId(`template-card-${entry.id}`)).toBeNull();
    }
  });

  it("shows the registry id on each card so a folder is findable", async () => {
    await render(<TemplatesGalleryScreen />);
    expect(screen.getByText("detail-hero")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Component detail
// ---------------------------------------------------------------------------

describe("component detail", () => {
  // One case per seeded id rather than a loop inside one test: several previews
  // start RN Animated timings, and mounting ten screens in a single test leaves
  // those timers to fire across renders (which crashes the Animated native-driver
  // path under the test renderer). RNTL cleans up between tests.
  it.each(Object.keys(COMPONENT_DETAILS))("renders seeded variants for %s", async (id) => {
    routeParams.id = id;
    await render(<ComponentDetailScreen />);

    expect(screen.getByTestId("component-detail-variants")).toBeTruthy();
    expect(screen.getByTestId("component-detail-usage")).toBeTruthy();
  });

  it("falls back to the live preview for an unseeded component", async () => {
    const unseeded = COMPONENTS.find((entry) => !(entry.id in COMPONENT_DETAILS));
    expect(unseeded).toBeTruthy();
    routeParams.id = unseeded!.id;

    await render(<ComponentDetailScreen />);

    expect(screen.queryByTestId("component-detail-variants")).toBeNull();
    expect(screen.queryByTestId("component-detail-usage")).toBeNull();
    // The import line is the one thing every component gets.
    expect(screen.getByTestId("component-detail-import")).toBeTruthy();
  });

  it("shows the copyable import line for the requested component", async () => {
    routeParams.id = "Badge";
    await render(<ComponentDetailScreen />);

    expect(
      screen.getByText('import { Badge } from "@mrmeg/expo-ui/components/Badge";'),
    ).toBeTruthy();
  });

  it("copies the snippet to the clipboard", async () => {
    const Clipboard = require("expo-clipboard");
    routeParams.id = "Badge";
    await render(<ComponentDetailScreen />);

    await fireEvent.press(screen.getByTestId("component-detail-import-copy"));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'import { Badge } from "@mrmeg/expo-ui/components/Badge";',
    );
  });

  it("renders an empty state for an id that isn't in the registry", async () => {
    routeParams.id = "NotAComponent";
    await render(<ComponentDetailScreen />);

    expect(screen.getByTestId("component-detail-missing")).toBeTruthy();
    expect(screen.queryByTestId("component-detail")).toBeNull();
  });

  it("renders an empty state when no id is supplied at all", async () => {
    await render(<ComponentDetailScreen />);
    expect(screen.getByTestId("component-detail-missing")).toBeTruthy();
  });

  it("links on to the kitchen sink for the exhaustive demo", async () => {
    routeParams.id = "Button";
    await render(<ComponentDetailScreen />);
    expect(screen.getByTestId("component-detail-full-demo")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Link asChild style flattening
// ---------------------------------------------------------------------------

/**
 * Every `<Link asChild>` child must receive ONE flat style object.
 *
 * The bug this guards (found in a browser pass, invisible to the pre-fix version
 * of this file): `<Link asChild>` renders through `expo-router`'s `Slot`, which
 * is Radix's `Slot`, and Radix merges the child's props with
 *
 *     overrideProps.style = { ...slotStyle, ...childStyle }
 *
 * Spreading an **array** index-keys it — `[a, null]` becomes `{ 0: a, 1: null }`
 * — so the style collapses entirely. On web the SSR HTML then serializes
 * `style="0:[object Object];1:[object Object]"` and hydration throws
 * `TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'`,
 * unmounting the whole route to the error boundary. Every gallery here shipped
 * with `style={[styles.card, …]}` and every one of them was dead on web.
 *
 * Two layers, because either alone is escapable:
 *
 *  1. The mocked `Link` records each `asChild` child's **raw** style prop, so a
 *     new `[...]` literal fails no matter where in the tree it renders — no
 *     testID needed, nothing to keep in sync with the screens.
 *  2. The rendered host element is checked for the collapse's fingerprint
 *     (numeric keys) after the real `Slot` merge, which is the shape the DOM
 *     actually receives.
 *
 * `expo-router`'s `Slot` shim throws its own dev-mode error for an array-styled
 * child, so a regression *also* takes down the render above. That error is worth
 * having but is not the guard: it's `NODE_ENV !== "production"`-only, and the
 * message points at `Slot`, not at the call site.
 */
describe("Link asChild style flattening", () => {
  /** Mounts a screen, then reports every `asChild` child style it produced. */
  async function stylesFrom(element: React.ReactElement) {
    await render(element);
    expect(linkAsChildStyles.length).toBeGreaterThan(0);
    return linkAsChildStyles;
  }

  const SCREENS: [string, () => React.ReactElement][] = [
    ["Explore", () => <ExploreScreen />],
    ["components gallery", () => <ComponentsGalleryScreen />],
    ["blocks gallery", () => <BlocksGalleryScreen />],
    ["templates gallery", () => <TemplatesGalleryScreen />],
  ];

  describe.each(SCREENS)("%s", (_name, mount) => {
    it("passes a non-array style to every Link asChild child", async () => {
      const recorded = await stylesFrom(mount());

      const arrays = recorded.filter((entry) => Array.isArray(entry.style));
      expect(arrays.map((entry) => entry.testID ?? "(no testID)")).toEqual([]);
    });

    it("passes a plain object, not a Pressable style function", async () => {
      // A function-form style is legal for Pressable but not through the Slot:
      // spreading a function yields `{}`, silently dropping every rule.
      const recorded = await stylesFrom(mount());

      for (const entry of recorded) {
        expect(typeof entry.style).not.toBe("function");
      }
    });
  });

  it("covers the component detail screen, including the search-result rows", async () => {
    routeParams.id = "Button";
    const recorded = await stylesFrom(<ComponentDetailScreen />);

    for (const entry of recorded) {
      expect(Array.isArray(entry.style)).toBe(false);
    }
  });

  it("covers the detail screen's missing-component state", async () => {
    routeParams.id = "NotAComponent";
    const recorded = await stylesFrom(<ComponentDetailScreen />);

    for (const entry of recorded) {
      expect(Array.isArray(entry.style)).toBe(false);
    }
  });

  it("covers Explore's search-result rows, which only exist while querying", async () => {
    await render(<ExploreScreen />);
    linkAsChildStyles.length = 0;

    await fireEvent.changeText(screen.getByTestId("explore-search"), "hero");

    expect(linkAsChildStyles.length).toBeGreaterThan(0);
    for (const entry of linkAsChildStyles) {
      expect(Array.isArray(entry.style)).toBe(false);
    }
  });

  // Layer 2: the shape the host element ends up with after the real Slot merge.
  // `{ 0: {...}, 1: null }` is the exact serialization that killed hydration.
  it.each([
    ["explore-rail-Button", () => <ExploreScreen />, undefined],
    ["component-card-Button", () => <ComponentsGalleryScreen />, undefined],
    ["template-card-hero", () => <TemplatesGalleryScreen />, undefined],
    // Recipes overlap (Button is in three blocks), so this one needs a card scope.
    ["recipe-chip-Button", () => <BlocksGalleryScreen />, "block-card-hero"],
  ] as [string, () => React.ReactElement, string | undefined][])(
    "%s renders with no index-keyed style properties",
    async (testID, mount, scopeTestID) => {
      await render(mount());

      const scope = scopeTestID ? within(screen.getByTestId(scopeTestID)) : screen;
      const style = scope.getByTestId(testID).props.style as Record<string, unknown>;
      expect(Array.isArray(style)).toBe(false);
      expect(Object.keys(style).filter((key) => /^\d+$/.test(key))).toEqual([]);
    },
  );

  /**
   * The dark-mode symptom that made this visible: the detail screen's primary
   * CTA rendered with no fill. The `backgroundColor` lived in `styles.cta`, the
   * first entry of the array — the entry the collapse buries under key `"0"`,
   * where nothing reads it.
   */
  it("paints the detail CTA's primary fill in both schemes", async () => {
    for (const scheme of SCHEMES) {
      setScheme(scheme);
      routeParams.id = "Button";
      const view = await render(<ComponentDetailScreen />);

      const style = screen.getByTestId("component-detail-full-demo").props
        .style as Record<string, unknown>;
      expect(style.backgroundColor).toBe(colors[scheme].colors.primary);

      // RNTL 14's `unmount` is async; an un-awaited call leaves a dangling
      // `act` scope that breaks every render after it in the file.
      await view.unmount();
    }
  });

  /**
   * The helper is the fix, so it stays the documented route. A bare `[...]`
   * literal at one of these call sites is what regressed, and this is the cheap
   * source-level reminder that the flattening isn't optional.
   */
  it("routes every gallery through linkPressableStyle", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    const root = join(__dirname, "..", "..", "..");

    for (const file of [
      "app/(main)/(tabs)/index.tsx",
      "app/(main)/(demos)/components/index.tsx",
      "app/(main)/(demos)/components/[id].tsx",
      "app/(main)/(demos)/blocks/index.tsx",
      "app/(main)/(demos)/templates/index.tsx",
    ]) {
      expect(readFileSync(join(root, file), "utf8")).toContain("linkPressableStyle");
    }
  });

  // The regression's blast radius was "the whole route unmounts", so prove the
  // guard is wired to the real Slot rather than a permissive stand-in. The throw
  // is caught by a boundary here for the same reason it was in the browser: a
  // render-time throw takes the subtree with it.
  it("the real Slot rejects an array-styled child (why the mock uses it)", async () => {
    const { Slot } = require("expo-router/build/ui/Slot");
    const caught: Error[] = [];

    // React logs the caught error; silence it so a passing run stays quiet.
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <ErrorBoundary onError={(error) => caught.push(error)}>
        <Slot>
          <Pressable testID="array-styled" style={[{ padding: 4 }, null]} />
        </Slot>
      </ErrorBoundary>,
    );
    consoleError.mockRestore();

    expect(caught.map((error) => error.message)).toEqual([
      expect.stringContaining("array of styles"),
    ]);
    // The subtree is gone — the fallback rendered instead of the Pressable.
    expect(screen.queryByTestId("array-styled")).toBeNull();
    expect(screen.getByTestId("boundary-fallback")).toBeTruthy();
  });
});

/** Minimal boundary: records the error and renders a marker in place of the tree. */
class ErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? <View testID="boundary-fallback" /> : this.props.children;
  }
}
