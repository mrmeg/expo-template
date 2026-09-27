import "@/test/mockTheme";

import React from "react";
import { StyleSheet, Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { Screen } from "../Screen";
import { spacing } from "../../constants/spacing";

const ISLAND = { top: 59, bottom: 34, left: 0, right: 0 };

const withInsets = (node: React.ReactElement, insets = ISLAND) => (
  <SafeAreaInsetsContext.Provider value={insets}>{node}</SafeAreaInsetsContext.Provider>
);
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

describe("Screen", () => {
  it("pads the edges it owns with the window insets, plus the one horizontal screen inset", async () => {
    await render(withInsets(<Screen edges={["top", "bottom"]} testID="s"><Text>hi</Text></Screen>));
    expect(style("s")).toMatchObject({ paddingTop: 59, paddingBottom: 34, paddingLeft: spacing.screenPadding, paddingRight: spacing.screenPadding, flex: 1 });
  });

  it("never pads an edge it does not own (a Stack header already insets the top)", async () => {
    await render(withInsets(<Screen edges={["bottom"]} testID="s"><Text>hi</Text></Screen>));
    const s = style("s");
    expect(s.paddingTop).toBeUndefined();
    expect(s.paddingBottom).toBe(34);
  });

  it("adds the caller's padding to the inset instead of replacing it", async () => {
    await render(withInsets(<Screen edges={["bottom"]} contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: spacing.md }} testID="s"><Text>hi</Text></Screen>));
    expect(style("s")).toMatchObject({ paddingBottom: spacing.xxl + 34, paddingTop: spacing.md });
  });

  it("puts the padding on the ScrollView's content container when scrolling", async () => {
    await render(withInsets(<Screen edges={["top", "bottom"]} scroll testID="s"><Text>hi</Text></Screen>));
    const outer = style("s");
    expect(outer.paddingTop).toBeUndefined();
    const content = StyleSheet.flatten(screen.getByTestId("s").props.contentContainerStyle) as Record<string, unknown>;
    expect(content).toMatchObject({ paddingTop: 59, paddingBottom: 34, paddingLeft: spacing.screenPadding });
  });

  it("drops the horizontal inset for full-bleed rows and adds side insets only when named", async () => {
    await render(withInsets(<Screen edges={["left", "right"]} padded={false} testID="s"><Text>hi</Text></Screen>, { top: 0, bottom: 0, left: 44, right: 44 }));
    expect(style("s")).toMatchObject({ paddingLeft: 44, paddingRight: 44 });
    expect(style("s").paddingTop).toBeUndefined();
  });

  it("paints the theme background under the insets", async () => {
    await render(<Screen edges={[]} testID="s"><Text>hi</Text></Screen>);
    expect(style("s").backgroundColor).toBeTruthy();
  });
});
