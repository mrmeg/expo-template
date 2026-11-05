/**
 * Card under the `elevation` treatment, with the real `useTheme` (the other
 * Card tests mock it). "hairline" (default) leaves the 1px `border` to draw the
 * edge in dark; "layered" keeps the dual-layer shadow.
 */

import React from "react";
import { StyleSheet, Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { Card, CardContent } from "../Card";
import { colors } from "../../constants/colors";
import { useThemeStore } from "../../state/themeStore";

function cardStyle() {
  const node = screen.getByText("Body").parent!.parent!;
  return StyleSheet.flatten(node.props.style) as Record<string, unknown>;
}

function renderCard(scheme: "light" | "dark") {
  useThemeStore.setState({ userTheme: scheme, systemTheme: scheme, hasLoadedTheme: true });
  return render(
    <Card>
      <CardContent>
        <Text>Body</Text>
      </CardContent>
    </Card>,
  );
}

afterEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", treatmentOverrides: {} });
});

describe("Card elevation treatment", () => {
  it("hairline (default): 1px border plus a faint 1px shadow in light", async () => {
    await renderCard("light");
    expect(cardStyle()).toMatchObject({
      borderWidth: 1,
      borderColor: colors.light.colors.border,
      boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
    });
  });

  it("hairline (default): the 1px border alone, no shadow or highlight, in dark", async () => {
    await renderCard("dark");
    const style = cardStyle();
    expect(style).toMatchObject({ borderWidth: 1, borderColor: colors.dark.colors.border });
    expect(style.boxShadow).toBeUndefined();
  });

  it("layered: the dual-layer shadow, with the dark top highlight", async () => {
    useThemeStore.setState({ treatmentOverrides: { elevation: "layered" } });
    await renderCard("dark");
    const style = cardStyle();
    expect(style).toMatchObject({ borderWidth: 1 });
    expect(style.boxShadow).toBe(
      "inset 0px 1px 0px rgba(255, 255, 255, 0.05), " +
      "0px 1px 2px rgba(0, 0, 0, 0.4), " +
      "0px 8px 24px rgba(0, 0, 0, 0.35)",
    );
  });
});
