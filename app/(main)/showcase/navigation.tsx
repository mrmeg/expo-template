import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/Accordion";
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from "@/client/components/ui/Popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from "@/client/components/ui/DropdownMenu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/client/components/ui/Collapsible";
import { Drawer } from "@/client/components/ui/Drawer";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import type { Theme } from "@/client/constants/colors";

export default function NavigationShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Dropdown state
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showUrls, setShowUrls] = useState(false);
  const [statusBarPosition, setStatusBarPosition] = useState("bottom");
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

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
                      {collapsibleOpen ? "−" : "+"}
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
        </View>
      </KeyboardAwareScrollView>
    </View>
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
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
    boldText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
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
      color: theme.colors.primaryForeground,
    },
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
  });
