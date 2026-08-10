/**
 * Web navigation shell — breakpoint selection, drawer content, and
 * active-route highlighting.
 *
 * `useDimensions` is mocked with a width-driven fake: under jest the platform
 * is native, where the real hook returns `useWindowDimensions` and ignores
 * the SSR viewport context the web build resolves from — there is no way to
 * drive the real hook to a chosen width here. The fake computes its flags
 * from the REAL `SCREEN_SIZES` with the hook's own comparisons, so the
 * boundary tests still pin the spec's "rail when isLargeScreen (strict >
 * MEDIUM)" contract to the actual token.
 */
import React from "react";
import { Animated } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { SCREEN_SIZES } from "@mrmeg/expo-ui/hooks";

const mockViewport = { width: 1280, height: 900 };

jest.mock("@mrmeg/expo-ui/hooks", () => {
  const actual = jest.requireActual("@mrmeg/expo-ui/hooks");
  const sizes = actual.SCREEN_SIZES as { SMALL: number; MEDIUM: number };
  return {
    ...actual,
    useDimensions: () => {
      const { width, height } = mockViewport;
      return {
        width,
        height,
        orientation: width > height ? "landscape" : "portrait",
        isSmallScreen: width <= sizes.SMALL,
        isMediumScreen: width > sizes.SMALL && width <= sizes.MEDIUM,
        isLargeScreen: width > sizes.MEDIUM,
      };
    },
  };
});

import { DrawerNavContent } from "../DrawerNavContent";
import { WebNavShell } from "../WebNavShell";
import { NAV_DESTINATIONS } from "../navDestinations";
import {
  COMPONENT_CATEGORIES,
  COMPONENT_CATEGORY_LABELS,
} from "@/client/showcase/filters";
import {
  SCREEN_TEMPLATES,
  getBlockCount,
  getComponentCount,
} from "@/client/showcase/registry";

// The overlay drawer drives open/close through Animated; stub timing/parallel
// to settle synchronously (same idiom as packages/ui's Drawer.test.tsx) so a
// close finishes inside the same act() and the unmount assertions are
// deterministic — and nothing animates across the test boundary.
const realAnimated = {
  timing: Animated.timing,
  parallel: Animated.parallel,
};

beforeAll(() => {
  const settleSync = (value: Animated.Value, config: { toValue?: unknown }) => ({
    start: (cb?: (result: { finished: boolean }) => void) => {
      if (typeof config?.toValue === "number") {
        value.setValue(config.toValue);
      }
      cb?.({ finished: true });
    },
    stop: () => {},
    reset: () => {},
  });
  (Animated as unknown as { timing: unknown }).timing = settleSync;
  (Animated as unknown as { parallel: unknown }).parallel = (
    animations: Array<{ start?: () => void }>,
  ) => ({
    start: (cb?: (result: { finished: boolean }) => void) => {
      animations.forEach((a) => a?.start?.());
      cb?.({ finished: true });
    },
    stop: () => {},
  });
});

afterAll(() => {
  (Animated as unknown as { timing: unknown }).timing = realAnimated.timing;
  (Animated as unknown as { parallel: unknown }).parallel = realAnimated.parallel;
});

// Render portal + full-window-overlay content inline so the overlay drawer's
// tree is assertable without a host.
jest.mock("@rn-primitives/portal", () => ({
  Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PortalHost: () => null,
}));

jest.mock("react-native-screens", () => ({
  FullWindowOverlay: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Router mock — mutable pathname/params, and the REAL expo-router Slot behind
// `Link asChild` so the drawer rows exercise the same prop merge that broke
// array styles on web SSR (see linkPressableStyle.ts). Every recorded child
// style must therefore be a flat object.
// ---------------------------------------------------------------------------

const route: { pathname: string; params: { category?: string } } = {
  pathname: "/",
  params: {},
};

jest.mock("expo-router", () => {
  const React_ = require("react");
  const { Text } = require("react-native");
  const { Slot } = require("expo-router/build/ui/Slot");

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
      setParams: jest.fn(),
    }),
    useLocalSearchParams: () => route.params,
    useGlobalSearchParams: () => route.params,
    useSegments: () => [],
    usePathname: () => route.pathname,
    Link,
    Stack: { Screen: "Screen" },
    Redirect: "Redirect",
    __linkAsChildStyles: linkAsChildStyles,
  };
});

const linkAsChildStyles: { testID?: string; style: unknown }[] =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require("expo-router") as { __linkAsChildStyles: { testID?: string; style: unknown }[] })
    .__linkAsChildStyles;

function renderShellAt(width: number) {
  mockViewport.width = width;
  return render(
    <WebNavShell>
      <React.Fragment />
    </WebNavShell>,
  );
}

beforeEach(() => {
  route.pathname = "/";
  route.params = {};
  linkAsChildStyles.length = 0;
});

afterEach(() => {
  useThemeStore.getState().setTheme("light");
});

