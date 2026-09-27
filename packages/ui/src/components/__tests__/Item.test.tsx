/**
 * Item family tests — the grouped-list row (Item / ItemMedia / ItemContent /
 * ItemTitle / ItemDescription / ItemActions). Covers full composition,
 * the pressable row, and the optional separator.
 */

import "@/test/mockTheme";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "../Item";

describe("Item", () => {
  it("renders a full composition (media, title, description, actions)", async () => {
    await render(
      <Item>
        <ItemMedia icon="bell" />
        <ItemContent>
          <ItemTitle>Notifications</ItemTitle>
          <ItemDescription>Push, email, and SMS alerts</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ItemTitle>On</ItemTitle>
        </ItemActions>
      </Item>,
    );

    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Push, email, and SMS alerts")).toBeTruthy();
    expect(screen.getByText("On")).toBeTruthy();
  });

  it("renders arbitrary children in ItemMedia instead of an icon", async () => {
    await render(
      <Item>
        <ItemMedia>
          <ItemTitle>JD</ItemTitle>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Jane Doe</ItemTitle>
        </ItemContent>
      </Item>,
    );

    expect(screen.getByText("JD")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
  });

  it("fires onPress when the row is pressed", async () => {
    const onPress = jest.fn();
    await render(
      <Item onPress={onPress}>
        <ItemContent>
          <ItemTitle>Pressable row</ItemTitle>
        </ItemContent>
      </Item>,
    );

    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not pressable when onPress is omitted", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Static row</ItemTitle>
        </ItemContent>
      </Item>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders without crashing when separator is set", async () => {
    const { toJSON } = await render(
      <Item separator>
        <ItemContent>
          <ItemTitle>Row with separator</ItemTitle>
        </ItemContent>
      </Item>,
    );

    expect(toJSON()).not.toBeNull();
    expect(screen.getByText("Row with separator")).toBeTruthy();
  });
});

jest.mock("../../lib/haptics", () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
  hapticPress: jest.fn(),
}));

jest.mock("@rn-primitives/switch", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");
  return {
    Root: ({ checked, onCheckedChange, disabled, children, style, ...props }: any) => (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: !!checked, disabled: !!disabled }}
        onPress={() => !disabled && onCheckedChange?.(!checked)}
        disabled={disabled}
        style={style}
        {...props}
      >
        {children}
      </Pressable>
    ),
    Thumb: ({ style, ...props }: any) => <View style={style} {...props} />,
  };
});

const mockHydrated = jest.fn(() => true);
jest.mock("../../hooks/useHydrated", () => ({ useHydrated: () => mockHydrated() }));

// eslint-disable-next-line import/first -- the mocks above must be registered before these load
import { Platform, Text } from "react-native";
// eslint-disable-next-line import/first
import { Switch } from "../Switch";
// eslint-disable-next-line import/first
import { useItemLabel } from "../Item";

function LabelProbe() {
  const label = useItemLabel();
  return <Text testID="probe">{label ? `${label.titleId ?? ""}|${label.title ?? ""}` : "none"}</Text>;
}

describe("Item labels its trailing controls", () => {
  it("exposes the row title (and its id) to controls inside the row", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Public profile</ItemTitle>
          <ItemDescription>Let others find you</ItemDescription>
        </ItemContent>
        <ItemActions>
          <LabelProbe />
        </ItemActions>
      </Item>,
    );

    const [titleId, title] = screen.getByTestId("probe").props.children.split("|");
    expect(title).toBe("Public profile");
    expect(titleId).not.toBe("");
    expect(screen.getByText("Public profile").props.nativeID).toBe(titleId);
  });

  it("returns null outside a row", async () => {
    await render(<LabelProbe />);
    expect(screen.getByTestId("probe").props.children).toBe("none");
  });

  it("returns null in a row without an ItemTitle, so nothing points at a missing id", async () => {
    await render(
      <Item>
        <ItemMedia icon="bell" />
        <ItemActions>
          <LabelProbe />
        </ItemActions>
      </Item>,
    );
    expect(screen.getByTestId("probe").props.children).toBe("none");
  });

  it("links by id but passes no text for a composed title", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>{"Jane"} <ItemDescription>(you)</ItemDescription></ItemTitle>
        </ItemContent>
        <ItemActions>
          <LabelProbe />
        </ItemActions>
      </Item>,
    );
    const [titleId, title] = screen.getByTestId("probe").props.children.split("|");
    expect(titleId).not.toBe("");
    expect(title).toBe("");
  });

  it("names an unlabeled Switch after the row title on native", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Share analytics</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Switch checked onCheckedChange={() => {}} />
        </ItemActions>
      </Item>,
    );

    expect(screen.getByRole("switch").props.accessibilityLabel).toBe("Share analytics");
  });

  it("lets the control's own label win", async () => {
    await render(
      <Item>
        <ItemContent>
          <ItemTitle>Share analytics</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Switch checked onCheckedChange={() => {}} accessibilityLabel="Analytics sharing" />
        </ItemActions>
      </Item>,
    );

    expect(screen.getByRole("switch").props.accessibilityLabel).toBe("Analytics sharing");
  });

  describe("on web", () => {
    const originalOS = Platform.OS;
    beforeAll(() => {
      Platform.OS = "web";
    });
    afterAll(() => {
      Platform.OS = originalOS;
    });

    it("names the Switch after a plain-text title (aria-label via accessibilityLabel), no id needed", async () => {
      await render(
        <Item>
          <ItemContent>
            <ItemTitle>Public profile</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch checked onCheckedChange={() => {}} />
          </ItemActions>
        </Item>,
      );

      const control = screen.getByRole("switch");
      expect(control.props.accessibilityLabel).toBe("Public profile");
      expect(control.props["aria-labelledby"]).toBeUndefined();
    });

    it("links a composed title by id with aria-labelledby once hydrated", async () => {
      await render(
        <Item>
          <ItemContent>
            <ItemTitle>{"Jane"} <ItemDescription>(you)</ItemDescription></ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch checked onCheckedChange={() => {}} />
          </ItemActions>
        </Item>,
      );

      const control = screen.getByRole("switch");
      const titleId = screen.getByText(/Jane/).props.nativeID;
      expect(titleId).toBeTruthy();
      expect(control.props["aria-labelledby"]).toBe(titleId);
      expect(control.props.accessibilityLabel).toBeUndefined();
    });
  });

  describe("on web before hydration (server render and the hydration pass)", () => {
    const originalOS = Platform.OS;
    beforeEach(() => {
      Platform.OS = "web";
      mockHydrated.mockReturnValue(false);
    });
    afterEach(() => {
      Platform.OS = originalOS;
      mockHydrated.mockReturnValue(true);
    });

    it("emits no useId-based id or labelledby, but still names by title text", async () => {
      await render(
        <Item>
          <ItemContent>
            <ItemTitle>Public profile</ItemTitle>
          </ItemContent>
          <ItemActions>
            <LabelProbe />
            <Switch checked onCheckedChange={() => {}} />
          </ItemActions>
        </Item>,
      );

      const [titleId, title] = screen.getByTestId("probe").props.children.split("|");
      expect(title).toBe("Public profile");
      expect(titleId).toBe("");
      expect(screen.getByText("Public profile").props.nativeID).toBeUndefined();
      expect(screen.getByRole("switch").props.accessibilityLabel).toBe("Public profile");
    });
  });
});
