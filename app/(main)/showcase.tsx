import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { TextInput } from "@/client/components/ui/TextInput";
import { Switch } from "@/client/components/ui/Switch";
import { Checkbox } from "@/client/components/ui/Checkbox";
import { Toggle } from "@/client/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/ToggleGroup";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/client/components/ui/Popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/Accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuShortcut } from "@/client/components/ui/DropdownMenu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/client/components/ui/Collapsible";
import { Separator } from "@/client/components/ui/Separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/client/components/ui/Tooltip";
import { fontFamilies } from "@/client/constants/fonts";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Heart, Star, Settings, Home, User, Mail, Bell, Search, ShoppingCart, AlertCircle, CheckCircle, Info, AlertTriangle, HelpCircle } from "lucide-react-native";
import { Icon } from "@/client/components/ui/Icon";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { Alert } from "@/client/components/ui/Alert";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme, getShadowStyle } = useTheme();
  const shadowStyle = getShadowStyle("soft");
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        shadowStyle,
      ]}
    >
      <StyledText style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
        {title}
      </StyledText>
      {children}
    </View>
  );
}

function SubSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      {label && (
        <StyledText style={styles.subSectionLabel}>
          {label}
        </StyledText>
      )}
      {children}
    </View>
  );
}

function ThemeToggle() {
  const { toggleTheme, currentTheme, scheme } = useTheme();

  return (
    <View style={styles.themeToggleContainer}>
      <StyledText style={styles.themeToggleLabel}>
        Theme: {currentTheme === "system" ? "System" : scheme === "dark" ? "Dark" : "Light"}
      </StyledText>
      <Button onPress={toggleTheme} style={styles.themeToggleButton} preset="outline">
        <StyledText style={styles.themeToggleButtonText}>
          {`Switch to ${currentTheme === "system" ? "Light" : currentTheme === "light" ? "Dark" : "System"
          }`}
        </StyledText>
      </Button>
    </View>
  );
}

