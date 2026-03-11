import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "@/client/lib/keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { TextInput } from "@/client/components/ui/TextInput";
import { Switch } from "@/client/components/ui/Switch";
import { Checkbox } from "@/client/components/ui/Checkbox";
import { Toggle } from "@/client/components/ui/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/ToggleGroup";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/Accordion";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/client/components/ui/Popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuShortcut,
} from "@/client/components/ui/DropdownMenu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/client/components/ui/Collapsible";
import { Drawer } from "@/client/components/ui/Drawer";
import { Alert } from "@/client/components/ui/Alert";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/client/components/ui/Tooltip";
import { Separator } from "@/client/components/ui/Separator";
import { SignInForm } from "@/client/components/auth/SignInForm";
import { SignUpForm } from "@/client/components/auth/SignUpForm";
import { VerifyEmailForm } from "@/client/components/auth/VerifyEmailForm";
import { ForgotPasswordForm } from "@/client/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/client/components/auth/ResetPasswordForm";
import { EmptyState } from "@/client/components/ui/EmptyState";
import { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard } from "@/client/components/ui/Skeleton";
import { BottomSheet } from "@/client/components/ui/BottomSheet";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import type { Theme } from "@/client/constants/colors";

export default function ShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Buttons state
  const [loading, setLoading] = useState(false);
  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  // Forms state
  const [textValue, setTextValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [toggleValue, setToggleValue] = useState(false);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(true);
  const [singleTogglePressed, setSingleTogglePressed] = useState(false);
  const [alignment, setAlignment] = useState<string | undefined>("left");
  const [formats, setFormats] = useState<string[]>(["bold"]);

  // Navigation state
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showUrls, setShowUrls] = useState(false);
  const [statusBarPosition, setStatusBarPosition] = useState("bottom");
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  // Auth Forms state
  const [authForm, setAuthForm] = useState<string>("signin");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

  // Empty State & Skeleton state
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Bottom Sheet state
  const [basicOpen, setBasicOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [scrollOpen, setScrollOpen] = useState(false);

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          {/* ============================================ */}
          {/* BUTTONS                                      */}
          {/* ============================================ */}

          <Section title="Button Presets">
            <SubSection label="Default">
              <Button preset="default" onPress={() => console.log("Default pressed")}>
                <StyledText style={styles.buttonText}>Default Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Secondary">
              <Button preset="secondary" onPress={() => console.log("Secondary pressed")}>
                <StyledText style={styles.buttonText}>Secondary Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Outline">
              <Button preset="outline" onPress={() => console.log("Outline pressed")}>
                <StyledText style={styles.outlineButtonText}>Outline Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Ghost">
              <Button preset="ghost" onPress={() => console.log("Ghost pressed")}>
                <StyledText style={styles.ghostButtonText}>Ghost Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Link">
              <Button preset="link" onPress={() => console.log("Link pressed")}>
                <StyledText style={styles.linkButtonText}>Link Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Destructive">
              <Button preset="destructive" onPress={() => console.log("Destructive pressed")}>
                <StyledText style={styles.buttonText}>Destructive Button</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Button States">
            <SubSection label="Disabled">
              <Button preset="default" disabled onPress={() => {}}>
                <StyledText style={styles.buttonText}>Disabled Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Loading">
              <Button
                preset="default"
                loading={loading}
                onPress={handleLoadingDemo}
              >
                <StyledText style={styles.buttonText}>
                  {loading ? "Loading..." : "Click to Load"}
                </StyledText>
              </Button>
            </SubSection>

            <SubSection label="Full Width">
              <Button preset="default" fullWidth onPress={() => {}}>
                <StyledText style={styles.buttonText}>Full Width Button</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Button Sizes">
            <SubSection label="Small">
              <Button preset="default" size="sm" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Small</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Default">
              <Button preset="default" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Default</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Large">
              <Button preset="default" size="lg" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Large</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="With Icons">
            <SubSection label="Left Icon">
              <Button preset="default" onPress={() => {}}>
                <Icon name="heart" size={16} color={theme.colors.primaryForeground} />
                <StyledText style={[styles.buttonText, { marginLeft: spacing.xs }]}>
                  With Left Icon
                </StyledText>
              </Button>
            </SubSection>

            <SubSection label="Right Icon">
              <Button preset="outline" onPress={() => {}}>
                <StyledText style={[styles.outlineButtonText, { marginRight: spacing.xs }]}>
                  Continue
                </StyledText>
                <Icon name="arrow-right" size={16} color={theme.colors.primary} />
              </Button>
            </SubSection>

            <SubSection label="Icon Only">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button preset="default" onPress={() => {}}>
                  <Icon name="heart" size={18} color={theme.colors.primaryForeground} />
                </Button>
                <Button preset="outline" onPress={() => {}}>
                  <Icon name="heart" size={18} color={theme.colors.primary} />
                </Button>
                <Button preset="ghost" onPress={() => {}}>
                  <Icon name="heart" size={18} color={theme.colors.foreground} />
                </Button>
              </View>
            </SubSection>
          </Section>

          {/* ============================================ */}
          {/* FORMS                                        */}
          {/* ============================================ */}

          <Section title="Text Input">
            <SubSection label="Standard Input">
              <TextInput
                label="Username"
                placeholder="Enter your username..."
                value={textValue}
                onChangeText={setTextValue}
              />
            </SubSection>

            <SubSection label="Password Input">
              <TextInput
                label="Password"
                placeholder="Enter password..."
                secureTextEntry
                showSecureEntryToggle
                value={passwordValue}
                onChangeText={setPasswordValue}
              />
            </SubSection>
          </Section>

          <Section title="Switch">
            <SubSection label="Basic">
              <View style={styles.switchRow}>
                <StyledText style={styles.labelText}>Basic Switch</StyledText>
                <Switch checked={toggleValue} onCheckedChange={setToggleValue} />
              </View>
            </SubSection>

            <SubSection label="With Labels">
              <View style={styles.switchRow}>
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
              <View style={styles.switchRow}>
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
            <SubSection>
              <View style={styles.checkboxRow}>
                <Checkbox checked={checkbox1} onCheckedChange={setCheckbox1} />
                <StyledText style={styles.labelText}>Checkbox Option 1</StyledText>
              </View>
              <View style={[styles.checkboxRow, { marginTop: spacing.md }]}>
                <Checkbox checked={checkbox2} onCheckedChange={setCheckbox2} />
                <StyledText style={styles.labelText}>Checkbox Option 2 (initially checked)</StyledText>
              </View>
            </SubSection>
          </Section>

          <Section title="Toggle">
            <SubSection label="Single Toggle">
              <Toggle pressed={singleTogglePressed} onPressedChange={setSingleTogglePressed}>
                <StyledText style={styles.labelText}>Toggle Me</StyledText>
              </Toggle>
            </SubSection>
          </Section>

          <Section title="Toggle Group">
            <SubSection label="Single Selection">
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

            <SubSection label="Multiple Selection">
              <ToggleGroup type="multiple" value={formats} onValueChange={setFormats}>
                <ToggleGroupItem value="bold">
                  <StyledText style={[styles.labelText, { fontWeight: "bold" }]}>B</StyledText>
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

          {/* ============================================ */}
          {/* NAVIGATION                                   */}
          {/* ============================================ */}

          <Section title="Accordion">
            <Accordion type="single" collapsible defaultValue={undefined}>
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <StyledText style={styles.boldText}>What is React Native?</StyledText>
                </AccordionTrigger>
                <AccordionContent>
                  <StyledText style={styles.labelText}>
                    React Native is a framework for building native mobile applications using React and JavaScript.
                  </StyledText>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <StyledText style={styles.boldText}>What is Expo?</StyledText>
                </AccordionTrigger>
                <AccordionContent>
                  <StyledText style={styles.labelText}>
                    Expo is a platform that makes it easier to build and deploy React Native applications with a rich
                    set of tools and services.
                  </StyledText>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <StyledText style={styles.boldText}>What are primitives?</StyledText>
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
              <View style={styles.buttonRow}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button preset="default" style={styles.smallButton}>
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
                    <Button preset="default" style={styles.smallButton}>
                      <StyledText style={styles.smallButtonText}>Bottom</StyledText>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="center">
                    <PopoverBody>
                      <StyledText style={styles.labelText}>Popover on bottom</StyledText>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </View>
            </SubSection>

            <SubSection label="Real-World Example: User Info Card">
              <Popover>
                <PopoverTrigger asChild>
                  <Button preset="outline">
                    <StyledText style={styles.outlineButtonText}>View Profile</StyledText>
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" sideOffset={8}>
                  <View style={{ minWidth: 200 }}>
                    <View style={{ paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                      <StyledText style={[styles.boldText, { fontSize: 16 }]}>John Doe</StyledText>
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
            <SubSection label="Basic Menu">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline">
                    <StyledText style={styles.outlineButtonText}>Open Menu</StyledText>
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
                    <StyledText style={styles.outlineButtonText}>View Options</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    <StyledText style={styles.boldText}>Appearance</StyledText>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={showBookmarks} onCheckedChange={setShowBookmarks}>
                    <StyledText style={styles.labelText}>Show Bookmarks</StyledText>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showUrls} onCheckedChange={setShowUrls}>
                    <StyledText style={styles.labelText}>Show Full URLs</StyledText>
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SubSection>

            <SubSection label="With Radio Group">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button preset="outline">
                    <StyledText style={styles.outlineButtonText}>Panel Position</StyledText>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    <StyledText style={styles.boldText}>Position</StyledText>
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
                    <StyledText style={styles.outlineButtonText}>Advanced Menu</StyledText>
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
                  <View style={styles.collapsibleTrigger}>
                    <StyledText style={styles.boldText}>Can I use this in my project?</StyledText>
                    <StyledText style={[styles.labelText, { fontSize: 18, opacity: 0.7 }]}>
                      {collapsibleOpen ? "\u2212" : "+"}
                    </StyledText>
                  </View>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <View style={{ paddingTop: spacing.sm }}>
                    <StyledText style={styles.labelText}>
                      Yes! This is a reusable collapsible component built with @rn-primitives/collapsible. It supports
                      smooth animations and works across iOS, Android, and Web.
                    </StyledText>
                  </View>
                </CollapsibleContent>
              </Collapsible>
            </SubSection>

            <SubSection label="With Button Trigger (asChild)">
              <Collapsible>
                <View style={styles.collapsibleHeader}>
                  <StyledText style={styles.boldText}>@peduarte starred 3 repositories</StyledText>
                  <CollapsibleTrigger asChild>
                    <Button preset="outline" style={styles.smallButton}>
                      <StyledText style={[styles.labelText, { fontSize: 12 }]}>Toggle</StyledText>
                    </Button>
                  </CollapsibleTrigger>
                </View>
                <View style={[styles.collapsibleItem, { borderColor: theme.colors.border }]}>
                  <StyledText style={styles.labelText}>@radix-ui/primitives</StyledText>
                </View>
                <CollapsibleContent>
                  <View style={{ gap: spacing.sm }}>
                    <View style={[styles.collapsibleItem, { borderColor: theme.colors.border }]}>
                      <StyledText style={styles.labelText}>@radix-ui/react</StyledText>
                    </View>
                    <View style={[styles.collapsibleItem, { borderColor: theme.colors.border }]}>
                      <StyledText style={styles.labelText}>@stitches/core</StyledText>
                    </View>
                  </View>
                </CollapsibleContent>
              </Collapsible>
            </SubSection>
          </Section>

          <Section title="Drawer">
            <SubSection label="Left Drawer">
              <Drawer side="left" width={280}>
                <Drawer.Trigger asChild>
                  <Button preset="outline">
                    <StyledText style={styles.outlineButtonText}>Open Left Drawer</StyledText>
                  </Button>
                </Drawer.Trigger>
                <Drawer.Content>
                  <Drawer.Header>
                    <StyledText style={[styles.boldText, { fontSize: 18 }]}>Navigation</StyledText>
                  </Drawer.Header>
                  <Drawer.Body>
                    <View style={{ gap: spacing.md }}>
                      <StyledText style={styles.labelText}>Home</StyledText>
                      <StyledText style={styles.labelText}>Profile</StyledText>
                      <StyledText style={styles.labelText}>Settings</StyledText>
                      <StyledText style={styles.labelText}>About</StyledText>
                    </View>
                  </Drawer.Body>
                  <Drawer.Footer>
                    <Drawer.Close asChild>
                      <Button preset="outline">
                        <StyledText style={styles.outlineButtonText}>Close</StyledText>
                      </Button>
                    </Drawer.Close>
                  </Drawer.Footer>
                </Drawer.Content>
              </Drawer>
            </SubSection>

            <SubSection label="Right Drawer">
              <Drawer side="right" width="75%">
                <Drawer.Trigger asChild>
                  <Button preset="outline">
                    <StyledText style={styles.outlineButtonText}>Open Right Drawer</StyledText>
                  </Button>
                </Drawer.Trigger>
                <Drawer.Content>
                  <Drawer.Header>
                    <StyledText style={[styles.boldText, { fontSize: 18 }]}>Filters</StyledText>
                  </Drawer.Header>
                  <Drawer.Body>
                    <View style={{ gap: spacing.md }}>
                      <StyledText style={styles.labelText}>Category: All</StyledText>
                      <StyledText style={styles.labelText}>Price: $0 - $100</StyledText>
                      <StyledText style={styles.labelText}>Rating: 4+ stars</StyledText>
                      <StyledText style={[styles.labelText, { marginTop: spacing.lg, opacity: 0.6 }]}>
                        Swipe right to close (on native)
                      </StyledText>
                    </View>
                  </Drawer.Body>
                  <Drawer.Footer>
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Drawer.Close asChild>
                        <Button preset="outline" style={{ flex: 1 }}>
                          <StyledText style={styles.outlineButtonText}>Cancel</StyledText>
                        </Button>
                      </Drawer.Close>
                      <Drawer.Close asChild>
                        <Button preset="default" style={{ flex: 1 }}>
                          <StyledText style={styles.smallButtonText}>Apply</StyledText>
                        </Button>
                      </Drawer.Close>
                    </View>
                  </Drawer.Footer>
                </Drawer.Content>
              </Drawer>
            </SubSection>
          </Section>

          {/* ============================================ */}
          {/* FEEDBACK                                     */}
          {/* ============================================ */}

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
                      <Icon name="help-circle" size={24} color={theme.colors.primary} />
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

          {/* ============================================ */}
          {/* TYPOGRAPHY                                   */}
          {/* ============================================ */}

          <Section title="Typography">
            <SubSection label="Sans Serif">
              <StyledText style={styles.sansSerifText}>Sans Serif Text - Default body text</StyledText>
              <StyledText style={styles.sansSerifBoldText}>Sans Serif Bold - Emphasized text</StyledText>
            </SubSection>

            <SubSection label="Serif">
              <StyledText style={styles.serifText}>Serif Text - Elegant headings</StyledText>
              <StyledText style={styles.serifBoldText}>Serif Bold - Strong emphasis</StyledText>
            </SubSection>
          </Section>

          <Section title="Icons">
            <SubSection label="Basic Icons">
              <View style={styles.iconRow}>
                <Icon name="heart" size={24} />
                <Icon name="star" size={24} />
                <Icon name="settings" size={24} />
                <Icon name="home" size={24} />
                <Icon name="user" size={24} />
                <Icon name="mail" size={24} />
                <Icon name="bell" size={24} />
                <Icon name="search" size={24} />
                <Icon name="shopping-cart" size={24} />
              </View>
            </SubSection>

            <SubSection label="Icon Sizes">
              <View style={styles.iconRow}>
                <Icon name="heart" size={16} />
                <Icon name="heart" size={24} />
                <Icon name="heart" size={32} />
                <Icon name="heart" size={48} />
              </View>
            </SubSection>

            <SubSection label="Icon Colors">
              <View style={styles.iconRow}>
                <Icon name="heart" size={32} color={theme.colors.destructive} />
                <Icon name="star" size={32} color={theme.colors.warning} />
                <Icon name="check-circle" size={32} color={theme.colors.success} />
                <Icon name="info" size={32} color={theme.colors.primary} />
              </View>
            </SubSection>

            <SubSection label="Status Icons">
              <View style={styles.iconRow}>
                <Icon name="alert-circle" size={28} color={theme.colors.destructive} />
                <Icon name="check-circle" size={28} color={theme.colors.success} />
                <Icon name="alert-triangle" size={28} color={theme.colors.warning} />
                <Icon name="info" size={28} color={theme.colors.foreground} />
              </View>
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
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>sm</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="sm" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>md</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="md" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>lg</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="lg" margin={0} />
                  </View>
                </View>
              </View>
            </SubSection>

            <SubSection label="Visual Variants">
              <View style={{ gap: spacing.sm }}>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 70 }]}>default</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator variant="default" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 70 }]}>muted</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator variant="muted" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
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

          {/* ============================================ */}
          {/* AUTH FORMS                                   */}
          {/* ============================================ */}

          <Section title="Auth Forms">
            <SubSection label="Select Form">
              <ToggleGroup
                type="single"
                value={authForm}
                onValueChange={(val) => {
                  if (val) {
                    setAuthForm(val);
                    setForgotPasswordSuccess(false);
                    setResetPasswordSuccess(false);
                  }
                }}
              >
                <ToggleGroupItem value="signin">
                  <StyledText style={styles.labelText}>Sign In</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="signup">
                  <StyledText style={styles.labelText}>Sign Up</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="verify">
                  <StyledText style={styles.labelText}>Verify</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="forgot">
                  <StyledText style={styles.labelText}>Forgot</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="reset">
                  <StyledText style={styles.labelText}>Reset</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>

            {authForm === "signin" && (
              <SignInForm
                embedded
                onSignIn={async ({ email, password }) => {
                  console.log("Sign in:", email, password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Success",
                    messages: ["Signed in successfully!"],
                    duration: 2000,
                  });
                }}
                onForgotPassword={() => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: ["Forgot password clicked"],
                    duration: 2000,
                  });
                }}
                onSignUp={() => setAuthForm("signup")}
                onSocialSignIn={(provider) => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: [`${provider} sign in clicked`],
                    duration: 2000,
                  });
                }}
              />
            )}

            {authForm === "signup" && (
              <SignUpForm
                embedded
                onSignUp={async ({ name, email, password }) => {
                  console.log("Sign up:", name, email, password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Success",
                    messages: ["Account created successfully!"],
                    duration: 2000,
                  });
                  setAuthForm("verify");
                }}
                onSignIn={() => setAuthForm("signin")}
                onSocialSignUp={(provider) => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: [`${provider} sign up clicked`],
                    duration: 2000,
                  });
                }}
              />
            )}

            {authForm === "verify" && (
              <VerifyEmailForm
                email="user@example.com"
                embedded
                onVerify={async (code) => {
                  console.log("Verify code:", code);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Email Verified",
                    messages: ["Your email has been verified successfully!"],
                    duration: 2000,
                  });
                }}
                onResendCode={async () => {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  globalUIStore.getState().show({
                    type: "info",
                    messages: ["Verification code resent"],
                    duration: 2000,
                  });
                }}
                onBack={() => setAuthForm("signin")}
                onChangeEmail={() => setAuthForm("signup")}
              />
            )}

            {authForm === "forgot" && (
              <ForgotPasswordForm
                embedded
                onSubmit={async (email) => {
                  console.log("Forgot password:", email);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  setForgotPasswordSuccess(true);
                }}
                onBack={() => setAuthForm("signin")}
                success={forgotPasswordSuccess}
              />
            )}

            {authForm === "reset" && (
              <ResetPasswordForm
                embedded
                onSubmit={async (password) => {
                  console.log("Reset password:", password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  setResetPasswordSuccess(true);
                }}
                onBack={() => setAuthForm("signin")}
                success={resetPasswordSuccess}
              />
            )}
          </Section>

          {/* ============================================ */}
          {/* EMPTY STATE & SKELETON                       */}
          {/* ============================================ */}

          <Section title="Empty State">
            <SubSection label="Full (icon + title + description + action)">
              <View style={styles.demoCard}>
                <EmptyState
                  icon="inbox"
                  title="No messages"
                  description="You don't have any messages yet. Start a conversation to get going."
                  actionLabel="Compose"
                  onAction={() => {}}
                />
              </View>
            </SubSection>

            <SubSection label="Minimal (title only)">
              <View style={styles.demoCard}>
                <EmptyState title="Nothing here yet" />
              </View>
            </SubSection>

            <SubSection label="Search empty state">
              <View style={styles.demoCard}>
                <EmptyState
                  icon="search"
                  title="No results found"
                  description="Try adjusting your search terms or filters."
                />
              </View>
            </SubSection>

            <SubSection label="As ListEmptyComponent">
              <View style={styles.demoCard}>
                <EmptyState
                  icon="folder"
                  title="No files"
                  description="Upload your first file to get started."
                  actionLabel="Upload"
                  onAction={() => {}}
                />
              </View>
            </SubSection>

            <SubSection label="Custom children">
              <View style={styles.demoCard}>
                <EmptyState
                  icon="wifi-off"
                  title="You're offline"
                  description="Check your internet connection and try again."
                >
                  <View style={styles.customChildRow}>
                    <Icon name="info" size={16} color={theme.colors.mutedForeground} />
                    <SansSerifText style={styles.customChildText}>
                      Last synced 5 minutes ago
                    </SansSerifText>
                  </View>
                </EmptyState>
              </View>
            </SubSection>
          </Section>

          <Section title="Skeleton">
            <SubSection label="Base shapes">
              <View style={styles.skeletonRow}>
                <Skeleton width={80} height={20} />
                <Skeleton width={120} height={20} />
                <Skeleton width={60} height={20} />
              </View>
              <View style={[styles.skeletonRow, { marginTop: spacing.sm }]}>
                <Skeleton width={40} height={40} circle />
                <Skeleton width={48} height={48} circle />
                <Skeleton width={32} height={32} circle />
              </View>
            </SubSection>

            <SubSection label="Text placeholder">
              <SkeletonText lines={4} />
            </SubSection>

            <SubSection label="Avatar">
              <View style={styles.skeletonRow}>
                <SkeletonAvatar size={32} />
                <SkeletonAvatar size={40} />
                <SkeletonAvatar size={48} />
                <SkeletonAvatar size={56} />
              </View>
            </SubSection>

            <SubSection label="Card">
              <SkeletonCard />
            </SubSection>

            <SubSection label="Card (no image)">
              <SkeletonCard showImage={false} />
            </SubSection>

            <SubSection label="Toggle: Skeleton vs Real content">
              <Button
                preset="outline"
                onPress={() => setShowSkeleton(!showSkeleton)}
                style={{ marginBottom: spacing.md }}
              >
                <SansSerifText style={{ color: theme.colors.foreground }}>
                  {showSkeleton ? "Show real content" : "Show skeleton"}
                </SansSerifText>
              </Button>

              {showSkeleton ? (
                <SkeletonCard showAvatar textLines={2} />
              ) : (
                <View style={styles.realCard}>
                  <View style={styles.realImagePlaceholder}>
                    <Icon name="image" size={32} color={theme.colors.mutedForeground} />
                  </View>
                  <View style={styles.realCardBody}>
                    <View style={styles.realAvatarRow}>
                      <View style={styles.realAvatar}>
                        <SansSerifBoldText style={styles.realAvatarText}>JD</SansSerifBoldText>
                      </View>
                      <View>
                        <SansSerifBoldText style={styles.realName}>Jane Doe</SansSerifBoldText>
                        <SansSerifText style={styles.realMeta}>2 hours ago</SansSerifText>
                      </View>
                    </View>
                    <SansSerifText style={styles.realBodyText}>
                      This is the actual loaded content that replaces the skeleton placeholder.
                    </SansSerifText>
                  </View>
                </View>
              )}
            </SubSection>
          </Section>

          {/* ============================================ */}
          {/* BOTTOM SHEET                                 */}
          {/* ============================================ */}

          <Section title="Bottom Sheet">
            {/* Basic open/close */}
            <SubSection label="Basic">
              <BottomSheet open={basicOpen} onOpenChange={setBasicOpen}>
                <BottomSheet.Trigger asChild>
                  <Button preset="default">
                    <SansSerifText style={{ color: theme.colors.accentForeground }}>
                      Open basic sheet
                    </SansSerifText>
                  </Button>
                </BottomSheet.Trigger>
                <BottomSheet.Content>
                  <BottomSheet.Handle />
                  <BottomSheet.Body>
                    <View style={styles.sheetSection}>
                      <SansSerifBoldText style={styles.sheetTitle}>
                        Hello from the bottom sheet
                      </SansSerifBoldText>
                      <SansSerifText style={styles.sheetDescription}>
                        This is a basic bottom sheet. Swipe down or tap the backdrop to close.
                      </SansSerifText>
                    </View>
                    <BottomSheet.Close asChild>
                      <Button preset="outline" fullWidth>
                        <SansSerifText style={{ color: theme.colors.foreground }}>
                          Close
                        </SansSerifText>
                      </Button>
                    </BottomSheet.Close>
                  </BottomSheet.Body>
                </BottomSheet.Content>
              </BottomSheet>
            </SubSection>

            {/* Multiple snap points */}
            <SubSection label="Snap Points (25%, 50%, 90%)">
              <BottomSheet
                open={snapOpen}
                onOpenChange={setSnapOpen}
                snapPoints={["25%", "50%", "90%"]}
              >
                <BottomSheet.Trigger asChild>
                  <Button preset="outline">
                    <SansSerifText style={{ color: theme.colors.foreground }}>
                      Open with snap points
                    </SansSerifText>
                  </Button>
                </BottomSheet.Trigger>
                <BottomSheet.Content>
                  <BottomSheet.Handle />
                  <BottomSheet.Body>
                    <SansSerifBoldText style={styles.sheetTitle}>
                      Snap Points
                    </SansSerifBoldText>
                    <SansSerifText style={styles.sheetDescription}>
                      This sheet has three snap points at 25%, 50%, and 90%.
                      On native, try swiping to snap between them.
                    </SansSerifText>
                  </BottomSheet.Body>
                </BottomSheet.Content>
              </BottomSheet>
            </SubSection>

            {/* Full compound */}
            <SubSection label="Full Compound (Handle + Header + Body + Footer)">
              <BottomSheet open={fullOpen} onOpenChange={setFullOpen} snapPoints={["60%"]}>
                <BottomSheet.Trigger asChild>
                  <Button preset="outline">
                    <SansSerifText style={{ color: theme.colors.foreground }}>
                      Open full sheet
                    </SansSerifText>
                  </Button>
                </BottomSheet.Trigger>
                <BottomSheet.Content>
                  <BottomSheet.Handle />
                  <BottomSheet.Header>
                    <View style={styles.sheetHeaderRow}>
                      <SansSerifBoldText style={styles.sheetHeaderTitle}>
                        Share with...
                      </SansSerifBoldText>
                      <BottomSheet.Close asChild>
                        <Button preset="ghost" size="sm">
                          <Icon name="x" size={20} color={theme.colors.mutedForeground} />
                        </Button>
                      </BottomSheet.Close>
                    </View>
                  </BottomSheet.Header>
                  <BottomSheet.Body>
                    {["Alice Johnson", "Bob Smith", "Carol Williams", "David Brown"].map(
                      (name) => (
                        <View key={name} style={styles.contactRow}>
                          <View style={styles.contactAvatar}>
                            <SansSerifBoldText style={styles.contactInitial}>
                              {name[0]}
                            </SansSerifBoldText>
                          </View>
                          <SansSerifText style={styles.contactName}>{name}</SansSerifText>
                        </View>
                      )
                    )}
                  </BottomSheet.Body>
                  <BottomSheet.Footer>
                    <Button preset="default" fullWidth onPress={() => setFullOpen(false)}>
                      <SansSerifText style={{ color: theme.colors.accentForeground }}>
                        Share
                      </SansSerifText>
                    </Button>
                  </BottomSheet.Footer>
                </BottomSheet.Content>
              </BottomSheet>
            </SubSection>

            {/* Scrollable content */}
            <SubSection label="Scrollable Content">
              <BottomSheet open={scrollOpen} onOpenChange={setScrollOpen} snapPoints={["70%"]}>
                <BottomSheet.Trigger asChild>
                  <Button preset="outline">
                    <SansSerifText style={{ color: theme.colors.foreground }}>
                      Open scrollable sheet
                    </SansSerifText>
                  </Button>
                </BottomSheet.Trigger>
                <BottomSheet.Content>
                  <BottomSheet.Handle />
                  <BottomSheet.Header>
                    <SansSerifBoldText style={styles.sheetHeaderTitle}>
                      Terms of Service
                    </SansSerifBoldText>
                  </BottomSheet.Header>
                  <BottomSheet.Body>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SansSerifText key={i} style={styles.loremParagraph}>
                        {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        Ut enim ad minim veniam, quis nostrud exercitation ullamco.
                      </SansSerifText>
                    ))}
                  </BottomSheet.Body>
                  <BottomSheet.Footer>
                    <Button preset="default" fullWidth onPress={() => setScrollOpen(false)}>
                      <SansSerifText style={{ color: theme.colors.accentForeground }}>
                        Accept
                      </SansSerifText>
                    </Button>
                  </BottomSheet.Footer>
                </BottomSheet.Content>
              </BottomSheet>
            </SubSection>
          </Section>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Layout
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

    // Shared text styles
    buttonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primaryForeground,
    },
    outlineButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
    },
    ghostButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
    },
    linkButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
    boldText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
    },
    smallButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    smallButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      fontSize: 12,
      color: theme.colors.primaryForeground,
    },

    // Forms
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    // Navigation
    buttonRow: {
      flexDirection: "row",
      gap: spacing.md,
      flexWrap: "wrap",
    },
    collapsibleTrigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
    },
    collapsibleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    collapsibleItem: {
      borderWidth: 1,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },

    // Feedback
    tooltipRow: {
      flexDirection: "row",
      gap: spacing.lg,
      flexWrap: "wrap",
      alignItems: "center",
    },

    // Typography
    sansSerifText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    sansSerifBoldText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    serifText: {
      fontFamily: fontFamilies.serif.regular,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    serifBoldText: {
      fontFamily: fontFamilies.serif.bold,
      color: theme.colors.foreground,
    },
    iconRow: {
      flexDirection: "row",
      gap: spacing.md,
      flexWrap: "wrap",
      alignItems: "center",
    },
    separatorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    // Empty State & Skeleton
    demoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    customChildRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    customChildText: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    skeletonRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    realCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    realImagePlaceholder: {
      height: 140,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    realCardBody: {
      padding: spacing.md,
      gap: spacing.md,
    },
    realAvatarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    realAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    realAvatarText: {
      fontSize: 14,
      color: theme.colors.accentForeground,
    },
    realName: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    realMeta: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    realBodyText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.foreground,
    },

    // Bottom Sheet
    sheetSection: {
      marginBottom: spacing.lg,
    },
    sheetTitle: {
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    sheetDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedForeground,
    },
    sheetHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sheetHeaderTitle: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    contactAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    contactInitial: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    contactName: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    loremParagraph: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.foreground,
      marginBottom: spacing.md,
    },
  });
