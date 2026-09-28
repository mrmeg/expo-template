/**
 * Slider on web: the `<input type="range">` from `@expo/ui` only honors
 * `accent-color`, and Chromium then paints the unfilled track dark in light
 * mode. The kit styles the track itself through CSS variables on the input
 * plus one hoisted stylesheet. `./forceWebPlatform` first.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { Slider } from "../Slider";

const colors = {
  accent: "#14B8A6",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  muted: "#F1F5F9",
  mutedForeground: "#64748B",
  textDim: "#666666",
  background: "#FFFFFF",
  card: "#FFFFFF",
  ring: "#0F172A",
};

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: { dark: false, colors },
    withAlpha: (c: string, a: number) => `rgba(${c},${a})`,
  }),
}));

jest.mock("@expo/ui/community/slider", () => {
  const { View } = require("react-native");
  return { Slider: (props: any) => <View testID="native-slider" {...props} /> };
});

type HostNode = { type: string; props: Record<string, any>; children?: (HostNode | string)[] | null };

function findHost(node: unknown, type: string): HostNode | undefined {
  const list = Array.isArray(node) ? node : [node];
  for (const item of list) {
    if (!item || typeof item === "string") continue;
    const host = item as HostNode;
    if (host.type === type) return host;
    const hit = findHost(host.children ?? [], type);
    if (hit) return hit;
  }
  return undefined;
}

describe("Slider (web)", () => {
  it("hands the input its fill percentage and theme track colors as CSS variables", async () => {
    await render(<Slider value={25} min={0} max={100} />);
    const style = StyleSheet.flatten(screen.getByTestId("native-slider").props.style) as Record<string, unknown>;
    expect(style["--expo-ui-slider-fill"]).toBe("25%");
    expect(style["--expo-ui-slider-track"]).toBe(colors.border);
    expect(style["--expo-ui-slider-active"]).toBe(colors.accent);
    expect(style["--expo-ui-slider-thumb"]).toBe(colors.accent);
  });

  it("clamps the fill to the range", async () => {
    await render(<Slider value={12} min={10} max={20} />);
    const style = StyleSheet.flatten(screen.getByTestId("native-slider").props.style) as Record<string, unknown>;
    expect(style["--expo-ui-slider-fill"]).toBe("20%");
  });

  it("mounts one hoistable stylesheet keyed by href", async () => {
    const { toJSON } = await render(<Slider value={50} />);
    const sheet = findHost(toJSON(), "style");
    expect(sheet?.props.href).toBe("expo-ui-slider");
    expect(sheet?.props.precedence).toBeTruthy();
    expect(String(sheet?.props.dangerouslySetInnerHTML?.__html)).toContain("--expo-ui-slider-track");
  });

  it("marks the wrapper so the stylesheet scopes to kit sliders only", async () => {
    await render(<Slider value={50} />);
    const wrapper = screen.getByTestId("native-slider").parent;
    expect(wrapper?.props.dataSet).toEqual({ expoUiSlider: "" });
  });
});
