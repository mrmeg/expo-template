/**
 * `AuthLink` is the tappable text link the auth forms share ("Sign up",
 * "Forgot password?", "Back to sign in"…). Its whole point is the target: a
 * bare `Pressable` around 16 px text measured 21 px tall, under the 44 pt
 * minimum, so the link owns a 44 pt row and centres its text in it.
 */
import "@/test/mockTheme";

import React from "react";
import { StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { spacing } from "@mrmeg/expo-ui/constants";

import { AuthLink } from "../AuthLink";

const linkStyle = () =>
  StyleSheet.flatten(screen.getByRole("button", { name: "Sign up" }).props.style) as Record<string, unknown>;

describe("AuthLink", () => {
  it("is a button with a 44 pt minimum target that centres its text", async () => {
    await render(
      <AuthLink onPress={() => {}}>
        <Text>Sign up</Text>
      </AuthLink>,
    );
    expect(linkStyle().minHeight).toBeGreaterThanOrEqual(spacing.touchTarget);
    expect(linkStyle().justifyContent).toBe("center");
  });

  it("fires onPress and honours disabled", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <AuthLink onPress={onPress}>
        <Text>Sign up</Text>
      </AuthLink>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sign up" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <AuthLink onPress={onPress} disabled>
        <Text>Sign up</Text>
      </AuthLink>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sign up" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign up" }).props.accessibilityState?.disabled).toBe(true);
  });

  it("keeps a caller's style and testID", async () => {
    await render(
      <AuthLink onPress={() => {}} testID="auth-link" style={{ alignSelf: "flex-end" }}>
        <Text>Sign up</Text>
      </AuthLink>,
    );
    expect(screen.getByTestId("auth-link")).toBeTruthy();
    expect(linkStyle().alignSelf).toBe("flex-end");
    expect(linkStyle().minHeight).toBeGreaterThanOrEqual(spacing.touchTarget);
  });
});
