/**
 * StyledText selectability default — Android.
 *
 * A selectable Android `Text` is focusable-in-touch-mode: tapping a label next
 * to a focused input moved view focus to the label and hid the keyboard, so
 * the package defaults `selectable` to `false` on Android only. `Platform.OS`
 * is read at render time in StyledText, so the flip below works per test
 * (same pattern as TextInput.android.test.tsx). iOS/web defaults are covered
 * in StyledText.i18n.test.tsx and the web case at the bottom of this file.
 */

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { cleanup, render, screen } from "@testing-library/react-native";
import { BodyText, StyledText } from "../StyledText";
import { TextSelectabilityContext } from "../StyledText.context";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: "#111111",
      },
    },
  }),
}));

function userSelectOf(text: string) {
  return (StyleSheet.flatten(screen.getByText(text).props.style) as Record<string, unknown>).userSelect;
}

describe("StyledText selectable default", () => {
  const originalOS = Platform.OS;

  afterEach(async () => {
    await cleanup();
    Platform.OS = originalOS;
  });

  describe("android", () => {
    beforeEach(() => {
      Platform.OS = "android";
    });

    it("renders non-selectable by default", async () => {
      await render(<StyledText>Body copy</StyledText>);

      expect(screen.getByText("Body copy").props.selectable).toBe(false);
      expect(userSelectOf("Body copy")).toBe("none");
    });

    it("applies the default through the semantic aliases", async () => {
      await render(<BodyText>Alias copy</BodyText>);

      expect(screen.getByText("Alias copy").props.selectable).toBe(false);
    });

    it("opts in with an explicit selectable prop", async () => {
      await render(<StyledText selectable>Copy me</StyledText>);

      expect(screen.getByText("Copy me").props.selectable).toBe(true);
      expect(userSelectOf("Copy me")).toBe("auto");
    });

    it("still honours an explicit selectable={false}", async () => {
      await render(<StyledText selectable={false}>Chrome</StyledText>);

      expect(screen.getByText("Chrome").props.selectable).toBe(false);
    });

    it("lets TextSelectabilityContext override the platform default", async () => {
      await render(
        <TextSelectabilityContext.Provider value={true}>
          <StyledText>Context on</StyledText>
        </TextSelectabilityContext.Provider>
      );

      expect(screen.getByText("Context on").props.selectable).toBe(true);
    });

    it("lets the prop win over context", async () => {
      await render(
        <TextSelectabilityContext.Provider value={false}>
          <StyledText selectable>Prop wins</StyledText>
        </TextSelectabilityContext.Provider>
      );

      expect(screen.getByText("Prop wins").props.selectable).toBe(true);
    });
  });

  it("keeps the selectable default on web", async () => {
    Platform.OS = "web";

    await render(<StyledText>Web copy</StyledText>);

    expect(screen.getByText("Web copy").props.selectable).toBe(true);
    expect(userSelectOf("Web copy")).toBe("auto");
  });
});
