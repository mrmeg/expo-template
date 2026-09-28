import React from "react";
import { Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { interaction, spacing } from "@mrmeg/expo-ui/constants";

export interface AuthLinkProps {
  onPress: PressableProps["onPress"];
  disabled?: boolean;
  testID?: string;
  /** Layout only (alignment, margins); the target size is the link's own. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * The tappable text link the auth forms share: "Sign up", "Forgot password?",
 * "Back to sign in", the passwordless toggles. A bare `Pressable` around a line
 * of body text measured 21 px tall — half the 44 pt minimum — so the link owns
 * a `spacing.touchTarget` row and centres its text in it. Callers keep their
 * `StyledText` children and `linkText` colour; a row that mixes muted copy
 * with a link centres its items so the taller link does not lift the sentence.
 */
export function AuthLink({ onPress, disabled = false, testID, style, children }: AuthLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: spacing.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    ...(Platform.OS === "web" && { cursor: "pointer" as ViewStyle["cursor"] }),
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
});
