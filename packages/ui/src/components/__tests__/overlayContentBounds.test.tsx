/**
 * Overlay content bounds tests
 *
 * `PopoverContent`, `DropdownMenuContent`, `SelectContent`, and
 * `TooltipContent` render `Overlay (absolute fill) > fade wrapper > Content`,
 * and the primitive Content is `position: absolute` against the screen. When
 * the fade wrapper had no style it laid out at zero size, so the card sat
 * outside its parent's bounds. Android dispatches ACTION_DOWN and accessibility
 * traversal only to children inside their parent's bounds, so native controls
 * (a React Native `Switch`) inside a popover ignored taps and the content was
 * missing from the accessibility tree. Root-caused in mindmap (carried there as
 * a bun patch on 0.24.0).
 *
 * Jest has no layout engine, so this locks the wrapper geometry instead of
 * simulating Android dispatch: every host View between the overlay and the
 * content must fill the overlay and pass touches through (`box-none`) so the
 * overlay's tap-away press still fires.
 */

import React from "react";
import { Switch } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { Popover, PopoverContent } from "../Popover";
import { DropdownMenu, DropdownMenuContent } from "../DropdownMenu";
import { Select, SelectContent } from "../Select";
import { Tooltip, TooltipContent } from "../Tooltip";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        foreground: "#0F172A",
        background: "#FFFFFF",
        popover: "#FFFFFF",
        popoverForeground: "#0F172A",
        text: "#111111",
        border: "#E2E8F0",
        input: "#E2E8F0",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        primary: "#18181B",
        accent: "#14B8A6",
        overlay: "rgba(0,0,0,0.5)",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
    getContrastingColor: (_bg: string, fg: string) => fg,
  }),
}));

jest.mock("react-native-screens", () => ({
  FullWindowOverlay: ({ children }: any) => <>{children}</>,
}));

// Each primitive is mocked down to the five members these Content components
// render: Root, Trigger, Portal (inline), Overlay (tagged so the test can find
// it), Content (forwards style and testID). The real Overlay/Content only mount
// while open; the mocks always mount, so no `open` state is needed.
function mockPrimitive() {
  const React = require("react");
  const { View, Pressable } = require("react-native");
  return {
    Root: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Trigger: ({ children, ...props }: any) => <Pressable {...props}>{children}</Pressable>,
    Portal: ({ children }: any) => <>{children}</>,
    Overlay: ({ children, style }: any) => (
      <View testID="overlay" style={style}>
        {children}
      </View>
    ),
    Content: ({ children, style, testID }: any) => (
      <View testID={testID} style={style}>
        {children}
      </View>
    ),
  };
}

jest.mock("@rn-primitives/popover", () => mockPrimitive());
jest.mock("@rn-primitives/dropdown-menu", () => mockPrimitive());
jest.mock("@rn-primitives/select", () => mockPrimitive());
jest.mock("@rn-primitives/tooltip", () => mockPrimitive());

const ABSOLUTE_FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

type Instance = ReturnType<typeof screen.getByTestId>;

/**
 * Host Views strictly between `content` and `overlay`, nearest first. RNTL's
 * tree holds host elements only, so every `.parent` step is a laid-out View.
 */
function hostWrappersBetween(content: Instance, overlay: Instance) {
  const wrappers: Instance[] = [];
  let node: Instance | null = content.parent;
  while (node && node !== overlay) {
    wrappers.push(node);
    node = node.parent;
  }
  if (node !== overlay) {
    throw new Error("content is not a descendant of the overlay");
  }
  return wrappers;
}

const control = <Switch testID="switch" value onValueChange={() => {}} />;

const cases: Array<[string, React.ReactElement]> = [
  [
    "PopoverContent",
    <Popover>
      <PopoverContent testID="content">{control}</PopoverContent>
    </Popover>,
  ],
  [
    "DropdownMenuContent",
    <DropdownMenu>
      <DropdownMenuContent testID="content">{control}</DropdownMenuContent>
    </DropdownMenu>,
  ],
  [
    "SelectContent",
    <Select>
      <SelectContent testID="content">{control}</SelectContent>
    </Select>,
  ],
  [
    "TooltipContent",
    <Tooltip>
      <TooltipContent testID="content">{control}</TooltipContent>
    </Tooltip>,
  ],
];

describe.each(cases)("%s", (_name, element) => {
  it("keeps the absolutely positioned content inside an overlay-filling wrapper", async () => {
    await render(element);

    const overlay = screen.getByTestId("overlay");
    const content = screen.getByTestId("content");

    // Precondition the fix relies on: the overlay itself spans the screen.
    expect(overlay).toHaveStyle(ABSOLUTE_FILL);

    const wrappers = hostWrappersBetween(content, overlay);
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      expect(wrapper).toHaveStyle(ABSOLUTE_FILL);
      expect(wrapper).toHaveProp("pointerEvents", "box-none");
    }

    // The case that broke: a natively handled control inside the content.
    expect(screen.getByTestId("switch")).toBeTruthy();
  });
});
