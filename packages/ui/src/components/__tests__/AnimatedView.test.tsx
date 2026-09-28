import "@/test/mockTheme";

import React from "react";
import { StyleSheet, Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { AnimatedView } from "../AnimatedView";

describe("AnimatedView", () => {
  it("folds a pointerEvents prop into style instead of forwarding the deprecated prop", async () => {
    await render(
      <AnimatedView type="fade" pointerEvents="box-none" testID="layer">
        <Text>content</Text>
      </AnimatedView>,
    );

    const layer = screen.getByTestId("layer");
    expect(layer.props.pointerEvents).toBeUndefined();
    expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ pointerEvents: "box-none" });
  });

  it("leaves style alone when no pointerEvents is given", async () => {
    await render(
      <AnimatedView type="fade" testID="layer">
        <Text>content</Text>
      </AnimatedView>,
    );

    expect(StyleSheet.flatten(screen.getByTestId("layer").props.style)).not.toHaveProperty("pointerEvents");
  });
});
