/**
 * StyledText typography tests — web platform.
 *
 * `./forceWebPlatform` must be the first import: `constants/fonts.ts`
 * resolves its `fontFamilies` export once at module load (see the
 * export-time platform-keying comment there), so `Platform.OS` must already
 * be "web" before
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
import { useThemeStore } from "../../state/themeStore";

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
  ])("resolves fontWeight=%s to the shared Geist family plus numeric fontWeight=%s", async (weight, expectedNumericWeight) => {
    await render(<StyledText fontWeight={weight}>{weight}</StyledText>);

    const style = flattenTextStyle(weight);
    expect(style.fontFamily).toContain("Geist");
    expect(style.fontFamily).not.toMatch(/^Geist_/);
    expect(style.fontWeight).toBe(expectedNumericWeight);
  });

  describe("eyebrow treatment", () => {
    afterEach(() => {
      useThemeStore.getState().setTreatments({});
    });

    it('"sentence" (default) is 13 medium with no transform or tracking on web too', async () => {
      await render(<EyebrowText>Section label</EyebrowText>);

      const style = flattenTextStyle("Section label");
      expect(style.textTransform).toBeUndefined();
      expect(style.letterSpacing).toBe(0);
      expect(style.fontSize).toBe(13);
      expect(style.fontWeight).toBe("500");
    });

    it('"uppercase" uppercases and widely tracks the eyebrow variant on web too', async () => {
      useThemeStore.getState().setTreatments({ eyebrow: "uppercase" });
      await render(<EyebrowText>section label</EyebrowText>);

      const style = flattenTextStyle("section label");
      expect(style.textTransform).toBe("uppercase");
      expect(style.letterSpacing).toBe(0.96);
      expect(style.fontWeight).toBe("600");
    });
  });
});

describe("StyledText sans preset (web)", () => {
  afterEach(() => {
    useThemeStore.getState().setSansPreset("geist");
  });

  it("renders the Inter stack with numeric weight once the inter preset is on", async () => {
    useThemeStore.getState().setSansPreset("inter");
    await render(<StyledText fontWeight="medium">classic</StyledText>);

    const style = flattenTextStyle("classic");
    expect(style.fontFamily).toContain("\"Inter\"");
    expect(style.fontFamily).not.toContain("Geist");
    expect(style.fontWeight).toBe("500");
  });
});
