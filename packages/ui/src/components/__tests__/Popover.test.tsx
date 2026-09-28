/**
 * PopoverContent surface, placement and scroll body.
 *
 * The primitive is mocked inline (as in overlayContentBounds.test.tsx), with a
 * Content that forwards every prop and a root context whose measured trigger
 * frame and content layout each test sets, standing in for what the real
 * primitive reports once the trigger is pressed.
 */

import React from "react";
import { Dimensions, Platform, StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverTriggerRef,
} from "../Popover";
import { spacing } from "../../constants/spacing";
import { POPOVER_MIN_CAP, resolvePopoverPlacement } from "../../lib/popoverPlacement";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { colors: { popover: "#FFFFFF", border: "#E2E8F0" } },
    getShadowStyle: () => ({}),
    getContrastingColor: (_bg: string, fg: string) => fg,
  }),
}));

jest.mock("react-native-screens", () => ({
  FullWindowOverlay: ({ children }: any) => <>{children}</>,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));

let mockRootContext: {
  open: boolean;
  triggerPosition: { pageX: number; pageY: number; width: number; height: number } | null;
  contentLayout: { x: number; y: number; width: number; height: number } | null;
} = { open: true, triggerPosition: null, contentLayout: null };

jest.mock("@rn-primitives/popover", () => {
  const ReactLib = require("react");
  const { View, Pressable } = require("react-native");
  const Trigger = ReactLib.forwardRef(({ children, ...props }: any, ref: any) => {
    ReactLib.useImperativeHandle(ref, () => ({ open: () => {}, close: () => {} }));
    return <Pressable {...props}>{children}</Pressable>;
  });
  return {
    Root: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Trigger,
    Portal: ({ children }: any) => <>{children}</>,
    Overlay: ({ children, style }: any) => (
      <View testID="overlay" style={style}>
        {children}
      </View>
    ),
    Content: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useRootContext: () => mockRootContext,
  };
});

const SAFE_AREA = { top: 47, right: 0, bottom: 34, left: 0 };
const flat = (style: unknown) => StyleSheet.flatten(style as any) ?? {};

function renderContent(props: Partial<React.ComponentProps<typeof PopoverContent>> = {}) {
  return render(
    <Popover>
      <PopoverContent testID="content" {...props}>
        <Text>Row</Text>
      </PopoverContent>
    </Popover>,
  );
}

beforeEach(() => {
  mockRootContext = { open: true, triggerPosition: null, contentLayout: null };
});

describe("PopoverContent surface", () => {
  it("merges a caller style over the themed surface instead of replacing it", async () => {
    await renderContent({ style: { padding: 16 } });

    expect(flat(screen.getByTestId("content").props.style)).toMatchObject({
      backgroundColor: "#FFFFFF",
      borderColor: "#E2E8F0",
      borderWidth: 1,
      borderRadius: spacing.radiusMd,
      padding: 16,
    });
  });

  it("defaults insets to the safe area and lets a caller's insets win", async () => {
    await renderContent();
    expect(screen.getByTestId("content").props.insets).toEqual(SAFE_AREA);

    await renderContent({ insets: { top: 5, bottom: 6 } });
    expect(screen.getByTestId("content").props.insets).toEqual({ top: 5, bottom: 6 });
  });
});

describe("PopoverContent on native", () => {
  it("claims no presses, with the Overlay behind the card rather than around it", async () => {
    await renderContent();

    const content = screen.getByTestId("content");
    expect(content.props.onStartShouldSetResponder()).toBe(false);

    const overlay = screen.getByTestId("overlay");
    for (let node = content.parent; node; node = node.parent) {
      expect(node).not.toBe(overlay);
    }
  });

  it("flips to the side with room once the natural height is measured, and caps to it", async () => {
    const screenHeight = Dimensions.get("screen").height;
    const trigger = { pageX: 0, pageY: screenHeight - 200, width: 100, height: 40 };
    mockRootContext = {
      open: true,
      triggerPosition: trigger,
      contentLayout: { x: 0, y: 0, width: 300, height: 150 },
    };
    const sideOffset = 4;
    const roomBelow = screenHeight - SAFE_AREA.bottom - (trigger.pageY + trigger.height + sideOffset);
    const roomAbove = trigger.pageY - sideOffset - SAFE_AREA.top;

    await renderContent();
    // Not measured yet: the requested side, capped, and hidden until it may flip.
    let content = screen.getByTestId("content");
    expect(content.props.side).toBe("bottom");
    expect(flat(content.props.style)).toMatchObject({ maxHeight: roomBelow, opacity: 0 });

    // Card chrome 10 (150 laid out − 140 scroll frame) + 600 of content.
    const scroll = screen.getByTestId("content-scroll");
    await fireEvent(scroll, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 140 } } });
    await fireEvent(scroll, "contentSizeChange", 300, 600);

    content = screen.getByTestId("content");
    expect(content.props.side).toBe("top");
    expect(flat(content.props.style).maxHeight).toBe(roomAbove);
    expect(flat(content.props.style)).not.toHaveProperty("opacity");
  });

  it("with scrollable={false} renders no ScrollView and caps without holding the frame", async () => {
    const screenHeight = Dimensions.get("screen").height;
    const trigger = { pageX: 0, pageY: 100, width: 100, height: 40 };
    mockRootContext = { open: true, triggerPosition: trigger, contentLayout: null };

    await renderContent({ scrollable: false });

    expect(screen.queryByTestId("content-scroll")).toBeNull();
    const style = flat(screen.getByTestId("content").props.style);
    expect(style.maxHeight).toBe(screenHeight - SAFE_AREA.bottom - (100 + 40 + 4));
    expect(style).not.toHaveProperty("opacity");
  });
});