export default function ComponentShowcase() {
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
          <StyledText style={[styles.appTitle, { color: theme.colors.foreground }]}>
            Test Page
          </StyledText>
          <StyledText style={[styles.subtitle, { color: theme.colors.foreground }]}>
            Minimal version to test
          </StyledText>
          <ThemeToggle />
        </View>

        <Section title="Typography">
          <StyledText style={styles.sansSerifText}>
            Sans Serif Text - Default body text
          </StyledText>
          <StyledText style={styles.sansSerifBoldText}>
            Sans Serif Bold - Emphasized text
          </StyledText>
          <StyledText style={styles.serifText}>Serif Text - Elegant headings</StyledText>
          <StyledText style={styles.serifBoldText}>Serif Bold - Strong emphasis</StyledText>
        </Section>

        <Section title="Alert">
          <SubSection label="Simple Alert">
            <Button preset="default" onPress={() => Alert.show({
              message: "This is a simple alert message"
            })}>
              <StyledText>Show Simple Alert</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Alert with Title">
            <Button preset="outline" onPress={() => Alert.show({
              title: "Important",
              message: "This alert has a title and a message"
            })}>
              <StyledText>Show Alert with Title</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Confirmation Alert">
            <Button preset="outline" onPress={() => Alert.show({
              title: "Delete Item",
              message: "Are you sure you want to delete this item?",
              buttons: [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete", style: "destructive", onPress: () => {
                    globalUIStore.getState().show({
                      type: "success",
                      title: "Deleted",
                      messages: ["Item has been deleted"],
                      duration: 2000
                    });
                  }
                }
              ]
            })}>
              <StyledText>Show Confirmation</StyledText>
            </Button>
          </SubSection>
        </Section>

        <Section title="Icon">
          <SubSection label="Basic Icons">
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap", alignItems: "center" }}>
              <Icon as={Heart} size={24} />
              <Icon as={Star} size={24} />
              <Icon as={Settings} size={24} />
              <Icon as={Home} size={24} />
              <Icon as={User} size={24} />
              <Icon as={Mail} size={24} />
              <Icon as={Bell} size={24} />
              <Icon as={Search} size={24} />
              <Icon as={ShoppingCart} size={24} />
            </View>
          </SubSection>
          <SubSection label="Icon Sizes">
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Icon as={Heart} size={16} />
              <Icon as={Heart} size={24} />
              <Icon as={Heart} size={32} />
              <Icon as={Heart} size={48} />
            </View>
          </SubSection>
          <SubSection label="Icon Colors">
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Icon as={Heart} size={32} color={theme.colors.destructive} />
              <Icon as={Star} size={32} color={theme.colors.warning} />
              <Icon as={CheckCircle} size={32} color={theme.colors.success} />
              <Icon as={Info} size={32} color={theme.colors.primary} />
            </View>
          </SubSection>
          <SubSection label="Status Icons">
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Icon as={AlertCircle} size={28} color={theme.colors.destructive} />
              <Icon as={CheckCircle} size={28} color={theme.colors.success} />
              <Icon as={AlertTriangle} size={28} color={theme.colors.warning} />
              <Icon as={Info} size={28} color={theme.colors.foreground} />
            </View>
          </SubSection>
        </Section>

        <Section title="Notification">
          <SubSection label="Success Notification">
            <Button preset="default" onPress={() => globalUIStore.getState().show({
              type: "success",
              title: "Success",
              messages: ["Operation completed successfully"],
              duration: 3000
            })}>
              <StyledText>Show Success</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Error Notification">
            <Button preset="outline" onPress={() => globalUIStore.getState().show({
              type: "error",
              title: "Error",
              messages: ["Something went wrong"],
              duration: 3000
            })}>
              <StyledText>Show Error</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Warning Notification">
            <Button preset="outline" onPress={() => globalUIStore.getState().show({
              type: "warning",
              title: "Warning",
              messages: ["Please review your input"],
              duration: 3000
            })}>
              <StyledText>Show Warning</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Info Notification">
            <Button preset="outline" onPress={() => globalUIStore.getState().show({
              type: "info",
              messages: ["Here's some information for you"],
              duration: 3000
            })}>
              <StyledText>Show Info</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Loading Notification">
            <Button preset="outline" onPress={() => {
              globalUIStore.getState().show({
                type: "info",
                loading: true,
                messages: ["Loading data..."],
                duration: 2000
              });
            }}>
              <StyledText>Show Loading</StyledText>
            </Button>
          </SubSection>
        </Section>

        <Section title="Buttons">
          <SubSection label="Default">
            <Button preset="default" onPress={() => console.log("Default button pressed")}>
              <StyledText style={styles.buttonText}>Default Button</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Outline">
            <Button preset="outline" onPress={() => console.log("Outline button pressed")}>
              <StyledText style={styles.buttonText}>Outline Button</StyledText>
            </Button>
          </SubSection>
          <SubSection label="Disabled">
            <Button preset="default" disabled onPress={() => console.log("Won't be called")}>
              <StyledText style={styles.buttonText}>Disabled Button</StyledText>
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
            showSecureEntryToggle
            value={passwordValue}
            onChangeText={setPasswordValue}
          />
        </Section>

        <Section title="Switch">
          <SubSection label="Basic">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <StyledText style={styles.labelText}>Basic Switch</StyledText>
              <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
            </View>
          </SubSection>
          <SubSection label="With Labels">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <StyledText style={styles.labelText}>Switch with Labels</StyledText>
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
              <StyledText style={styles.labelText}>Large Switch</StyledText>
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
            <StyledText style={styles.labelText}>Checkbox Option 1</StyledText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Checkbox
              checked={checkbox2}
              onCheckedChange={setCheckbox2}
            />
            <StyledText style={styles.labelText}>Checkbox Option 2 (initially checked)</StyledText>
          </View>
        </Section>

        <Section title="Toggle & Toggle Group">
          <SubSection label="Single Toggle">
            <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
              <StyledText style={styles.labelText}>Toggle Me</StyledText>
            </Toggle>
          </SubSection>

          <SubSection label="Toggle Group - Single Selection">
            <ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <StyledText style={styles.labelText}>Left</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <StyledText style={styles.labelText}>Center</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <StyledText style={styles.labelText}>Right</StyledText>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Toggle Group - Multiple Selection">
            <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
              <ToggleGroupItem value="bold">
                <StyledText style={styles.buttonText}>B</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="italic">
                <StyledText style={[styles.labelText, { fontStyle: "italic" }]}>I</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="underline">
                <StyledText style={[styles.labelText, { textDecorationLine: "underline" }]}>U</StyledText>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Outline Variant">
            <ToggleGroup type="single" variant="outline" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <StyledText style={styles.labelText}>Left</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <StyledText style={styles.labelText}>Center</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <StyledText style={styles.labelText}>Right</StyledText>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>

          <SubSection label="Small Size">
            <ToggleGroup type="single" size="sm" value={alignment} onValueChange={setAlignment}>
              <ToggleGroupItem value="left">
                <StyledText style={styles.labelText}>L</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="center">
                <StyledText style={styles.labelText}>C</StyledText>
              </ToggleGroupItem>
              <ToggleGroupItem value="right">
                <StyledText style={styles.labelText}>R</StyledText>
              </ToggleGroupItem>
            </ToggleGroup>
          </SubSection>
        </Section>

        <Section title="Accordion">
          <Accordion type="single" collapsible defaultValue={undefined}>
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <StyledText style={styles.buttonText}>What is React Native?</StyledText>
              </AccordionTrigger>
              <AccordionContent>
                <StyledText style={styles.labelText}>
                  React Native is a framework for building native mobile applications using React and JavaScript.
                </StyledText>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <StyledText style={styles.buttonText}>What is Expo?</StyledText>
              </AccordionTrigger>
              <AccordionContent>
                <StyledText style={styles.labelText}>
                  Expo is a platform that makes it easier to build and deploy React Native applications with a rich set of tools and services.
                </StyledText>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <StyledText style={styles.buttonText}>What are primitives?</StyledText>
              </AccordionTrigger>
              <AccordionContent>
                <StyledText style={styles.labelText}>
                  Primitives are unstyled, accessible UI components that work across iOS, Android, and Web platforms.
                </StyledText>
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
                    <StyledText style={styles.smallButtonText}>Top</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Popover on top</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Bottom</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Popover on bottom</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Top Start</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Aligned to start</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Top End</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Aligned to end</StyledText>
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
                    <StyledText style={styles.smallButtonText}>Start</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Aligned to start</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Center</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Aligned to center</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>End</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end">
                  <PopoverBody>
                    <StyledText style={styles.labelText}>Aligned to end</StyledText>
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
                    <StyledText style={styles.smallButtonText}>Offset 0</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={0}>
                  <PopoverBody>
                    <StyledText style={styles.labelText}>No offset from trigger</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Offset 16</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={16}>
                  <PopoverBody>
                    <StyledText style={styles.labelText}>16px from trigger</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Offset 32</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={32}>
                  <PopoverBody>
                    <StyledText style={styles.labelText}>32px from trigger</StyledText>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </View>
          </SubSection>

          <SubSection label="Real-World Example: User Info Card">
            <Popover>
              <PopoverTrigger asChild>
                <Button preset="outline">
                  <StyledText style={styles.buttonText}>View Profile</StyledText>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={8}>
                <View style={{ minWidth: 200 }}>
                  <View style={{ paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                    <StyledText style={[styles.buttonText, { fontSize: 16 }]}>John Doe</StyledText>
                    <StyledText style={[styles.labelText, { fontSize: 12, opacity: 0.7 }]}>john@example.com</StyledText>
                  </View>
                  <View style={{ paddingTop: spacing.sm }}>
                    <StyledText style={[styles.labelText, { fontSize: 14, marginBottom: spacing.xs }]}>Member since 2024</StyledText>
                    <StyledText style={[styles.labelText, { fontSize: 14 }]}>Premium Account</StyledText>
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
                    <StyledText style={styles.smallButtonText}>Top</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Menu on top</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Bottom</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="center">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Menu on bottom</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Bottom Start</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Aligned to start</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Bottom End</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Aligned to end</StyledText>
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
                    <StyledText style={styles.smallButtonText}>Start</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Aligned to start</StyledText>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Option 2</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Center</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="center">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Aligned to center</StyledText>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Option 2</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>End</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Aligned to end</StyledText>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>Option 2</StyledText>
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
                    <StyledText style={styles.smallButtonText}>Offset 0</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={0}>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>No offset</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Offset 16</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={16}>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>16px offset</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Offset 32</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={32}>
                  <DropdownMenuItem>
                    <StyledText style={styles.labelText}>32px offset</StyledText>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </View>
          </SubSection>

          <SubSection label="Basic Menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <StyledText style={styles.buttonText}>Open Menu</StyledText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <StyledText style={styles.labelText}>Profile</StyledText>
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <StyledText style={styles.labelText}>Settings</StyledText>
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <StyledText style={styles.labelText}>Logout</StyledText>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Checkboxes">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <StyledText style={styles.buttonText}>View Options</StyledText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <StyledText style={styles.buttonText}>Appearance</StyledText>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showBookmarks}
                  onCheckedChange={setShowBookmarks}
                >
                  <StyledText style={styles.labelText}>Show Bookmarks</StyledText>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showUrls}
                  onCheckedChange={setShowUrls}
                >
                  <StyledText style={styles.labelText}>Show Full URLs</StyledText>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Radio Group">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <StyledText style={styles.buttonText}>Panel Position</StyledText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <StyledText style={styles.buttonText}>Position</StyledText>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusBarPosition} onValueChange={setStatusBarPosition}>
                  <DropdownMenuRadioItem value="top">
                    <StyledText style={styles.labelText}>Top</StyledText>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom">
                    <StyledText style={styles.labelText}>Bottom</StyledText>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">
                    <StyledText style={styles.labelText}>Right</StyledText>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SubSection>

          <SubSection label="With Sub-menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button preset="outline">
                  <StyledText style={styles.buttonText}>Advanced Menu</StyledText>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <StyledText style={styles.labelText}>New File</StyledText>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <StyledText style={styles.labelText}>New Window</StyledText>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <StyledText style={styles.labelText}>More Tools</StyledText>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <StyledText style={styles.labelText}>Developer Tools</StyledText>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <StyledText style={styles.labelText}>Task Manager</StyledText>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <StyledText style={styles.labelText}>Extensions</StyledText>
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
                  <StyledText style={styles.buttonText}>Can I use this in my project?</StyledText>
                  <StyledText style={[styles.labelText, { fontSize: 18, opacity: 0.7 }]}>
                    {collapsibleOpen ? "−" : "+"}
                  </StyledText>
                </View>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <View style={{ paddingTop: spacing.sm }}>
                  <StyledText style={styles.labelText}>
                    Yes! This is a reusable collapsible component built with @rn-primitives/collapsible.
                    It supports smooth animations and works across iOS, Android, and Web.
                  </StyledText>
                </View>
              </CollapsibleContent>
            </Collapsible>
          </SubSection>

          <SubSection label="With Button Trigger (asChild)">
            <Collapsible>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <StyledText style={styles.buttonText}>@peduarte starred 3 repositories</StyledText>
                <CollapsibleTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={[styles.labelText, { fontSize: 12 }]}>Toggle</StyledText>
                  </Button>
                </CollapsibleTrigger>
              </View>
              <View style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: spacing.radiusMd,
                padding: spacing.md,
                marginBottom: spacing.sm
              }}>
                <StyledText style={styles.labelText}>@radix-ui/primitives</StyledText>
              </View>
              <CollapsibleContent>
                <View style={{ gap: spacing.sm }}>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <StyledText style={styles.labelText}>@radix-ui/react</StyledText>
                  </View>
                  <View style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: spacing.radiusMd,
                    padding: spacing.md
                  }}>
                    <StyledText style={styles.labelText}>@stitches/core</StyledText>
                  </View>
                </View>
              </CollapsibleContent>
            </Collapsible>
          </SubSection>
        </Section>

        <Section title="Separator">
          <SubSection label="Horizontal (Default)">
            <View style={{ gap: spacing.sm }}>
              <StyledText style={styles.labelText}>Content above separator</StyledText>
              <Separator margin={spacing.sm} />
              <StyledText style={styles.labelText}>Content below separator</StyledText>
            </View>
          </SubSection>

          <SubSection label="Size Variants">
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 40 }]}>sm</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator size="sm" margin={0} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 40 }]}>md</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator size="md" margin={0} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 40 }]}>lg</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator size="lg" margin={0} />
                </View>
              </View>
            </View>
          </SubSection>

          <SubSection label="Visual Variants">
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 70 }]}>default</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator variant="default" margin={0} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 70 }]}>muted</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator variant="muted" margin={0} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <StyledText style={[styles.labelText, { width: 70 }]}>primary</StyledText>
                <View style={{ flex: 1 }}>
                  <Separator variant="primary" margin={0} />
                </View>
              </View>
            </View>
          </SubSection>

          <SubSection label="Vertical Orientation">
            <View style={{ flexDirection: "row", alignItems: "center", height: 60 }}>
              <StyledText style={styles.labelText}>Left</StyledText>
              <Separator orientation="vertical" margin={spacing.md} />
              <StyledText style={styles.labelText}>Center</StyledText>
              <Separator orientation="vertical" variant="primary" margin={spacing.md} />
              <StyledText style={styles.labelText}>Right</StyledText>
            </View>
          </SubSection>
        </Section>

        <Section title="Tooltip">
          <SubSection label="Basic Tooltip">
            <View style={{ flexDirection: "row", gap: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
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
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Top</StyledText>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <StyledText style={styles.labelText}>Tooltip on top</StyledText>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="default" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
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
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Default</StyledText>
                  </Button>
                </TooltipTrigger>
                <TooltipContent variant="default">
                  <StyledText style={styles.labelText}>Default variant</StyledText>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <StyledText style={styles.smallButtonText}>Dark</StyledText>
                  </Button>
                </TooltipTrigger>
                <TooltipContent variant="dark">
                  <StyledText style={[styles.labelText, { color: "#fff" }]}>Dark variant</StyledText>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button preset="outline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
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
