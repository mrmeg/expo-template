/**
 * Pressable Card and Item show the kit's focus ring on keyboard focus (web),
 * like Button does. `./forceWebPlatform` first, see that file.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet, Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Card } from "../Card";
import { Item, ItemContent, ItemTitle } from "../Item";

const RING = { boxShadow: "0 0 0 2px #fff, 0 0 0 4px ring" };

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: {
        card: "#fff",
        border: "#e5e5e5",
        muted: "#f4f4f5",
        mutedForeground: "#71717a",
        text: "#111",
        textDim: "#666",
        foreground: "#111",
      },
    },
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => RING,
  }),
}));

const keyboardFocus = { nativeEvent: { target: { matches: () => true } } };
const pointerFocus = { nativeEvent: { target: { matches: () => false } } };

const ringOn = (el: any) => StyleSheet.flatten(el.props.style)?.boxShadow === RING.boxShadow;

describe("pressable focus rings (web)", () => {
  it("Card shows the ring on keyboard focus and drops it on blur", async () => {
    await render(
      <Card onPress={() => {}}>
        <Text>Open</Text>
      </Card>,
    );
    const button = screen.getByRole("button");
    expect(ringOn(button)).toBe(false);
    await fireEvent(button, "focus", keyboardFocus);
    expect(ringOn(screen.getByRole("button"))).toBe(true);
    await fireEvent(screen.getByRole("button"), "blur", {});
    expect(ringOn(screen.getByRole("button"))).toBe(false);
  });

  it("Card keeps the ring hidden for pointer focus", async () => {
    await render(
      <Card onPress={() => {}}>
        <Text>Open</Text>
      </Card>,
    );
    await fireEvent(screen.getByRole("button"), "focus", pointerFocus);
    expect(ringOn(screen.getByRole("button"))).toBe(false);
  });

  it("Item shows the ring on keyboard focus", async () => {
    await render(
      <Item onPress={() => {}}>
        <ItemContent>
          <ItemTitle>Row</ItemTitle>
        </ItemContent>
      </Item>,
    );
    await fireEvent(screen.getByRole("button"), "focus", keyboardFocus);
    expect(ringOn(screen.getByRole("button"))).toBe(true);
  });

  it("a disabled Card never shows the ring", async () => {
    await render(
      <Card onPress={() => {}} disabled>
        <Text>Open</Text>
      </Card>,
    );
    await fireEvent(screen.getByRole("button"), "focus", keyboardFocus);
    expect(ringOn(screen.getByRole("button"))).toBe(false);
  });
});