describe("WebNavShell breakpoint selection", () => {
  it("docks the rail on a desktop viewport", async () => {
    await renderShellAt(1280);

    expect(screen.getByTestId("web-nav-shell-rail")).toBeTruthy();
    expect(screen.getByTestId("web-nav-rail")).toBeTruthy();
    expect(screen.queryByTestId("web-nav-menu-button")).toBeNull();
    // The persistent rail's content is always mounted.
    expect(screen.getByTestId("drawer-nav-content")).toBeTruthy();
  });

  it("uses the top bar + overlay below the breakpoint", async () => {
    await renderShellAt(390);

    expect(screen.getByTestId("web-nav-shell-overlay")).toBeTruthy();
    expect(screen.getByTestId("web-nav-menu-button")).toBeTruthy();
    expect(screen.queryByTestId("web-nav-shell-rail")).toBeNull();
  });

  it("switches exactly at SCREEN_SIZES.MEDIUM (isLargeScreen is strict >)", async () => {
    const atBoundary = await renderShellAt(SCREEN_SIZES.MEDIUM);
    expect(screen.getByTestId("web-nav-shell-overlay")).toBeTruthy();
    await atBoundary.unmount();

    await renderShellAt(SCREEN_SIZES.MEDIUM + 1);
    expect(screen.getByTestId("web-nav-shell-rail")).toBeTruthy();
  });

  it("opens the overlay drawer from the menu button and closes on navigation", async () => {
    await renderShellAt(390);

    // Closed until asked for.
    expect(screen.queryByTestId("drawer-nav-content")).toBeNull();

    await fireEvent.press(screen.getByTestId("web-nav-menu-button"));
    expect(screen.getByTestId("drawer-nav-content")).toBeTruthy();

    // Any nav item press reports back through onNavigate and closes the drawer.
    await fireEvent.press(screen.getByTestId("drawer-nav-templates"));
    expect(screen.queryByTestId("drawer-nav-content")).toBeNull();
  });
});

describe("DrawerNavContent", () => {
  it.each(["light", "dark"] as const)(
    "renders the library nav with registry counts (%s)",
    async (scheme) => {
      useThemeStore.getState().setTheme(scheme);
      await render(<DrawerNavContent />);

      expect(screen.getByTestId("drawer-wordmark")).toBeTruthy();
      expect(screen.getByTestId("drawer-search")).toBeTruthy();
      expect(screen.getByTestId("drawer-theme-toggle")).toBeTruthy();

      // Counts come from the registries, never hardcoded copy.
      expect(screen.getByText(String(getComponentCount()))).toBeTruthy();
      expect(screen.getByText(String(getBlockCount()))).toBeTruthy();
      expect(screen.getByText(String(SCREEN_TEMPLATES.length))).toBeTruthy();

      // App destinations (Explore is the drawer's Overview, so it isn't repeated).
      for (const destination of NAV_DESTINATIONS) {
        if (destination.name === "index") continue;
        expect(screen.getByTestId(`drawer-nav-${destination.name}`)).toBeTruthy();
      }
    },
  );

  it("highlights exactly the active route", async () => {
    route.pathname = "/components";
    await render(<DrawerNavContent />);

    const selectedOf = (testID: string) =>
      screen.getByTestId(testID).props.accessibilityState?.selected;

    expect(selectedOf("drawer-nav-components")).toBe(true);
    expect(selectedOf("drawer-nav-overview")).toBe(false);
    expect(selectedOf("drawer-nav-blocks")).toBe(false);
    expect(selectedOf("drawer-nav-templates")).toBe(false);
    expect(selectedOf("drawer-nav-settings")).toBe(false);
  });

  it("treats a component detail page as still inside Components", async () => {
    route.pathname = "/components/Button";
    await render(<DrawerNavContent />);

    expect(
      screen.getByTestId("drawer-nav-components").props.accessibilityState?.selected,
    ).toBe(true);
  });

  it("marks Overview active only on the Explore index", async () => {
    await render(<DrawerNavContent />);

    expect(
      screen.getByTestId("drawer-nav-overview").props.accessibilityState?.selected,
    ).toBe(true);
    expect(
      screen.getByTestId("drawer-nav-components").props.accessibilityState?.selected,
    ).toBe(false);
  });

  it("shows the category section only on the components gallery", async () => {
    await render(<DrawerNavContent />);
    expect(screen.queryByTestId("drawer-category-nav")).toBeNull();
  });

  it("lists every component category with its count and highlights the param's", async () => {
    route.pathname = "/components";
    route.params = { category: "form" };
    await render(<DrawerNavContent />);

    expect(screen.getByTestId("drawer-category-nav")).toBeTruthy();
    for (const category of COMPONENT_CATEGORIES) {
      expect(screen.getByText(COMPONENT_CATEGORY_LABELS[category])).toBeTruthy();
    }
    expect(
      screen.getByTestId("drawer-category-form").props.accessibilityState?.selected,
    ).toBe(true);
    expect(
      screen.getByTestId("drawer-category-all").props.accessibilityState?.selected,
    ).toBe(false);
  });

  it("passes every Link asChild child a flat style object (linkPressableStyle contract)", async () => {
    route.pathname = "/components";
    await render(<DrawerNavContent />);

    expect(linkAsChildStyles.length).toBeGreaterThan(0);
    for (const { testID, style } of linkAsChildStyles) {
      expect({ testID, isArray: Array.isArray(style) }).toEqual({ testID, isArray: false });
    }
  });
});
