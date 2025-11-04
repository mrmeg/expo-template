import React from "react";
import { StyleSheet, Platform } from "react-native";
import { View } from "@/components/ui/Themed";
import { ScrollView } from "@/components/ui/ScrollView";
import { Button } from "@/components/ui/Button";
import { SansSerifText, SansSerifBoldText } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <SansSerifText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : (scheme === "dark" ? "Dark" : "Light")}
      </SansSerifText>
      <Button
        onPress={toggleTheme}
        style={styles.themeToggleButton}
        preset="outline"
      >
        <SansSerifBoldText style={styles.themeToggleButtonText}>
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"}`}
        </SansSerifBoldText>
      </Button>
    </View>
  );
}

export default function Index() {
  const { theme } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <SansSerifBoldText style={[styles.appTitle, { color: theme.colors["base-content"] }]}>
            My App
          </SansSerifBoldText>
          <ThemeToggle />
        </View>

        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          <SansSerifText style={[styles.welcomeText, { color: theme.colors["base-content"] }]}>
            Welcome! Start building your app here.
          </SansSerifText>

          {/* Example usage of your components */}
          <View style={styles.exampleSection}>
            <Button
              text="Get Started"
              preset="filled"
              onPress={() => console.log("Getting started!")}
              style={styles.getStartedButton}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: spacing.xxl + spacing.md,
  },
  container: {
    flex: 1,
    padding: spacing.md,
    maxWidth: Platform.OS === "web" ? 600 : "100%",
    width: "100%",
    alignSelf: "center",
  },
  headerContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: spacing.xl + spacing.sm,
    marginTop: spacing.lg - 4,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.lg - 4,
  },
  themeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleLabel: {
    marginRight: spacing.buttonPadding,
    fontSize: 14,
  },
  themeToggleButton: {
    minWidth: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  themeToggleButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: spacing.xl,
    opacity: 0.8,
  },
  exampleSection: {
    alignItems: "center",
    width: "100%",
  },
  getStartedButton: {
    minWidth: 200,
    marginBottom: spacing.md,
  },
});