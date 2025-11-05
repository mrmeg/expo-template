import React, { useState } from "react";
import { StyleSheet, Pressable } from "react-native";
import { View } from "@/components/ui/Themed";
import { ScrollView } from "@/components/ui/ScrollView";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/components/ui/Popover";
import { SansSerifBoldText, SansSerifText, SerifText, SerifBoldText } from "@/components/ui/StyledText";
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

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <SansSerifText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </SansSerifText>
      <Button onPress={toggleTheme} style={styles.themeToggleButton} preset="outline">
        <SansSerifBoldText style={styles.themeToggleButtonText}>
          {`Switch to ${
            currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"
          }`}
        </SansSerifBoldText>
      </Button>
    </View>
  );
}

export default function TestIndex() {
  const { theme } = useTheme();
  const [textValue, setTextValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [toggleValue, setToggleValue] = useState(false);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(true);

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
          <ThemeToggle />
        </View>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>
            Sans Serif Text - Default body text
          </SansSerifText>
          <SansSerifBoldText style={{ marginBottom: spacing.sm }}>
            Sans Serif Bold - Emphasized text
          </SansSerifBoldText>
          <SerifText style={{ marginBottom: spacing.sm }}>Serif Text - Elegant headings</SerifText>
          <SerifBoldText>Serif Bold - Strong emphasis</SerifBoldText>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Buttons:</SansSerifText>
          <View style={styles.buttonRow}>
            <Button preset="filled" onPress={() => console.log("Filled button pressed")}>
              <SansSerifBoldText>Filled Button</SansSerifBoldText>
            </Button>
          </View>
          <View style={styles.buttonRow}>
            <Button preset="outline" onPress={() => console.log("Outline button pressed")}>
              <SansSerifBoldText>Outline Button</SansSerifBoldText>
            </Button>
          </View>
          <View style={styles.buttonRow}>
            <Button preset="default" onPress={() => console.log("Default button pressed")}>
              <SansSerifBoldText>Default Button</SansSerifBoldText>
            </Button>
          </View>
          <View style={styles.buttonRow}>
            <Button preset="filled" disabled onPress={() => console.log("Won't be called")}>
              <SansSerifBoldText>Disabled Button</SansSerifBoldText>
            </Button>
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing TextInput:</SansSerifText>
          <TextInput
            label="Standard Input"
            placeholder="Enter some text..."
            value={textValue}
            onChangeText={setTextValue}
            style={{ marginBottom: spacing.md }}
          />
          <TextInput
            label="Password Input"
            placeholder="Enter password..."
            secureTextEntry
            value={passwordValue}
            onChangeText={setPasswordValue}
          />
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing ToggleSwitch:</SansSerifText>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <SansSerifText style={{ flex: 1 }}>Toggle Option</SansSerifText>
            <ToggleSwitch value={toggleValue} onValueChange={setToggleValue} />
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Popover positioning:</SansSerifText>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.md }}>
            <Popover>
              <PopoverTrigger>
                <View style={{ padding: spacing.sm, backgroundColor: theme.colors.primary, borderRadius: spacing.radiusMd }}>
                  <SansSerifBoldText style={{ color: theme.colors.white, fontSize: 12 }}>Top</SansSerifBoldText>
                </View>
              </PopoverTrigger>
              <PopoverContent side="top" align="center">
                <PopoverBody>
                  <SansSerifText>Popover on top</SansSerifText>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger>
                <View style={{ padding: spacing.sm, backgroundColor: theme.colors.primary, borderRadius: spacing.radiusMd }}>
                  <SansSerifBoldText style={{ color: theme.colors.white, fontSize: 12 }}>Bottom</SansSerifBoldText>
                </View>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center">
                <PopoverBody>
                  <SansSerifText>Popover on bottom</SansSerifText>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger>
                <View style={{ padding: spacing.sm, backgroundColor: theme.colors.primary, borderRadius: spacing.radiusMd }}>
                  <SansSerifBoldText style={{ color: theme.colors.white, fontSize: 12 }}>Left</SansSerifBoldText>
                </View>
              </PopoverTrigger>
              <PopoverContent side="left" align="center">
                <PopoverBody>
                  <SansSerifText>Popover on left</SansSerifText>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger>
                <View style={{ padding: spacing.sm, backgroundColor: theme.colors.primary, borderRadius: spacing.radiusMd }}>
                  <SansSerifBoldText style={{ color: theme.colors.white, fontSize: 12 }}>Right</SansSerifBoldText>
                </View>
              </PopoverTrigger>
              <PopoverContent side="right" align="center">
                <PopoverBody>
                  <SansSerifText>Popover on right</SansSerifText>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Popover WITH asChild (Button):</SansSerifText>
          <Popover>
            <PopoverTrigger asChild>
              <Button preset="outline">
                <SansSerifBoldText>Open Popover (asChild)</SansSerifBoldText>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start">
              <PopoverBody>
                <SansSerifText>This popover uses asChild with a Button trigger, positioned at bottom-start</SansSerifText>
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
  buttonRow: {
    marginBottom: spacing.md,
  },
});
