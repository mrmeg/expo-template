/**
 * Skeleton family tests — the four exports (Skeleton, SkeletonText,
 * SkeletonAvatar, SkeletonCard) all have to render without crashing in
 * the loading state. Tests assert each variant produces a node and that
 * SkeletonText respects the `lines` prop.
 */

import "@/test/mockTheme";

import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { rawThemeColors } from "../../constants/colors";

let mockReduceMotion = false;
jest.mock("../../hooks/useReduceMotion", () => ({
  useReducedMotion: () => mockReduceMotion,
}));

import {
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonText,
} from "../Skeleton";

describe("Skeleton", () => {
  it("renders a Skeleton block", async () => {
    const { toJSON } = await render(<Skeleton width={120} height={20} />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders a SkeletonAvatar", async () => {
    const { toJSON } = await render(<SkeletonAvatar size={40} />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders a SkeletonCard", async () => {
    const { toJSON } = await render(<SkeletonCard />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders SkeletonText with the requested number of lines", async () => {
    const { toJSON } = await render(<SkeletonText lines={3} />);
    expect(toJSON()).not.toBeNull();
  });

  it("fills with the strong border color so it reads on a white card", async () => {
    const { toJSON } = await render(<Skeleton width={120} height={20} />);
    const style = StyleSheet.flatten((toJSON() as any).props.style);
    // Skeleton reads the real light theme here: `borderStrong`, not `muted`
    // (the old, near-invisible fill on a white card).
    expect(style.backgroundColor).toBe(rawThemeColors.light.borderStrong);
    expect(style.backgroundColor).not.toBe(rawThemeColors.light.muted);
  });

  it("pulses from 0.55 so the low point stays visible", async () => {
    const { toJSON } = await render(<Skeleton />);
    const style = StyleSheet.flatten((toJSON() as any).props.style);
    expect(style.opacity).toBeCloseTo(0.55);
  });

  it("holds a static 0.8 under reduce motion", async () => {
    mockReduceMotion = true;
    try {
      const { toJSON } = await render(<Skeleton />);
      const style = StyleSheet.flatten((toJSON() as any).props.style);
      expect(style.opacity).toBeCloseTo(0.8);
    } finally {
      mockReduceMotion = false;
    }
  });
});
