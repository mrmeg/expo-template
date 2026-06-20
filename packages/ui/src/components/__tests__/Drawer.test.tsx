/**
 * Drawer component tests
 *
 * Covers the overlay (modal) variant's open/close wiring plus the rail variant:
 * a docked, always-mounted collapsible sidebar that never unmounts when
 * collapsed and floats over content when expanded.
 */

import React from "react";
import { Animated, Platform, StyleSheet, Text } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Drawer } from "../Drawer";

// The Drawer drives open/close (overlay) and width (rail) through Animated,
// whose timers would otherwise resolve after a test ends — firing setState on a
// torn-down tree and corrupting the next test's render. Stub timing/spring/
// parallel to settle synchronously (jumping each value straight to its target)
// so nothing animates across the test boundary. Animated.Value is left intact.
const realAnimated = {
  timing: Animated.timing,
  spring: Animated.spring,
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
  (Animated as unknown as { spring: unknown }).spring = settleSync;
  (Animated as unknown as { parallel: unknown }).parallel = (
    animations: Array<{ start?: () => void }>
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
  (Animated as unknown as { spring: unknown }).spring = realAnimated.spring;
  (Animated as unknown as { parallel: unknown }).parallel = realAnimated.parallel;
});

// Mock useTheme — must expose getShadowStyle, which the rail uses for elevation.
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        foreground: "#0F172A",
        background: "#FFFFFF",
        border: "#E2E8F0",
        overlay: "rgba(0,0,0,0.5)",
        primary: "#18181B",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

// useDimensions runs a web-only window.addEventListener effect that the
// jest-expo environment can't satisfy; the Drawer only needs a width number.
jest.mock("../../hooks/useDimensions", () => ({
  useDimensions: () => ({ width: 1024, height: 768 }),
}));

// Portal/overlay wrappers render children inline so overlay content is queryable.
jest.mock("@rn-primitives/portal", () => ({
  Portal: ({ children }: any) => <>{children}</>,
}));

jest.mock("react-native-screens", () => ({
  FullWindowOverlay: ({ children }: any) => <>{children}</>,
}));

