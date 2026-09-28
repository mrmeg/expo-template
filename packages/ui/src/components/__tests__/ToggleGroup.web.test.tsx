/**
 * ToggleGroup ARIA on web. `./forceWebPlatform` must be the first import.
 *
 * `@rn-primitives/toggle-group`'s web Item renders `role='button'` and then
 * spreads the kit's props, while Radix adds `aria-checked` for a single-select
 * group — `aria-checked` is not allowed on a button (WCAG 4.1.2). The kit must
 * hand the primitive an explicit `role` so the DOM reads `radio` inside a
 * `radiogroup` for `type="single"`; a multiple group keeps buttons (Radix
 * gives those `aria-pressed`).
 */
import "./forceWebPlatform";
import "@/test/mockTheme";

import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

const mockItemProps: Array<Record<string, unknown>> = [];
const mockRootProps: Array<Record<string, unknown>> = [];

jest.mock("@rn-primitives/toggle-group", () => {
  const actual = jest.requireActual("@rn-primitives/toggle-group");
  const ReactActual = require("react");
  return {
    ...actual,
    Root: (props: Record<string, unknown>) => {
      mockRootProps.push(props);
      return ReactActual.createElement(actual.Root, props);
    },
    Item: (props: Record<string, unknown>) => {
      mockItemProps.push(props);
      return ReactActual.createElement(actual.Item, props);
    },
  };
});

jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
}));

jest.mock("../../hooks/useScalePress", () => ({
  useScalePress: () => ({ animatedStyle: {}, pressHandlers: { onPressIn: jest.fn(), onPressOut: jest.fn() } }),
}));

import { ToggleGroup, ToggleGroupItem } from "../ToggleGroup";

describe("ToggleGroup on web", () => {
  beforeEach(() => {
    mockItemProps.length = 0;
    mockRootProps.length = 0;
  });

  it("renders single-select items as radios inside a radiogroup", async () => {
    await render(
      <ToggleGroup type="single" value="left" onValueChange={() => {}}>
        <ToggleGroupItem value="left"><Text>Left</Text></ToggleGroupItem>
        <ToggleGroupItem value="right"><Text>Right</Text></ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(mockItemProps).toHaveLength(2);
    for (const props of mockItemProps) expect(props.role).toBe("radio");
    expect(mockRootProps[0]?.role).toBe("radiogroup");
  });

  it("keeps multiple-select items as buttons (aria-pressed comes from the primitive)", async () => {
    await render(
      <ToggleGroup type="multiple" value={["bold"]} onValueChange={() => {}}>
        <ToggleGroupItem value="bold"><Text>Bold</Text></ToggleGroupItem>
        <ToggleGroupItem value="italic"><Text>Italic</Text></ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(mockItemProps).toHaveLength(2);
    for (const props of mockItemProps) expect(props.role).toBe("button");
    expect(mockRootProps[0]?.role).toBe("group");
  });
});
