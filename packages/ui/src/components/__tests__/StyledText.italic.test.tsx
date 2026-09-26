/**
 * `italic` on StyledText goes through `resolveFontStyle` like weight does: a
 * synthesized slant by default, an app's italic face when `setFonts` supplies
 * one, and the Newsreader italic when the serif preset is on. Native platform.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { SerifText, StyledText } from "../StyledText";
import { useThemeStore } from "../../state/themeStore";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { text: "#111111" } } }),
}));

function styleOf(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>;
}

describe("StyledText italic", () => {
  afterEach(() => {
    useThemeStore.getState().setFonts({});
    useThemeStore.getState().setSerifPreset("georgia");
  });

  it("is upright by default", async () => {
    await render(<StyledText>plain</StyledText>);
    expect(styleOf("plain").fontStyle).toBeUndefined();
  });

  it("synthesizes italic on the package faces", async () => {
    await render(<StyledText italic fontWeight="bold">slanted</StyledText>);
    expect(styleOf("slanted")).toEqual(expect.objectContaining({ fontFamily: "Inter_700Bold", fontStyle: "italic" }));
  });

  it("uses the app's italic face from setFonts and emits no fontStyle", async () => {
    useThemeStore.getState().setFonts({
      families: { sansSerif: { regular: "Brand_Regular", italic: { regular: "Brand_Italic" } } },
    });
    await render(<StyledText italic>branded</StyledText>);
    const style = styleOf("branded");
    expect(style.fontFamily).toBe("Brand_Italic");
    expect(style.fontStyle).toBeUndefined();
  });

  it("uses the Newsreader italic for serif text once the preset is on", async () => {
    useThemeStore.getState().setSerifPreset("newsreader");
    await render(
      <>
        <SerifText italic>quote</SerifText>
        <SerifText fontWeight="semibold">heading</SerifText>
        <StyledText>body</StyledText>
      </>,
    );
    expect(styleOf("quote")).toEqual(expect.objectContaining({ fontFamily: "Newsreader_400Regular_Italic" }));
    expect(styleOf("quote").fontStyle).toBeUndefined();
    expect(styleOf("heading").fontFamily).toBe("Newsreader_600SemiBold");
    expect(styleOf("body").fontFamily).toBe("Inter_400Regular");
  });
});
