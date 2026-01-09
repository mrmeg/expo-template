import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { Alert } from "@/client/components/ui/Alert";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/client/components/ui/Tooltip";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import { HelpCircle } from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";

export default function FeedbackShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Alert">
            <SubSection label="Simple Alert">
              <Button
                preset="default"
                onPress={() =>
                  Alert.show({
                    message: "This is a simple alert message",
                  })
                }
              >
                <StyledText style={styles.buttonText}>Show Simple Alert</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Alert with Title">
              <Button
                preset="outline"
                onPress={() =>
                  Alert.show({
                    title: "Important",
                    message: "This alert has a title and a message",
                  })
                }
              >
                <StyledText style={styles.outlineButtonText}>Show Alert with Title</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Confirmation Alert">
              <Button
                preset="outline"
                onPress={() =>
                  Alert.show({
                    title: "Delete Item",
                    message: "Are you sure you want to delete this item?",
                    buttons: [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          globalUIStore.getState().show({
                            type: "success",
                            title: "Deleted",
                            messages: ["Item has been deleted"],
                            duration: 2000,
                          });
                        },
                      },
                    ],
                  })
                }
              >
                <StyledText style={styles.outlineButtonText}>Show Confirmation</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Notification">
            <SubSection label="Success Notification">
              <Button
                preset="default"
                onPress={() =>
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Success",
                    messages: ["Operation completed successfully"],
                    duration: 3000,
                  })
                }
              >
                <StyledText style={styles.buttonText}>Show Success</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Error Notification">
              <Button
                preset="outline"
                onPress={() =>
                  globalUIStore.getState().show({
                    type: "error",
                    title: "Error",
                    messages: ["Something went wrong"],
                    duration: 3000,
                  })
                }
              >
                <StyledText style={styles.outlineButtonText}>Show Error</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Warning Notification">
              <Button
                preset="outline"
                onPress={() =>
                  globalUIStore.getState().show({
                    type: "warning",
                    title: "Warning",
                    messages: ["Please review your input"],
                    duration: 3000,
                  })
                }
              >
                <StyledText style={styles.outlineButtonText}>Show Warning</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Info Notification">
              <Button
                preset="outline"
                onPress={() =>
                  globalUIStore.getState().show({
                    type: "info",
                    messages: ["Here's some information for you"],
                    duration: 3000,
                  })
                }
              >
                <StyledText style={styles.outlineButtonText}>Show Info</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Loading Notification">
              <Button
                preset="outline"
                onPress={() => {
                  globalUIStore.getState().show({
                    type: "info",
                    loading: true,
                    messages: ["Loading data..."],
                    duration: 2000,
                  });
                }}
              >
                <StyledText style={styles.outlineButtonText}>Show Loading</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Tooltip">
            <SubSection label="Basic Tooltip">
              <View style={styles.tooltipRow}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="outline" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Hover me</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <StyledText style={styles.labelText}>This is a tooltip</StyledText>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <View style={{ padding: spacing.xs }}>
                      <Icon as={HelpCircle} size={24} color={theme.colors.primary} />
                    </View>
                  </TooltipTrigger>
                  <TooltipContent>
                    <StyledText style={styles.labelText}>Help information</StyledText>
                  </TooltipContent>
                </Tooltip>
              </View>
            </SubSection>

            <SubSection label="Side Positioning">
              <View style={styles.tooltipRow}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="default" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Top</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <StyledText style={styles.labelText}>Tooltip on top</StyledText>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="default" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Bottom</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <StyledText style={styles.labelText}>Tooltip on bottom</StyledText>
                  </TooltipContent>
                </Tooltip>
              </View>
            </SubSection>

            <SubSection label="Visual Variants">
              <View style={styles.tooltipRow}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="outline" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Default</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="default">
                    <StyledText style={styles.labelText}>Default variant</StyledText>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="outline" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Dark</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="dark">
                    <StyledText style={[styles.labelText, { color: "#fff" }]}>Dark variant</StyledText>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button preset="outline" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Light</StyledText>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="light">
                    <StyledText style={[styles.labelText, { color: "#2C2C2C" }]}>Light variant</StyledText>
                  </TooltipContent>
                </Tooltip>
              </View>
            </SubSection>
          </Section>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    content: {
      flex: 1,
      padding: spacing.md,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
      marginTop: spacing.md,
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
    buttonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primaryForeground,
    },
    outlineButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
    },
    smallButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    smallButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      fontSize: 12,
    },
    tooltipRow: {
      flexDirection: "row",
      gap: spacing.lg,
      flexWrap: "wrap",
      alignItems: "center",
    },
  });