describe("PopoverContent on web", () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("caps its size to the room Radix measures and leaves presses to Radix", async () => {
    Platform.OS = "web";
    await renderContent();

    const content = screen.getByTestId("content");
    expect(flat(content.props.style)).toMatchObject({
      maxWidth: "var(--radix-popover-content-available-width)",
      maxHeight: "var(--radix-popover-content-available-height)",
    });
    expect(content.props.onStartShouldSetResponder).toBeUndefined();
  });
});

describe("PopoverTrigger", () => {
  it("types and forwards its ref", async () => {
    const ref = React.createRef<PopoverTriggerRef>();
    await render(
      <Popover>
        <PopoverTrigger ref={ref}>
          <Text>Open</Text>
        </PopoverTrigger>
      </Popover>,
    );

    expect(typeof ref.current?.open).toBe("function");
    expect(typeof ref.current?.close).toBe("function");
  });
});

describe("resolvePopoverPlacement", () => {
  const base = {
    side: undefined,
    sideOffset: 4,
    trigger: { pageY: 400, height: 40 },
    screenHeight: 800,
    insets: { top: 50, bottom: 30 },
    naturalHeight: 100,
    avoidCollisions: true,
  } as const;
  // Room above: 400 − 4 − 50 = 346. Room below: 800 − 30 − (400 + 40 + 4) = 326.

  it("keeps the requested side when the content fits there", () => {
    expect(resolvePopoverPlacement(base)).toEqual({ side: "bottom", maxHeight: 326 });
    expect(resolvePopoverPlacement({ ...base, side: "top" })).toEqual({ side: "top", maxHeight: 346 });
  });

  it("flips when the content is too tall and the other side has more room", () => {
    expect(resolvePopoverPlacement({ ...base, naturalHeight: 340 })).toEqual({ side: "top", maxHeight: 346 });
  });

  it("takes the side with more room when the content fits neither", () => {
    expect(resolvePopoverPlacement({ ...base, side: "top", naturalHeight: 500 })).toEqual({
      side: "top",
      maxHeight: 346,
    });
    expect(resolvePopoverPlacement({ ...base, naturalHeight: 500 })).toEqual({ side: "top", maxHeight: 346 });
  });

  it("never caps below the floor", () => {
    const cramped = { ...base, trigger: { pageY: 700, height: 40 } }; // room below: 26
    expect(resolvePopoverPlacement({ ...cramped, side: "bottom", naturalHeight: 20 })).toEqual({
      side: "bottom",
      maxHeight: POPOVER_MIN_CAP,
    });
  });

  it("neither flips nor caps with avoidCollisions false or before the trigger is measured", () => {
    expect(resolvePopoverPlacement({ ...base, avoidCollisions: false, naturalHeight: 900 })).toEqual({
      side: "bottom",
      maxHeight: undefined,
    });
    expect(resolvePopoverPlacement({ ...base, trigger: null })).toEqual({
      side: "bottom",
      maxHeight: undefined,
    });
  });

  it("caps the requested side without flipping while the natural height is unknown", () => {
    expect(resolvePopoverPlacement({ ...base, naturalHeight: undefined })).toEqual({
      side: "bottom",
      maxHeight: 326,
    });
  });
});
