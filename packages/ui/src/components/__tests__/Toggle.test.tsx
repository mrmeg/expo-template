/**
 * Toggle component tests
 *
 * Covers pressed-state rendering plus the interaction-sweep additions: the
 * press-scale wiring (onPressIn/onPressOut composed with useScalePress) and
 * the web focus-visible ring gating, mirroring Button's existing test approach.
 */

import React from "react";
import { Platform, Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Toggle } from "../Toggle";

const mockScalePressIn = jest.fn();
const mockScalePressOut = jest.fn();

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#18181B",
        text: "#0F172A",
        border: "#E2E8F0",
      },
    },
    getContrastingColor: () => "#FFFFFF",
    withAlpha: (color: string) => color,
    // Real-shaped focus ring so focused/unfocused states are distinguishable,
    // mirroring the real useTheme's web-only boxShadow ring.
    getFocusRingStyle: () => ({ boxShadow: "0 0 0 2px #fff, 0 0 0 4px #000" }),
  }),
}));

jest.mock("../../hooks/useScalePress", () => ({
  useScalePress: () => ({
    animatedStyle: {},
    pressHandlers: {
      onPressIn: mockScalePressIn,
      onPressOut: mockScalePressOut,
    },
    scale: { value: 1 },
  }),
}));

describe("Toggle", () => {
  beforeEach(() => {
    mockScalePressIn.mockClear();
    mockScalePressOut.mockClear();
  });

  it("renders unpressed and pressed states", async () => {
    const { rerender } = await render(
      <Toggle pressed={false} onPressedChange={() => {}}>
        <Text>Bold</Text>
      </Toggle>
    );

    expect(screen.getByRole("switch").props.accessibilityState.selected).toBe(false);

    await rerender(
      <Toggle pressed={true} onPressedChange={() => {}}>
        <Text>Bold</Text>
      </Toggle>
    );

    expect(screen.getByRole("switch").props.accessibilityState.selected).toBe(true);
  });

  it("calls onPressedChange when pressed", async () => {
    const onPressedChange = jest.fn();

    await render(
      <Toggle pressed={false} onPressedChange={onPressedChange}>
        <Text>Bold</Text>
      </Toggle>
    );

    await fireEvent.press(screen.getByRole("switch"));

    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it("wires press-in and press-out to the scale-press handlers", async () => {
    await render(
      <Toggle pressed={false} onPressedChange={() => {}}>
        <Text>Bold</Text>
      </Toggle>
    );

    const toggle = screen.getByRole("switch");
    await fireEvent(toggle, "pressIn");
    await fireEvent(toggle, "pressOut");

    expect(mockScalePressIn).toHaveBeenCalledTimes(1);
    expect(mockScalePressOut).toHaveBeenCalledTimes(1);
  });

  it("does not call onPressedChange when disabled", async () => {
    const onPressedChange = jest.fn();

    await render(
      <Toggle pressed={false} onPressedChange={onPressedChange} disabled>
        <Text>Bold</Text>
      </Toggle>
    );

    await fireEvent.press(screen.getByRole("switch"));

    expect(onPressedChange).not.toHaveBeenCalled();
  });

  describe("web focus ring", () => {
    const originalPlatform = Platform.OS;

    beforeAll(() => {
      Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    });

    afterAll(() => {
      Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
    });

    it("shows the focus ring on focus-visible and hides it on blur", async () => {
      await render(
        <Toggle pressed={false} onPressedChange={() => {}}>
          <Text>Bold</Text>
        </Toggle>
      );

      const toggle = screen.getByRole("switch");
      const matches = jest.fn(() => true);

      await fireEvent(toggle, "focus", { nativeEvent: { target: { matches } } });
      expect(screen.getByRole("switch").props.style.boxShadow).toBeDefined();

      await fireEvent(toggle, "blur", {});
      expect(screen.getByRole("switch").props.style.boxShadow).toBeUndefined();
    });

    it("does not show the focus ring for a non-keyboard (pointer) focus", async () => {
      await render(
        <Toggle pressed={false} onPressedChange={() => {}}>
          <Text>Bold</Text>
        </Toggle>
      );

      const toggle = screen.getByRole("switch");
      const matches = jest.fn(() => false);

      await fireEvent(toggle, "focus", { nativeEvent: { target: { matches } } });
      expect(screen.getByRole("switch").props.style.boxShadow).toBeUndefined();
    });
  });
});

describe("Toggle icon-only naming", () => {
  // The dev warning fires once per module load; this file renders no other
  // unnamed icon-only toggle, so the named case runs first to prove it stays
  // quiet, then the unnamed case proves it fires exactly once for two toggles.
  it("does not warn when the icon-only toggle is named", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await render(
      <Toggle pressed={false} onPressedChange={() => {}} iconOnly accessibilityLabel="Bold">
        <Text>B</Text>
      </Toggle>,
    );

    expect(warn.mock.calls.filter((args) => String(args[0]).includes("accessibilityLabel"))).toHaveLength(0);
    expect(screen.getByLabelText("Bold")).toBeTruthy();
    warn.mockRestore();
  });

  it("warns once in development when an icon-only toggle has no accessible name", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await render(
      <>
        <Toggle pressed={false} onPressedChange={() => {}} iconOnly><Text>★</Text></Toggle>
        <Toggle pressed onPressedChange={() => {}} iconOnly><Text>☆</Text></Toggle>
      </>,
    );

    const calls = warn.mock.calls.filter((args) => String(args[0]).includes("accessibilityLabel"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toMatch(/icon-only|iconOnly/);
    warn.mockRestore();
  });

  describe("hit target (native)", () => {
    it("keeps hitSlop on the primitive root and renders no web hit extender", async () => {
      await render(
        <Toggle pressed={false} onPressedChange={() => {}} accessibilityLabel="Bold">
          <Text>Bold</Text>
        </Toggle>
      );

      expect(screen.getByRole("switch").props.hitSlop).toBe(8);
      expect(screen.queryByTestId("hit-target", { includeHiddenElements: true })).toBeNull();
    });
  });
});
