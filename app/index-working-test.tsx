import React from "react";
import { StyleSheet, Pressable } from "react-native";
import { View } from "@/components/ui/Themed";
import { ScrollView } from "@/components/ui/ScrollView";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/components/ui/Popover";
import { SansSerifBoldText, SansSerifText } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";

function Section({ children }: { children: React.ReactNode }) {
  const { theme, getShadowStyle } = useTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors["base-200"],
          borderColor: theme.colors["base-300"],
          ...getShadowStyle("soft"),
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function TestIndex() {
  const { theme } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <SansSerifBoldText style={[styles.appTitle, { color: theme.colors["base-content"] }]}>
            Test Page
          </SansSerifBoldText>
          <SansSerifText style={[styles.subtitle, { color: theme.colors["base-content"] }]}>
            Minimal version to test
          </SansSerifText>
        </View>

        <Section>
          <SansSerifText>Testing Section with getShadowStyle</SansSerifText>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Button:</SansSerifText>
          <Button preset="filled" onPress={() => console.log("Button pressed")}>
            <SansSerifBoldText>Test Button</SansSerifBoldText>
          </Button>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Popover WITHOUT asChild:</SansSerifText>
          <Popover>
            <PopoverTrigger>
              <Button preset="outline">
                <SansSerifBoldText>Open Popover</SansSerifBoldText>
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverBody>
                <SansSerifText>This is a popover</SansSerifText>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Popover WITH asChild (no Pressable wrapper):</SansSerifText>
          <Popover>
            <PopoverTrigger asChild>
              <Button preset="outline">
                <SansSerifBoldText>Open Popover (asChild)</SansSerifBoldText>
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverBody>
                <SansSerifText>This is a popover with asChild</SansSerifText>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Section>
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
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
  },
  headerContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: spacing.lg,
  },
  section: {
    padding: spacing.md,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
});
