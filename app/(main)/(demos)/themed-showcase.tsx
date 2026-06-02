import React, { useEffect, useMemo, useReducer } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@mrmeg/expo-ui/components/Card";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Checkbox } from "@mrmeg/expo-ui/components/Checkbox";
import { Progress } from "@mrmeg/expo-ui/components/Progress";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@mrmeg/expo-ui/components/Tabs";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { spacing, fontFamilies } from "@mrmeg/expo-ui/constants";
import type { Theme, ThemeColors } from "@mrmeg/expo-ui/constants";
import { Section, SubSection, ThemeToggle } from "@/client/showcase";

/**
 * Themed Showcase
 *
 * Exercises the package's color-override API (`useThemeStore().setColors`).
 * The package ships a neutral zinc + teal palette; a host app forwards its own
 * brand palette so every package component (Button, Badge, inputs, …) resolves
 * against the same source of truth. This screen injects a brand palette for
 * BOTH light and dark schemes and lets you flip between them live, alongside
 * the normal light/dark toggle, so the override can be verified in all four
 * combinations.
 *
 * The override is applied globally (the theme store is a singleton), so it also
 * re-skins the navigation header while this screen is mounted. We clear the
 * override on unmount to leave the rest of the app on the package defaults.
 */

type BrandPalette = {
  label: string;
  light: Partial<ThemeColors>;
  dark: Partial<ThemeColors>;
};

// `default` intentionally has no overrides — selecting it clears `setColors`
// and the gallery falls back to the package's built-in zinc + teal palette.
const PALETTES: Record<string, BrandPalette | null> = {
  default: null,

  violet: {
    label: "Violet",
    light: {
      primary: "#6d28d9",
      primaryForeground: "#ffffff",
      secondary: "#ede9fe",
      secondaryForeground: "#5b21b6",
      accent: "#f59e0b",
      accentForeground: "#ffffff",
      muted: "#f5f3ff",
      mutedForeground: "#7c3aed",
      ring: "#8b5cf6",
      border: "#ddd6fe",
      input: "#ddd6fe",
    },
    dark: {
      primary: "#a78bfa",
      primaryForeground: "#2e1065",
      secondary: "#4c1d95",
      secondaryForeground: "#ede9fe",
      accent: "#fbbf24",
      accentForeground: "#1f2937",
      muted: "#3b0764",
      mutedForeground: "#c4b5fd",
      ring: "#a78bfa",
      border: "#5b21b6",
      input: "#5b21b6",
    },
  },

  rose: {
    label: "Rose",
    light: {
      primary: "#e11d48",
      primaryForeground: "#ffffff",
      secondary: "#ffe4e6",
      secondaryForeground: "#9f1239",
      accent: "#0ea5e9",
      accentForeground: "#ffffff",
      muted: "#fff1f2",
      mutedForeground: "#be123c",
      ring: "#fb7185",
      border: "#fecdd3",
      input: "#fecdd3",
    },
    dark: {
      primary: "#fb7185",
      primaryForeground: "#4c0519",
      secondary: "#881337",
      secondaryForeground: "#ffe4e6",
      accent: "#38bdf8",
      accentForeground: "#082f49",
      muted: "#4c0519",
      mutedForeground: "#fda4af",
      ring: "#fb7185",
      border: "#9f1239",
      input: "#9f1239",
    },
  },
};

const PALETTE_ORDER = ["default", "violet", "rose"] as const;

// Tokens worth showing as swatches — these are the ones the brand palettes
// re-skin, so the row makes the active override obvious at a glance.
const SWATCH_KEYS: (keyof ThemeColors)[] = [
  "primary",
  "secondary",
  "accent",
  "muted",
  "border",
  "ring",
];

type ShowcaseState = {
  palette: string;
  switchOn: boolean;
  checked: boolean;
  tab: string;
  name: string;
};

type ShowcaseAction =
  | { type: "paletteChanged"; palette: string }
  | { type: "switchChanged"; switchOn: boolean }
  | { type: "checkedChanged"; checked: boolean }
  | { type: "tabChanged"; tab: string }
  | { type: "nameChanged"; name: string };

const INITIAL_SHOWCASE_STATE: ShowcaseState = {
  palette: "violet",
  switchOn: true,
  checked: true,
  tab: "buttons",
  name: "",
};

function showcaseReducer(
  state: ShowcaseState,
  action: ShowcaseAction
): ShowcaseState {
  switch (action.type) {
  case "paletteChanged":
    return { ...state, palette: action.palette };
  case "switchChanged":
    return { ...state, switchOn: action.switchOn };
  case "checkedChanged":
    return { ...state, checked: action.checked };
  case "tabChanged":
    return { ...state, tab: action.tab };
  case "nameChanged":
    return { ...state, name: action.name };
  }
}

