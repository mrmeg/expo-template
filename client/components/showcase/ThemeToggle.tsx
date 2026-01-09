import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";

export function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <StyledText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </StyledText>
      <Button onPress={toggleTheme} style={styles.themeToggleButton} preset="outline">
        <StyledText style={styles.themeToggleButtonText}>
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`}
        </StyledText>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  themeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleLabel: {
    fontFamily: fontFamilies.sansSerif.regular,
    marginRight: spacing.buttonPadding,
    fontSize: 14,
  },
  themeToggleButton: {
    minWidth: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  themeToggleButtonText: {
    fontFamily: fontFamilies.sansSerif.bold,
    fontSize: 14,
    fontWeight: "500",
  },
});
