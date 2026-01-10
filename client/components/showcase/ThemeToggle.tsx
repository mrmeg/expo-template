import React from "react";
import { StyleSheet, View, Pressable, Text } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";

export function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme, theme } = useTheme();

  const buttonText = `Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </Text>
      <Pressable
        onPress={toggleTheme}
        style={[styles.button, { borderColor: theme.colors.primary }]}
      >
        <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
          {buttonText}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
  },
  button: {
    borderWidth: 1,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
