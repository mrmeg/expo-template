import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { View } from "@/components/ui/Themed";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Toggle } from "@/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/components/ui/Popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/Accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuShortcut } from "@/components/ui/DropdownMenu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/Collapsible";
import { SansSerifBoldText, SansSerifText, SerifText, SerifBoldText } from "@/components/ui/StyledText";
import { useTheme } from "@/hooks/useTheme";
import { spacing } from "@/constants/spacing";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme, getShadowStyle } = useTheme();
  const shadowStyle = getShadowStyle("soft");
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.bgSecondary,
          borderColor: theme.colors.bgTertiary,
        },
        shadowStyle,
      ]}
    >
      <SerifBoldText style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
        {title}
      </SerifBoldText>
      {children}
    </View>
  );
}

function SubSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      {label && (
        <SansSerifText style={styles.subSectionLabel}>
          {label}
        </SansSerifText>
      )}
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
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showUrls, setShowUrls] = useState(false);
  const [statusBarPosition, setStatusBarPosition] = useState("bottom");
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <SansSerifBoldText style={[styles.appTitle, { color: theme.colors.textPrimary }]}>
            Test Page
          </SansSerifBoldText>
          <SansSerifText style={[styles.subtitle, { color: theme.colors.textPrimary }]}>
            Minimal version to test
          </SansSerifText>
          <ThemeToggle />
        </View>

        <Section title="Typography">
          <SansSerifText style={{ marginBottom: spacing.sm }}>
            Sans Serif Text - Default body text
          </SansSerifText>
          <SansSerifBoldText style={{ marginBottom: spacing.sm }}>
            Sans Serif Bold - Emphasized text
          </SansSerifBoldText>
          <SerifText style={{ marginBottom: spacing.sm }}>Serif Text - Elegant headings</SerifText>
          <SerifBoldText>Serif Bold - Strong emphasis</SerifBoldText>
        </Section>

        <Section title="Buttons">
          <SubSection label="Default">
            <Button preset="default" onPress={() => console.log("Default button pressed")}>
              <SansSerifBoldText>Default Button</SansSerifBoldText>
            </Button>
          </SubSection>
          <SubSection label="Outline">
            <Button preset="outline" onPress={() => console.log("Outline button pressed")}>
              <SansSerifBoldText>Outline Button</SansSerifBoldText>
            </Button>
          </SubSection>
          <SubSection label="Disabled">
            <Button preset="default" disabled onPress={() => console.log("Won't be called")}>
              <SansSerifBoldText>Disabled Button</SansSerifBoldText>
            </Button>
          </SubSection>
        </Section>

        <Section title="Text Input">
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

        <Section title="Switch">
          <SubSection label="Basic">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <SansSerifText>Basic Switch</SansSerifText>
              <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
            </View>
          </SubSection>
          <SubSection label="With Labels">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <SansSerifText>Switch with Labels</SansSerifText>
              <Switch
                size={{ width: 60, height: 32 }}
                checked={toggleValue}
                onCheckedChange={setToggleValue}
                labelOn="ON"
                labelOff="OFF"
              />
            </View>
          </SubSection>
          <SubSection label="Large Size">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <SansSerifText>Large Switch</SansSerifText>
              <Switch
                checked={toggleValue}
                onCheckedChange={setToggleValue}
                size={{ width: 70, height: 36 }}
                thumbSize={32}
                labelOn="YES"
                labelOff="NO"
              />
            </View>
          </SubSection>
        </Section>

        <Section title="Checkbox">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
            <Checkbox
              checked={checkbox1}
              onCheckedChange={setCheckbox1}
            />
            <SansSerifText>Checkbox Option 1</SansSerifText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Checkbox
              checked={checkbox2}
              onCheckedChange={setCheckbox2}
            />
            <SansSerifText>Checkbox Option 2 (initially checked)</SansSerifText>
          </View>
        </Section>

        <Section title="Toggle & Toggle Group">
          <SubSection label="Single Toggle">
            <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
              <SansSerifText>Toggle Me</SansSerifText>
            </Toggle>
          </SubSection>

          <SubSection label="Toggle Group - Single Selection">
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
          </SubSection>

          <SubSection label="Toggle Group - Multiple Selection">
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
          </SubSection>

          <SubSection label="Outline Variant">
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
          </SubSection>

          <SubSection label="Small Size">
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
          </SubSection>
        </Section>

        <Section title="Accordion">
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

        <Section title="Popover">
          <SubSection label="Positioning">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <SansSerifBoldText style={{ fontSize: 12 }}>Top</SansSerifBoldText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center">
                  <PopoverBody>
                    <SansSerifText>Popover on top</SansSerifText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <SansSerifBoldText style={{ fontSize: 12 }}>Bottom</SansSerifBoldText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <PopoverBody>
                    <SansSerifText>Popover on bottom</SansSerifText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </SubSection>

          <SubSection label="With Button (asChild)">
            <Popover>
              <PopoverTrigger asChild>
                <Button preset="outline">
                  <SansSerifBoldText>Open Popover</SansSerifBoldText>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start">
                <PopoverBody>
                  <SansSerifText>This popover uses asChild with a Button trigger</SansSerifText>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </SubSection>
        </Section>

        <Section title="Dropdown Menu">
          <SubSection label="Basic Menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <SansSerifBoldText>Open Menu</SansSerifBoldText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <SansSerifText>Profile</SansSerifText>
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SansSerifText>Settings</SansSerifText>
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <SansSerifText>Logout</SansSerifText>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Checkboxes">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <SansSerifBoldText>View Options</SansSerifBoldText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <SansSerifBoldText>Appearance</SansSerifBoldText>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showBookmarks}
                  onCheckedChange={setShowBookmarks}
                >
                  <SansSerifText>Show Bookmarks</SansSerifText>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showUrls}
                  onCheckedChange={setShowUrls}
                >
                  <SansSerifText>Show Full URLs</SansSerifText>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Radio Group">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <SansSerifBoldText>Panel Position</SansSerifBoldText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <SansSerifBoldText>Position</SansSerifBoldText>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusBarPosition} onValueChange={setStatusBarPosition}>
                  <DropdownMenuRadioItem value="top">
                    <SansSerifText>Top</SansSerifText>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom">
                    <SansSerifText>Bottom</SansSerifText>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">
                    <SansSerifText>Right</SansSerifText>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Sub-menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <SansSerifBoldText>Advanced Menu</SansSerifBoldText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <SansSerifText>New File</SansSerifText>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SansSerifText>New Window</SansSerifText>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SansSerifText>More Tools</SansSerifText>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <SansSerifText>Developer Tools</SansSerifText>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <SansSerifText>Task Manager</SansSerifText>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <SansSerifText>Extensions</SansSerifText>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>
        </Section>

        <Section title="Collapsible">
          <SubSection label="Basic Collapsible">
            <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
              <CollapsibleTrigger>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <SansSerifBoldText>Can I use this in my project?</SansSerifBoldText>
                  <SansSerifText style={{ fontSize: 18, opacity: 0.7 }}>
                    {collapsibleOpen ? "−" : "+"}
                  </SansSerifText>
                </View>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <View style={{ paddingTop: spacing.sm }}>
                  <SansSerifText>
                    Yes! This is a reusable collapsible component built with @rn-primitives/collapsible.
                    It supports smooth animations and works across iOS, Android, and Web.
                  </SansSerifText>
                </View>
              </CollapsibleContent>
            </Collapsible>
          </SubSection>

          <SubSection label="With Button Trigger (asChild)">
            <Collapsible>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <SansSerifBoldText>@peduarte starred 3 repositories</SansSerifBoldText>
                <CollapsibleTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <SansSerifText style={{ fontSize: 12 }}>Toggle</SansSerifText>
                  </Button>
                </CollapsibleTrigger>
              </View>
              <View style={{
                borderWidth: 1,
                borderColor: theme.colors.bgTertiary,
                borderRadius: spacing.radiusMd,
                padding: spacing.md,
                marginBottom: spacing.sm
              }}>
                <SansSerifText>@radix-ui/primitives</SansSerifText>
              </View>
              <CollapsibleContent>
                <View style={{ gap: spacing.sm }}>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.bgTertiary,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <SansSerifText>@radix-ui/react</SansSerifText>
                  </View>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.bgTertiary,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <SansSerifText>@stitches/core</SansSerifText>
                  </View>
                </View>
              </CollapsibleContent>
            </Collapsible>
          </SubSection>
        </Section>
      </View>
    </KeyboardAwareScrollView>
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
    padding: spacing.lg,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: spacing.lg,
  },
  subSection: {
    marginBottom: spacing.lg,
  },
  subSectionLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: spacing.xs,
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
});
