/**
 * MaxWidthContainer on web: a custom `maxWidth` applies, a `preset` wins over
 * it, and with neither the width caps at the `2xl` preset.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { render } from "@testing-library/react-native";
import { MaxWidthContainer } from "../MaxWidthContainer";

jest.mock("../../hooks/useDimensions", () => ({
  useDimensions: () => ({ width: 2000, height: 1000 }),
}));

async function renderCap(props: Omit<React.ComponentProps<typeof MaxWidthContainer>, "children">) {
  const { toJSON } = await render(
    <MaxWidthContainer {...props}>
      <Text>child</Text>
    </MaxWidthContainer>,
  );
  const root = toJSON();
  if (!root || Array.isArray(root)) throw new Error("expected one root element");
  return StyleSheet.flatten(root.props.style as StyleProp<ViewStyle>)?.maxWidth;
}

describe("MaxWidthContainer", () => {
  it("applies a custom maxWidth", async () => {
    expect(await renderCap({ maxWidth: 960 })).toBe(960);
  });

  it("lets a preset win over maxWidth", async () => {
    expect(await renderCap({ maxWidth: 960, preset: "sm" })).toBe(640);
  });

  it("caps at the 2xl preset with neither", async () => {
    expect(await renderCap({})).toBe(1536);
  });
});
