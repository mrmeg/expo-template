/**
 * StyledText font-override tests — web platform.
 *
 * Covers `setFonts`, the injection point that lets a host app forward its own
 * bundled faces instead of patching `node_modules`. See `constants/fonts.ts`
 * (`FontOverrides`) for the rationale.
 *
 * `./forceWebPlatform` must be the first import — see StyledText.web.test.tsx
 * for why `constants/fonts` needs `Platform.OS` settled before it loads. Web
 * is the interesting platform here because it is the only one where the
 * numeric-vs-family weight strategy is configurable.
 */
import "./forceWebPlatform";

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { StyledText, SerifText, type FontWeight } from "../StyledText";
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

/** Per-weight faces, as `expo-font` registers them on web and native alike. */
const HANKEN = {
  light: "HankenGrotesk_300Light",
  regular: "HankenGrotesk_400Regular",
  medium: "HankenGrotesk_500Medium",
  semibold: "HankenGrotesk_600SemiBold",
  bold: "HankenGrotesk_700Bold",
} as const;

function flattenTextStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;
}

describe("StyledText font overrides", () => {
  afterEach(() => {
    useThemeStore.getState().setFonts({});
  });

  it("defaults to the package faces when no override is set", async () => {
    await render(<StyledText fontWeight="bold">untouched</StyledText>);

    const style = flattenTextStyle("untouched");
    expect(style.fontFamily).toContain("Inter");
    // Package default on web is the numeric strategy.
    expect(style.fontWeight).toBe("700");
  });

  it.each<FontWeight>(["light", "regular", "medium", "semibold", "bold"])(
    "resolves %s to the injected per-weight family",
    async (weight) => {
      useThemeStore.getState().setFonts({
        families: { sansSerif: HANKEN },
        webWeightStrategy: "family",
      });

      await render(<StyledText fontWeight={weight}>{weight}</StyledText>);

      expect(flattenTextStyle(weight).fontFamily).toBe(HANKEN[weight]);
    },
  );

  it("suppresses the numeric fontWeight under the 'family' strategy", async () => {
    // The regression this API exists to prevent: emitting fontWeight 600 on
    // top of a family that is already the SemiBold face makes the renderer
    // synthesise a second layer of bold.
    useThemeStore.getState().setFonts({
      families: { sansSerif: HANKEN },
      webWeightStrategy: "family",
    });

    await render(<StyledText fontWeight="semibold">no faux bold</StyledText>);

    const style = flattenTextStyle("no faux bold");
    expect(style.fontFamily).toBe(HANKEN.semibold);
    expect(style.fontWeight).toBeUndefined();
  });

  it("keeps the numeric fontWeight when families are injected without a strategy", async () => {
    // An app shipping one multi-weight CSS family still wants numeric weights,
    // so overriding families alone must not change the strategy.
    useThemeStore.getState().setFonts({
      families: {
        sansSerif: {
          light: "Brand",
          regular: "Brand",
          medium: "Brand",
          semibold: "Brand",
          bold: "Brand",
        },
      },
    });

    await render(<StyledText fontWeight="bold">multi weight</StyledText>);

    const style = flattenTextStyle("multi weight");
    expect(style.fontFamily).toBe("Brand");
    expect(style.fontWeight).toBe("700");
  });

  it("overriding sansSerif alone leaves the serif default intact", async () => {
    useThemeStore.getState().setFonts({ families: { sansSerif: HANKEN } });

    await render(<SerifText>serif line</SerifText>);

    expect(flattenTextStyle("serif line").fontFamily).toContain("Georgia");
  });

  it("overriding serif alone leaves the sans-serif default intact", async () => {
    useThemeStore.getState().setFonts({
      families: { serif: { regular: "Cormorant_400Regular", bold: "Cormorant_500Medium" } },
    });

    await render(
      <>
        <SerifText>warm moment</SerifText>
        <StyledText>body copy</StyledText>
      </>,
    );

    expect(flattenTextStyle("warm moment").fontFamily).toBe("Cormorant_400Regular");
    expect(flattenTextStyle("body copy").fontFamily).toContain("Inter");
  });

  it("clears back to package defaults when passed an empty object", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: HANKEN },
      webWeightStrategy: "family",
    });
    useThemeStore.getState().setFonts({});

    await render(<StyledText fontWeight="bold">restored</StyledText>);

    const style = flattenTextStyle("restored");
    expect(style.fontFamily).toContain("Inter");
    expect(style.fontWeight).toBe("700");
  });
});
