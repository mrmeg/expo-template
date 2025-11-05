import React, { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { View } from "@/components/ui/Themed";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Toggle } from "@/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/components/ui/Popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
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
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"
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
  const [singleTogglePressed, setSingleTogglePressed] = useState(false);
  const [alignment, setAlignment] = useState<string | undefined>("left");
  const [formats, setFormats] = useState<string[]>(["bold"]);

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
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Switch:</SansSerifText>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <SansSerifText style={{ flex: 1 }}>Basic Switch</SansSerifText>
            <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <SansSerifText style={{ flex: 1 }}>Switch with Labels</SansSerifText>
            <Switch
              size={{ width: 60, height: 32 }}
              checked={toggleValue}
              onCheckedChange={setToggleValue}
              labelOn="ON"
              labelOff="OFF"
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <SansSerifText style={{ flex: 1 }}>Large Switch</SansSerifText>
            <Switch
              checked={toggleValue}
              onCheckedChange={setToggleValue}
              size={{ width: 70, height: 36 }}
              thumbSize={32}
              labelOn="YES"
              labelOff="NO"
            />
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Checkbox:</SansSerifText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Checkbox
              checked={checkbox1}
              onCheckedChange={setCheckbox1}
            />
            <SansSerifText>Checkbox Option 1</SansSerifText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Checkbox
              checked={checkbox2}
              onCheckedChange={setCheckbox2}
            />
            <SansSerifText>Checkbox Option 2 (initially checked)</SansSerifText>
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Toggle & ToggleGroup:</SansSerifText>

          {/* Single Toggle */}
          <View style={{ marginBottom: spacing.md }}>
            <SansSerifText style={{ marginBottom: spacing.xs, fontSize: 12, opacity: 0.7 }}>
              Single Toggle:
            </SansSerifText>
            <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
              <SansSerifText>Toggle Me</SansSerifText>
            </Toggle>
          </View>

          {/* ToggleGroup - Single Selection */}
          <View style={{ marginBottom: spacing.md }}>
            <SansSerifText style={{ marginBottom: spacing.xs, fontSize: 12, opacity: 0.7 }}>
              Single Selection (Alignment):
            </SansSerifText>
            <ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <SansSerifText>Left</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <SansSerifText>Center</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <SansSerifText>Right</SansSerifText>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>

          {/* ToggleGroup - Multiple Selection */}
          <View style={{ marginBottom: spacing.md }}>
            <SansSerifText style={{ marginBottom: spacing.xs, fontSize: 12, opacity: 0.7 }}>
              Multiple Selection (Text Formatting):
            </SansSerifText>
            <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
              <ToggleGroupItem value="bold">
                <SansSerifBoldText>B</SansSerifBoldText>
              </ToggleGroupItem>
              <ToggleGroupItem value="italic">
                <SansSerifText style={{ fontStyle: "italic" }}>I</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="underline">
                <SansSerifText style={{ textDecorationLine: "underline" }}>U</SansSerifText>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>

          {/* Outline Variant */}
          <View style={{ marginBottom: spacing.md }}>
            <SansSerifText style={{ marginBottom: spacing.xs, fontSize: 12, opacity: 0.7 }}>
              Outline Variant:
            </SansSerifText>
            <ToggleGroup type="single" variant="outline" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <SansSerifText>Left</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <SansSerifText>Center</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <SansSerifText>Right</SansSerifText>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>

          {/* Small Size */}
          <View>
            <SansSerifText style={{ marginBottom: spacing.xs, fontSize: 12, opacity: 0.7 }}>
              Small Size:
            </SansSerifText>
            <ToggleGroup type="single" size="sm" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <SansSerifText>L</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <SansSerifText>C</SansSerifText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <SansSerifText>R</SansSerifText>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>
        </Section>

        <Section>
          <SansSerifText style={{ marginBottom: spacing.sm }}>Testing Accordion:</SansSerifText>
          <Accordion type="single" collapsible defaultValue={undefined}>
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <SansSerifBoldText>What is React Native?</SansSerifBoldText>
              </AccordionTrigger>
              <AccordionContent>
                <SansSerifText>
                  React Native is a framework for building native mobile applications using React and JavaScript.
                </SansSerifText>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <SansSerifBoldText>What is Expo?</SansSerifBoldText>
              </AccordionTrigger>
              <AccordionContent>
                <SansSerifText>
                  Expo is a platform that makes it easier to build and deploy React Native applications with a rich set of tools and services.
                </SansSerifText>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <SansSerifBoldText>What are primitives?</SansSerifBoldText>
              </AccordionTrigger>
              <AccordionContent>
                <SansSerifText>
                  Primitives are unstyled, accessible UI components that work across iOS, Android, and Web platforms.
                </SansSerifText>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
