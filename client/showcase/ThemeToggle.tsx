import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";

export function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme, theme } = useTheme();

  const buttonText = `Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`;

  return (
    <View style={styles.container}>
      <StyledText size="base" selectable={false}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </StyledText>
      <Pressable
        onPress={toggleTheme}
        style={[styles.button, { borderColor: theme.colors.primary }]}
      >
        <StyledText semantic="label" selectable={false} style={{ color: theme.colors.primary }}>
          {buttonText}
        </StyledText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
  },
  button: {
    borderWidth: 1,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
