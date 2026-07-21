/**
 * StyledText typography tests — web platform.
 *
 * `./forceWebPlatform` must be the first import: `constants/fonts.ts`
 * resolves its `fontFamilies` export once at module load (see the
 * SSR-safety comment there), so `Platform.OS` must already be "web" before
 * `StyledText` (and transitively `constants/fonts`) is imported. See
 * forceWebPlatform.ts for why a plain `Platform.OS = "web"` statement later
 * in this file — after those imports resolve — would be too late for
 * `fontFamilies`, even though it's early enough for StyledText's own
 * render-time `Platform.OS` check.
 *
 * Jest gives every test file its own module registry, so this doesn't leak
 * into other test files (which keep jest-expo's default `Platform.OS`,
 * "ios" — see StyledText.test.tsx).
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { EyebrowText, StyledText, type FontWeight } from "../StyledText";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: "#111111",
      },
    },
  }),
}));

function flattenTextStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;
}

describe("StyledText typography (web)", () => {
  it.each<[FontWeight, string]>([
    ["light", "400"],
    ["regular", "400"],
    ["medium", "500"],
    ["semibold", "600"],
    ["bold", "700"],
  ])("resolves fontWeight=%s to the shared Inter family plus numeric fontWeight=%s", async (weight, expectedNumericWeight) => {
    await render(<StyledText fontWeight={weight}>{weight}</StyledText>);

    const style = flattenTextStyle(weight);
    expect(style.fontFamily).toContain("Inter");
    expect(style.fontFamily).not.toMatch(/^Inter_/);
    expect(style.fontWeight).toBe(expectedNumericWeight);
  });

  it("uppercases and widely tracks the eyebrow variant on web too", async () => {
    await render(<EyebrowText>section label</EyebrowText>);

    const style = flattenTextStyle("section label");
    expect(style.textTransform).toBe("uppercase");
    expect(style.letterSpacing).toBe(0.96);
    expect(style.fontWeight).toBe("600");
  });
});
