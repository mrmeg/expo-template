/**
 * Item accessibility props — Android. A pressable row is one accessible
 * element with a label, custom actions and a test handle. `Platform.OS` is
 * flipped per test (same pattern as StyledText.android.test.tsx).
 */

import "@/test/mockTheme";

import React from "react";
import { Platform } from "react-native";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";

import { Item, ItemContent, ItemDescription, ItemTitle } from "../Item";

describe("Item accessibility props (android)", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(async () => {
    await cleanup();
    Platform.OS = originalOS;
  });

  it("names a pressable row and exposes its test handle", async () => {
    await render(
      <Item onPress={() => {}} accessibilityLabel="Ada Lovelace, Acme" testID="row-1">
        <ItemContent>
          <ItemTitle>Ada Lovelace</ItemTitle>
          <ItemDescription>Acme</ItemDescription>
        </ItemContent>
      </Item>,
    );

    const named = screen.getByLabelText("Ada Lovelace, Acme");
    expect(named).toBe(screen.getByTestId("row-1"));
    expect(named.props.accessibilityRole).toBe("button");
  });

  it("forwards custom accessibility actions", async () => {
    const onAccessibilityAction = jest.fn();
    const actions = [{ name: "open", label: "Open contact" }];
    await render(
      <Item
        onPress={() => {}}
        accessibilityLabel="Ada Lovelace, Acme"
        accessibilityActions={actions}
        onAccessibilityAction={onAccessibilityAction}
      >
        <ItemContent>
          <ItemTitle>Ada Lovelace</ItemTitle>
        </ItemContent>
      </Item>,
    );

    const named = screen.getByLabelText("Ada Lovelace, Acme");
    expect(named.props.accessibilityActions).toEqual(actions);
    await fireEvent(named, "accessibilityAction", { nativeEvent: { actionName: "open" } });
    expect(onAccessibilityAction).toHaveBeenCalledTimes(1);
    expect(onAccessibilityAction.mock.calls[0][0].nativeEvent.actionName).toBe("open");
  });
});