describe("Drawer overlay variant", () => {
  it("opens via the trigger", async () => {
    const onOpenChange = jest.fn();
    await render(
      <Drawer open={false} onOpenChange={onOpenChange}>
        <Drawer.Trigger>
          <Text>Open</Text>
        </Drawer.Trigger>
        <Drawer.Content>
          <Drawer.Body>
            <Text>Body</Text>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    );

    fireEvent.press(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("renders its content while open and closes via the Close button", async () => {
    const onOpenChange = jest.fn();
    await render(
      <Drawer open onOpenChange={onOpenChange}>
        <Drawer.Content>
          <Drawer.Body>
            <Text>Menu body</Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close>
              <Text>Close</Text>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    );

    // Visible while open
    expect(screen.getByText("Menu body")).toBeTruthy();

    fireEvent.press(screen.getByText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when the backdrop is pressed", async () => {
    const onOpenChange = jest.fn();
    await render(
      <Drawer open onOpenChange={onOpenChange}>
        <Drawer.Content>
          <Drawer.Body>
            <Text>Menu body</Text>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    );

    // The backdrop sits inside a fade-in Animated.View that starts at opacity 0,
    // so it's "hidden" to default queries — include hidden elements to reach it.
    fireEvent.press(screen.getByLabelText("Close drawer", { includeHiddenElements: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Drawer rail variant", () => {
  it("renders a docked collapsed strip that stays mounted", async () => {
    await render(
      <Drawer variant="rail" collapsedWidth={72} expandedWidth={220}>
        <Drawer.Content>
          <Drawer.Body>
            <Text>Home</Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.ToggleCollapse>
              <Text>Toggle</Text>
            </Drawer.ToggleCollapse>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    );

    // Rail is docked & always mounted (no open/Portal gating): content is present
    // immediately even though nothing was "opened".
    expect(screen.getByText("Home")).toBeTruthy();
    // Collapsed → toggle advertises "Expand".
    expect(screen.getByLabelText("Expand sidebar")).toBeTruthy();
  });

  it("toggles expanded state via Drawer.ToggleCollapse", async () => {
    const onExpandedChange = jest.fn();
    await render(
      <Drawer variant="rail" expanded={false} onExpandedChange={onExpandedChange}>
        <Drawer.Content>
          <Drawer.Footer>
            <Drawer.ToggleCollapse>
              <Text>Toggle</Text>
            </Drawer.ToggleCollapse>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    );

    fireEvent.press(screen.getByLabelText("Expand sidebar"));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it("reflects the controlled expanded label", async () => {
    await render(
      <Drawer variant="rail" expanded onExpandedChange={jest.fn()}>
        <Drawer.Content>
          <Drawer.Footer>
            <Drawer.ToggleCollapse>
              <Text>Toggle</Text>
            </Drawer.ToggleCollapse>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    );

    // Expanded → toggle advertises "Collapse".
    expect(screen.getByLabelText("Collapse sidebar")).toBeTruthy();
  });

  it("grows the panel to expandedWidth when expanded (web)", async () => {
    const originalOS = Platform.OS;
    // Force the web layout path so width resolves to a plain number we can assert
    // (native animates an Animated.Value instead).
    Platform.OS = "web";
    try {
      const { rerender } = await render(
        <Drawer variant="rail" collapsedWidth={72} expandedWidth={220} expanded={false}>
          <Drawer.Content testID="rail-panel">
            <Drawer.Body>
              <Text>Home</Text>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      );

      const collapsedWidth = StyleSheet.flatten(
        screen.getByTestId("rail-panel").props.style
      ).width;
      expect(collapsedWidth).toBe(72);

      await rerender(
        <Drawer variant="rail" collapsedWidth={72} expandedWidth={220} expanded>
          <Drawer.Content testID="rail-panel">
            <Drawer.Body>
              <Text>Home</Text>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      );

      const expandedWidth = StyleSheet.flatten(
        screen.getByTestId("rail-panel").props.style
      ).width;
      expect(expandedWidth).toBe(220);
    } finally {
      Platform.OS = originalOS;
    }
  });

  it("keeps a toggle-pinned rail open after a hover ends (web)", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "web";
    try {
      await render(
        <Drawer variant="rail" collapsedWidth={72} expandedWidth={220} defaultExpanded={false}>
          <Drawer.Content testID="rail-panel">
            <Drawer.Header>
              <Drawer.ToggleCollapse>
                <Text>Toggle</Text>
              </Drawer.ToggleCollapse>
            </Drawer.Header>
          </Drawer.Content>
        </Drawer>
      );

      const panel = () => screen.getByTestId("rail-panel");
      const widthOf = () => StyleSheet.flatten(panel().props.style).width;

      // Pin open via the toggle.
      await act(async () => { fireEvent.press(screen.getByLabelText("Expand sidebar")); });
      expect(widthOf()).toBe(220);

      // A transient hover-in then hover-out must NOT collapse the pinned rail.
      // (fireEvent only maps standard RN events, so call the web hover handlers
      // directly inside an async act so the state update flushes.)
      await act(async () => { panel().props.onMouseEnter(); });
      await act(async () => { panel().props.onMouseLeave(); });
      expect(widthOf()).toBe(220);
    } finally {
      Platform.OS = originalOS;
    }
  });

  it("expands on hover and collapses on mouse leave when not pinned (web)", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "web";
    try {
      await render(
        <Drawer variant="rail" collapsedWidth={72} expandedWidth={220}>
          <Drawer.Content testID="rail-panel">
            <Drawer.Body>
              <Text>Home</Text>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      );

      const panel = () => screen.getByTestId("rail-panel");
      const widthOf = () => StyleSheet.flatten(panel().props.style).width;

      expect(widthOf()).toBe(72);
      await act(async () => { panel().props.onMouseEnter(); });
      expect(widthOf()).toBe(220);
      await act(async () => { panel().props.onMouseLeave(); });
      expect(widthOf()).toBe(72);
    } finally {
      Platform.OS = originalOS;
    }
  });
});
