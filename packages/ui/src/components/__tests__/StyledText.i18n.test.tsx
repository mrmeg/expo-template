import React from "react";
import { render, screen } from "@testing-library/react-native";
import { configureExpoUiI18n } from "../../lib/i18n";
import { Button } from "../Button";
import { StyledText } from "../StyledText";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: "#111111",
        primary: "#18181B",
        primaryForeground: "#FAFAFA",
        secondary: "#F4F4F5",
        secondaryForeground: "#18181B",
        foreground: "#0F172A",
        accent: "#0F766E",
        destructive: "#EF4444",
      },
    },
    getContrastingColor: (_bg: string, light: string) => light,
    getShadowStyle: () => ({}),
  }),
}));

jest.mock("../../hooks/useScalePress", () => ({
  useScalePress: () => ({
    animatedStyle: {},
    pressHandlers: {},
    scale: { value: 1 },
  }),
}));

describe("StyledText i18n adapter", () => {
  afterEach(() => {
    configureExpoUiI18n(null);
  });

  it("renders plain children without configuring i18n", () => {
    render(<StyledText>Plain text</StyledText>);

    expect(screen.getByText("Plain text")).toBeTruthy();
  });

  it("falls back to the tx key when no translator is configured", () => {
    render(<StyledText tx="common.save" />);

    expect(screen.getByText("common.save")).toBeTruthy();
  });

  it("uses the configured translator for tx props", () => {
    configureExpoUiI18n((key, options) => `${key}:${(options as any)?.name}`);

    render(<StyledText tx="common.greeting" txOptions={{ name: "Matt" }} />);

    expect(screen.getByText("common.greeting:Matt")).toBeTruthy();
  });

  it("translates Button tx props through StyledText", () => {
    configureExpoUiI18n((key) => `translated:${key}`);

    render(<Button tx="common.continue" />);

    expect(screen.getByText("translated:common.continue")).toBeTruthy();
  });
});
