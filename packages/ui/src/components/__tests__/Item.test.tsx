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