export default function ThemedShowcaseScreen() {
  const { theme, scheme } = useTheme();
  const setColors = useThemeStore((s) => s.setColors);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [state, dispatch] = useReducer(
    showcaseReducer,
    INITIAL_SHOWCASE_STATE
  );
  const { palette, switchOn, checked, tab, name } = state;

  // Push the selected brand palette into the package theme store. Selecting
  // "default" clears the override so components fall back to the package
  // palette. Re-runs whenever the selection changes.
  useEffect(() => {
    const selected = PALETTES[palette];
    setColors(selected ? { light: selected.light, dark: selected.dark } : {});
  }, [palette, setColors]);

  // Leave the app on package defaults once this screen is gone.
  useEffect(() => {
    return () => {
      useThemeStore.getState().setColors({});
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Injected Palette">
            <SubSection label="Choose a brand palette (applied via setColors)">
              <ToggleGroup
                type="single"
                value={palette}
                onValueChange={(val) => {
                  if (val) {
                    dispatch({ type: "paletteChanged", palette: val });
                  }
                }}
              >
                {PALETTE_ORDER.map((key) => (
                  <ToggleGroupItem key={key} value={key}>
                    <StyledText style={styles.labelText}>
                      {PALETTES[key]?.label ?? "Package Default"}
                    </StyledText>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </SubSection>

            <SubSection label={`Active tokens — ${scheme} scheme`}>
              <View style={styles.swatchRow}>
                {SWATCH_KEYS.map((key) => (
                  <View key={key} style={styles.swatch}>
                    <View
                      style={[
                        styles.swatchChip,
                        { backgroundColor: theme.colors[key], borderColor: theme.colors.border },
                      ]}
                    />
                    <StyledText style={styles.swatchLabel}>{key}</StyledText>
                  </View>
                ))}
              </View>
            </SubSection>
          </Section>

          {/* The gallery below uses ONLY package components, so every color it
              shows comes from the injected override (or package defaults). */}

          <Section title="Buttons">
            <View style={styles.row}>
              <Button preset="default" text="Default" onPress={() => {}} />
              <Button preset="secondary" text="Secondary" onPress={() => {}} />
              <Button preset="outline" onPress={() => {}}>
                <StyledText style={styles.outlineText}>Outline</StyledText>
              </Button>
              <Button preset="ghost" onPress={() => {}}>
                <StyledText style={styles.ghostText}>Ghost</StyledText>
              </Button>
              <Button preset="link" onPress={() => {}}>
                <StyledText style={styles.linkText}>Link</StyledText>
              </Button>
              <Button preset="destructive" text="Destructive" onPress={() => {}} />
            </View>
          </Section>

          <Section title="Badges">
            <SubSection label="default uses primary; the override re-skins it">
              <View style={styles.row}>
                <Badge text="Default" />
                <Badge variant="secondary" text="Secondary" />
                <Badge variant="outline" text="Outline" />
                <Badge variant="destructive" text="Destructive" />
              </View>
            </SubSection>
          </Section>

          <Section title="Form Controls">
            <SubSection label="Text Input (border + focus ring follow the palette)">
              <TextInput
                label="Display name"
                placeholder="Type to focus and see the ring color"
                value={name}
                onChangeText={(value) =>
                  dispatch({ type: "nameChanged", name: value })
                }
              />
            </SubSection>
            <SubSection label="Switch & Checkbox">
              <View style={styles.controlRow}>
                <Switch
                  checked={switchOn}
                  onCheckedChange={(value) =>
                    dispatch({ type: "switchChanged", switchOn: value })
                  }
                />
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    dispatch({ type: "checkedChanged", checked: value })
                  }
                />
                <StyledText style={styles.labelText}>
                  Toggles use the active primary color
                </StyledText>
              </View>
            </SubSection>
          </Section>

          <Section title="Progress">
            <View style={{ gap: spacing.sm }}>
              <Progress value={40} variant="default" />
              <Progress value={65} variant="accent" />
              <Progress value={90} variant="destructive" />
            </View>
          </Section>

          <Section title="Tabs">
            <Tabs
              value={tab}
              onValueChange={(value) =>
                dispatch({ type: "tabChanged", tab: value })
              }
            >
              <TabsList>
                <TabsTrigger value="buttons">
                  <StyledText>Overview</StyledText>
                </TabsTrigger>
                <TabsTrigger value="details">
                  <StyledText>Details</StyledText>
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <StyledText>Activity</StyledText>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="buttons">
                <StyledText style={styles.labelText}>
                  The active tab indicator follows the injected palette.
                </StyledText>
              </TabsContent>
              <TabsContent value="details">
                <StyledText style={styles.labelText}>Details content.</StyledText>
              </TabsContent>
              <TabsContent value="activity">
                <StyledText style={styles.labelText}>Activity content.</StyledText>
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Card & Separator">
            <Card>
              <CardHeader>
                <CardTitle>Branded card</CardTitle>
                <CardDescription>Surfaces, borders, and text all resolve from one palette.</CardDescription>
              </CardHeader>
              <CardContent>
                <StyledText style={{ color: theme.colors.text }}>
                  This card and the button below render with whichever palette is injected.
                </StyledText>
                <Separator variant="primary" margin={spacing.md} />
                <StyledText style={{ color: theme.colors.mutedForeground }}>
                  The separator uses the primary token.
                </StyledText>
              </CardContent>
              <CardFooter>
                <Button preset="default" size="sm" text="Primary action" onPress={() => {}} />
              </CardFooter>
            </Card>
          </Section>
        </View>
      </ScrollView>
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
      marginTop: spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
      alignItems: "center",
    },
    controlRow: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
    },
    outlineText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
    },
    ghostText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
    },
    linkText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
    swatchRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    swatch: {
      alignItems: "center",
      gap: spacing.xs,
      width: 64,
    },
    swatchChip: {
      width: 44,
      height: 44,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
    },
    swatchLabel: {
      fontFamily: fontFamilies.sansSerif.regular,
      fontSize: 11,
      color: theme.colors.mutedForeground,
    },
  });
