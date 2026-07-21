/**
 * StyledText typography tests — native platform (jest-expo's default
 * Platform.OS is "ios"). Covers weight -> real Inter family resolution, the
 * per-size letter-spacing scale, and the eyebrow semantic variant.
 *
 * Web-specific weight resolution (numeric fontWeight on a shared "Inter"
 * family) is covered separately in StyledText.web.test.tsx — `fontFamilies`
 * resolves `Platform.OS` once at module load (see constants/fonts.ts), so a
 * web-scoped assertion needs a dedicated test file with Platform.OS set
 * before any import, not a runtime flip inside a test.
 */

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import {
  BodyText,
  CaptionText,
  DisplayText,
  EyebrowText,
  HeadingText,
  LabelText,
  StyledText,
  SubheadingText,
  TitleText,
  type FontWeight,
} from "../StyledText";

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

describe("StyledText typography", () => {
  describe("weight -> family resolution (native)", () => {
    it.each<[FontWeight, string]>([
      ["light", "Inter_400Regular"],
      ["regular", "Inter_400Regular"],
      ["medium", "Inter_500Medium"],
      ["semibold", "Inter_600SemiBold"],
      ["bold", "Inter_700Bold"],
    ])("resolves fontWeight=%s to the %s static file", async (weight, expectedFamily) => {
      await render(<StyledText fontWeight={weight}>{weight}</StyledText>);

      const style = flattenTextStyle(weight);
      expect(style.fontFamily).toBe(expectedFamily);
    });

    it("does not set a numeric fontWeight on native (the family alone carries the weight)", async () => {
      await render(<StyledText fontWeight="bold">Bold label</StyledText>);

      const style = flattenTextStyle("Bold label");
      expect(style.fontFamily).toBe("Inter_700Bold");
      expect(style.fontWeight).toBeUndefined();
    });

    it("defaults to the regular weight family when no weight is provided", async () => {
      await render(<StyledText>Default</StyledText>);

      const style = flattenTextStyle("Default");
      expect(style.fontFamily).toBe("Inter_400Regular");
    });

    it("uses Georgia for the serif variant regardless of requested weight", async () => {
      await render(<StyledText variant="serif" fontWeight="bold">Serif heading</StyledText>);

      const style = flattenTextStyle("Serif heading");
      expect(style.fontFamily).toBe("Georgia");
    });
  });

  describe("semantic variant weight mapping", () => {
    it.each<[React.ComponentType<any>, string, string]>([
      [TitleText, "Title copy", "Inter_600SemiBold"],
      [HeadingText, "Heading copy", "Inter_600SemiBold"],
      [SubheadingText, "Subheading copy", "Inter_500Medium"],
      [BodyText, "Body copy", "Inter_400Regular"],
      [CaptionText, "Caption copy", "Inter_400Regular"],
      [LabelText, "Label copy", "Inter_500Medium"],
    ])("%p resolves to %s", async (Component, text, expectedFamily) => {
      await render(<Component>{text}</Component>);

      const style = flattenTextStyle(text);
      expect(style.fontFamily).toBe(expectedFamily);
    });
  });

  describe("letter-spacing scale", () => {
    it.each<[string, number]>([
      ["xs", 0.11],
      ["sm", 0.06],
      ["base", 0],
      ["body", 0],
      ["lg", -0.09],
      ["xl", -0.22],
      ["xxl", -0.42],
      ["display", -0.68],
    ])("size=%s gets letterSpacing=%s", async (size, expected) => {
      await render(<StyledText size={size as any}>{size}</StyledText>);

      const style = flattenTextStyle(size);
      expect(style.letterSpacing).toBe(expected);
    });

    it("lets an explicit style letterSpacing win over the size-derived value", async () => {
      await render(
        <StyledText size="display" style={{ letterSpacing: 2 }}>
          Overridden
        </StyledText>
      );

      const style = flattenTextStyle("Overridden");
      expect(style.letterSpacing).toBe(2);
    });

    it("applies tight tracking to the display size used by DisplayText", async () => {
      await render(<DisplayText>Hero</DisplayText>);

      const style = flattenTextStyle("Hero");
      expect(style.letterSpacing).toBe(-0.68);
    });
  });

  describe("eyebrow semantic variant", () => {
    it("uppercases the rendered text style, applies wide positive tracking, and semibold weight", async () => {
      await render(<EyebrowText>section label</EyebrowText>);

      const style = flattenTextStyle("section label");
      expect(style.textTransform).toBe("uppercase");
      expect(style.letterSpacing).toBe(0.96);
      expect(style.fontFamily).toBe("Inter_600SemiBold");
    });

    it("uses the sm size for the eyebrow variant", async () => {
      await render(<EyebrowText>eyebrow</EyebrowText>);

      const style = flattenTextStyle("eyebrow");
      expect(style.fontSize).toBe(12);
    });

    it("is available directly on StyledText via semantic=\"eyebrow\"", async () => {
      await render(<StyledText semantic="eyebrow">inline eyebrow</StyledText>);

      const style = flattenTextStyle("inline eyebrow");
      expect(style.textTransform).toBe("uppercase");
      expect(style.letterSpacing).toBe(0.96);
    });

    it("does not uppercase non-eyebrow semantic variants", async () => {
      await render(<TitleText>Regular Title</TitleText>);

      const style = flattenTextStyle("Regular Title");
      expect(style.textTransform).toBeUndefined();
    });
  });
});
