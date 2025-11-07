import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { View } from "@/components/ui/Themed";
import { Text } from "@/components/ui/StyledText";
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
import { fontFamilies } from "@/constants/fonts";
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
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SubSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      {label && (
        <Text style={styles.subSectionLabel}>
          {label}
        </Text>
      )}
      {children}
    </View>
  );
}

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <Text style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </Text>
      <Button onPress={toggleTheme} style={styles.themeToggleButton} preset="outline">
        <Text style={styles.themeToggleButtonText}>
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"
          }`}
        </Text>
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
          <Text style={[styles.appTitle, { color: theme.colors.textPrimary }]}>
            Test Page
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textPrimary }]}>
            Minimal version to test
          </Text>
          <ThemeToggle />
        </View>

        <Section title="Typography">
          <Text style={styles.sansSerifText}>
            Sans Serif Text - Default body text
          </Text>
          <Text style={styles.sansSerifBoldText}>
            Sans Serif Bold - Emphasized text
          </Text>
          <Text style={styles.serifText}>Serif Text - Elegant headings</Text>
          <Text style={styles.serifBoldText}>Serif Bold - Strong emphasis</Text>
        </Section>

        <Section title="Buttons">
          <SubSection label="Default">
            <Button preset="default" onPress={() => console.log("Default button pressed")}>
              <Text style={styles.buttonText}>Default Button</Text>
            </Button>
          </SubSection>
          <SubSection label="Outline">
            <Button preset="outline" onPress={() => console.log("Outline button pressed")}>
              <Text style={styles.buttonText}>Outline Button</Text>
            </Button>
          </SubSection>
          <SubSection label="Disabled">
            <Button preset="default" disabled onPress={() => console.log("Won't be called")}>
              <Text style={styles.buttonText}>Disabled Button</Text>
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
              <Text style={styles.labelText}>Basic Switch</Text>
              <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
            </View>
          </SubSection>
          <SubSection label="With Labels">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.labelText}>Switch with Labels</Text>
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
              <Text style={styles.labelText}>Large Switch</Text>
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
            <Text style={styles.labelText}>Checkbox Option 1</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Checkbox
              checked={checkbox2}
              onCheckedChange={setCheckbox2}
            />
            <Text style={styles.labelText}>Checkbox Option 2 (initially checked)</Text>
          </View>
        </Section>

        <Section title="Toggle & Toggle Group">
          <SubSection label="Single Toggle">
            <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
              <Text style={styles.labelText}>Toggle Me</Text>
            </Toggle>
          </SubSection>

          <SubSection label="Toggle Group - Single Selection">
            <ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <Text style={styles.labelText}>Left</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <Text style={styles.labelText}>Center</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <Text style={styles.labelText}>Right</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Toggle Group - Multiple Selection">
            <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
              <ToggleGroupItem value="bold">
                <Text style={styles.buttonText}>B</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="italic">
                <Text style={[styles.labelText, { fontStyle: "italic" }]}>I</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="underline">
                <Text style={[styles.labelText, { textDecorationLine: "underline" }]}>U</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Outline Variant">
            <ToggleGroup type="single" variant="outline" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <Text style={styles.labelText}>Left</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <Text style={styles.labelText}>Center</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <Text style={styles.labelText}>Right</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Small Size">
            <ToggleGroup type="single" size="sm" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <Text style={styles.labelText}>L</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <Text style={styles.labelText}>C</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <Text style={styles.labelText}>R</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>
        </Section>

        <Section title="Accordion">
          <Accordion type="single" collapsible defaultValue={undefined}>
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <Text style={styles.buttonText}>What is React Native?</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text style={styles.labelText}>
                  React Native is a framework for building native mobile applications using React and JavaScript.
                </Text>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <Text style={styles.buttonText}>What is Expo?</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text style={styles.labelText}>
                  Expo is a platform that makes it easier to build and deploy React Native applications with a rich set of tools and services.
                </Text>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <Text style={styles.buttonText}>What are primitives?</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text style={styles.labelText}>
                  Primitives are unstyled, accessible UI components that work across iOS, Android, and Web platforms.
                </Text>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section title="Popover">
          <SubSection label="Side Positioning">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Top</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center">
                  <PopoverBody>
                    <Text style={styles.labelText}>Popover on top</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Bottom</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <PopoverBody>
                    <Text style={styles.labelText}>Popover on bottom</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Top Start</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start">
                  <PopoverBody>
                    <Text style={styles.labelText}>Aligned to start</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Top End</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end">
                  <PopoverBody>
                    <Text style={styles.labelText}>Aligned to end</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </SubSection>

          <SubSection label="Alignment Variations">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Start</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start">
                  <PopoverBody>
                    <Text style={styles.labelText}>Aligned to start</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Center</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <PopoverBody>
                    <Text style={styles.labelText}>Aligned to center</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>End</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end">
                  <PopoverBody>
                    <Text style={styles.labelText}>Aligned to end</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </SubSection>

          <SubSection label="Side Offset Examples">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 0</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={0}>
                  <PopoverBody>
                    <Text style={styles.labelText}>No offset from trigger</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 16</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={16}>
                  <PopoverBody>
                    <Text style={styles.labelText}>16px from trigger</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 32</Text>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={32}>
                  <PopoverBody>
                    <Text style={styles.labelText}>32px from trigger</Text>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </SubSection>

          <SubSection label="Real-World Example: User Info Card">
            <Popover>
              <PopoverTrigger asChild>
                <Button preset="outline">
                  <Text style={styles.buttonText}>View Profile</Text>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={8}>
                <View style={{ minWidth: 200 }}>
                  <View style={{ paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.bgTertiary }}>
                    <Text style={[styles.buttonText, { fontSize: 16 }]}>John Doe</Text>
                    <Text style={[styles.labelText, { fontSize: 12, opacity: 0.7 }]}>john@example.com</Text>
                  </View>
                  <View style={{ paddingTop: spacing.sm }}>
                    <Text style={[styles.labelText, { fontSize: 14, marginBottom: spacing.xs }]}>Member since 2024</Text>
                    <Text style={[styles.labelText, { fontSize: 14 }]}>Premium Account</Text>
                  </View>
                </View>
              </PopoverContent>
            </Popover>
          </SubSection>
        </Section>

        <Section title="Dropdown Menu">
          <SubSection label="Side Positioning">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Top</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Menu on top</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Bottom</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="center">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Menu on bottom</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Bottom Start</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Aligned to start</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Bottom End</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Aligned to end</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          </SubSection>

          <SubSection label="Alignment Variations">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Start</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Aligned to start</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Option 2</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Center</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="center">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Aligned to center</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Option 2</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>End</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Aligned to end</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>Option 2</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          </SubSection>

          <SubSection label="Side Offset Examples">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 0</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={0}>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>No offset</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 16</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={16}>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>16px offset</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={styles.smallButtonText}>Offset 32</Text>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={32}>
                  <DropdownMenuItem>
                    <Text style={styles.labelText}>32px offset</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          </SubSection>

          <SubSection label="Basic Menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <Text style={styles.buttonText}>Open Menu</Text>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Text style={styles.labelText}>Profile</Text>
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Text style={styles.labelText}>Settings</Text>
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Text style={styles.labelText}>Logout</Text>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Checkboxes">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <Text style={styles.buttonText}>View Options</Text>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <Text style={styles.buttonText}>Appearance</Text>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showBookmarks}
                  onCheckedChange={setShowBookmarks}
                >
                  <Text style={styles.labelText}>Show Bookmarks</Text>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showUrls}
                  onCheckedChange={setShowUrls}
                >
                  <Text style={styles.labelText}>Show Full URLs</Text>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Radio Group">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <Text style={styles.buttonText}>Panel Position</Text>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <Text style={styles.buttonText}>Position</Text>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusBarPosition} onValueChange={setStatusBarPosition}>
                  <DropdownMenuRadioItem value="top">
                    <Text style={styles.labelText}>Top</Text>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom">
                    <Text style={styles.labelText}>Bottom</Text>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">
                    <Text style={styles.labelText}>Right</Text>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Sub-menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <Text style={styles.buttonText}>Advanced Menu</Text>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Text style={styles.labelText}>New File</Text>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Text style={styles.labelText}>New Window</Text>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Text style={styles.labelText}>More Tools</Text>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <Text style={styles.labelText}>Developer Tools</Text>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Text style={styles.labelText}>Task Manager</Text>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Text style={styles.labelText}>Extensions</Text>
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
                  <Text style={styles.buttonText}>Can I use this in my project?</Text>
                  <Text style={[styles.labelText, { fontSize: 18, opacity: 0.7 }]}>
                    {collapsibleOpen ? "−" : "+"}
                  </Text>
                </View>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <View style={{ paddingTop: spacing.sm }}>
                  <Text style={styles.labelText}>
                    Yes! This is a reusable collapsible component built with @rn-primitives/collapsible.
                    It supports smooth animations and works across iOS, Android, and Web.
                  </Text>
                </View>
              </CollapsibleContent>
            </Collapsible>
          </SubSection>

          <SubSection label="With Button Trigger (asChild)">
            <Collapsible>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <Text style={styles.buttonText}>@peduarte starred 3 repositories</Text>
                <CollapsibleTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={[styles.labelText, { fontSize: 12 }]}>Toggle</Text>
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
                <Text style={styles.labelText}>@radix-ui/primitives</Text>
              </View>
              <CollapsibleContent>
                <View style={{ gap: spacing.sm }}>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.bgTertiary,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <Text style={styles.labelText}>@radix-ui/react</Text>
                  </View>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.bgTertiary,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <Text style={styles.labelText}>@stitches/core</Text>
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
    fontFamily: fontFamilies.sansSerif.bold,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.sansSerif.regular,
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
    fontFamily: fontFamilies.serif.bold,
    marginBottom: spacing.lg,
  },
  subSection: {
    marginBottom: spacing.lg,
  },
  subSectionLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.sansSerif.regular,
    opacity: 0.7,
    marginBottom: spacing.xs,
  },
  // Typography demo styles
  sansSerifText: {
    fontFamily: fontFamilies.sansSerif.regular,
    marginBottom: spacing.sm,
  },
  sansSerifBoldText: {
    fontFamily: fontFamilies.sansSerif.bold,
    marginBottom: spacing.sm,
  },
  serifText: {
    fontFamily: fontFamilies.serif.regular,
    marginBottom: spacing.sm,
  },
  serifBoldText: {
    fontFamily: fontFamilies.serif.bold,
  },
  // Component text styles
  labelText: {
    fontFamily: fontFamilies.sansSerif.regular,
  },
  buttonText: {
    fontFamily: fontFamilies.sansSerif.bold,
  },
  smallButtonText: {
    fontFamily: fontFamilies.sansSerif.bold,
    fontSize: 12,
  },
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
