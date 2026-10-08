import React, { useEffect, useLayoutEffect, useReducer } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Screen } from "@mrmeg/expo-ui/components/Screen";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@mrmeg/expo-ui/components/Card";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@mrmeg/expo-ui/components/Item";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useThemeStore } from "@mrmeg/expo-ui/state";
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { ThemeToggle } from "@/client/showcase";
import {
  DARK_CANDIDATES,
  DEFAULT_DARK_CANDIDATE,
  DEFAULT_LIGHT_CANDIDATE,
  LIGHT_CANDIDATES,
  SURFACE_TIERS,
  findCandidate,
  oklabLightness,
  rampToColors,
  type SurfaceCandidate,
} from "@/client/showcase/surfaceLabCandidates";
import {
  DEFAULT_SHADOW_TREATMENT,
  SHADOW_TREATMENTS,
  findTreatment,
  previousShadow,
  type ShadowPreset,
  type ShadowTreatment,
} from "@/client/showcase/surfaceLabShadows";

/**
 * Surface Lab
 *
 * A tuning bench for the `@mrmeg/expo-ui` surface system. Pick a dark ramp, a
 * light ramp, and a shadow treatment; the picks are pushed into the theme store
 * with `setColors` (the pattern `ThemedShowcaseScreen` uses), so every package
 * component, the specimen below, and the rest of the app re-skin live. The
 * override is cleared on unmount so the app returns to the package defaults.
 *
 * The Lab opens on what ships: the zinc ramps ("Current") and the edge-lit
 * shadows, which are `useTheme().getShadowStyle`. Candidate data lives in
 * `surfaceLabCandidates.ts` (Deep, Lifted, Slate and Canvas stay as alternate
 * presets for forks); `surfaceLabShadows.ts` freezes the old shadow presets as
 * "Previous" for the same comparison.
 */

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Dark mode: higher is lighter",
    body: "Each elevation step adds a little light. Shadows only help once the base is lifted off near-black, and on a very dark base the edge highlight does the work instead.",
  },
  {
    title: "Even steps in a perceptual space",
    body: "Define the ramp in OKLCH lightness with roughly equal steps, then emit hex. Hex picked by eye bunches up.",
  },
  {
    title: "A trace of hue",
    body: "Chroma of 0.004 to 0.012 toward a cool hue reads as material instead of gray plastic, and stays quiet enough for the accent to own color.",
  },
  {
    title: "Edge light on raised surfaces in dark",
    body: "A 1px inset top highlight plus a deeper, larger black shadow. In light, the shadow does the work and the highlight is unnecessary.",
  },
  {
    title: "Light mode: canvas and paper",
    body: "An off-white background with white cards lifts them without heavier shadows; white on white leans on border and shadow instead.",
  },
  {
    title: "Contrast floors don't move",
    body: "Text stays at 12:1 or better and dim text at 7:1 (6:1 on muted). Every candidate here passes the package floors.",
  },
];

const FEED: { title: string; body: string; tag: string }[] = [
  { title: "Weekly summary", body: "Revenue is up 12% on last week across every channel.", tag: "Report" },
  { title: "Comment on Atlas", body: "Maya replied to your design review thread.", tag: "Mention" },
  { title: "Deploy finished", body: "Build 4.18.2 is live in all regions.", tag: "Release" },
];

const CHIPS = ["Editor", "Billing", "Read only"];

const MENU_ROWS: { icon: IconName; label: string; destructive?: boolean }[] = [
  { icon: "pencil", label: "Rename" },
  { icon: "copy", label: "Duplicate" },
  { icon: "trash", label: "Delete", destructive: true },
];

type LabState = {
  dark: string;
  light: string;
  shadow: ShadowTreatment;
  email: string;
  push: boolean;
};

type LabAction =
  | { type: "darkChanged"; dark: string }
  | { type: "lightChanged"; light: string }
  | { type: "shadowChanged"; shadow: ShadowTreatment }
  | { type: "emailChanged"; email: string }
  | { type: "pushChanged"; push: boolean };

const INITIAL_LAB_STATE: LabState = {
  dark: DEFAULT_DARK_CANDIDATE,
  light: DEFAULT_LIGHT_CANDIDATE,
  // The Lab opens on the package defaults: current palettes, edge-lit shadows.
  shadow: DEFAULT_SHADOW_TREATMENT,
  email: "",
  push: true,
};

function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
  case "darkChanged":
    return { ...state, dark: action.dark };
  case "lightChanged":
    return { ...state, light: action.light };
  case "shadowChanged":
    return { ...state, shadow: action.shadow };
  case "emailChanged":
    return { ...state, email: action.email };
  case "pushChanged":
    return { ...state, push: action.push };
  }
}

function idForLabel(list: SurfaceCandidate[], label: string): string {
  return list.find((candidate) => candidate.label === label)?.id ?? list[0].id;
}

interface LabSectionProps {
  title: string;
  description?: string;
  /** Pad the content to the screen gutter. Off for `ItemGroup`, whose rows carry their own inset. */
  inset?: boolean;
  children: React.ReactNode;
}

/** One flat section: a heading and caption on the gutter, then its content. */
function LabSection({ title, description, inset = true, children }: LabSectionProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  return (
    <View style={styles.section}>
      <View style={[styles.gutter, styles.sectionHeader]}>
        <StyledText semantic="heading" accessibilityRole="header">{title}</StyledText>
        {!!description && <StyledText semantic="caption" style={styles.dim}>{description}</StyledText>}
      </View>
      {inset ? <View style={styles.gutter}>{children}</View> : children}
    </View>
  );
}

export default function SurfaceLabScreen() {
  const { theme, scheme, getShadowStyle, withAlpha } = useTheme();
  const setColors = useThemeStore((s) => s.setColors);
  const styles = themedStyles(theme);

  const [state, dispatch] = useReducer(labReducer, INITIAL_LAB_STATE);
  const { shadow, email, push } = state;
  const darkCandidate = findCandidate(DARK_CANDIDATES, state.dark);
  const lightCandidate = findCandidate(LIGHT_CANDIDATES, state.light);
  const activeCandidate = scheme === "dark" ? darkCandidate : lightCandidate;
  const treatment = findTreatment(shadow);

  // Push both picks into the package theme store; `useTheme` layers the one
  // for the active scheme over the defaults. A layout effect so the first frame
  // already carries the lead candidate instead of flashing the package colors.
  useLayoutEffect(() => {
    setColors({
      light: rampToColors(lightCandidate.ramp),
      dark: rampToColors(darkCandidate.ramp),
    });
  }, [darkCandidate, lightCandidate, setColors]);

  // Leave the app on package defaults once this screen is gone.
  useEffect(() => {
    return () => {
      useThemeStore.getState().setColors({});
    };
  }, []);

  // `edge-lit` is the package's own preset (the default); `previous` is the
  // frozen copy of the old ones.
  const surfaceShadow = (preset: ShadowPreset): ViewStyle =>
    shadow === "previous"
      ? ({ boxShadow: previousShadow(scheme, preset) } as ViewStyle)
      : getShadowStyle(preset);
  const cardShadow = surfaceShadow("subtle");
  const popoverShadow = surfaceShadow("soft");
  const toastShadow = surfaceShadow("elevated");

  return (
    <Screen edges={["bottom"]} scroll padded={false} contentContainerStyle={styles.content}>
      <View style={[styles.gutter, styles.stack]}>
        <SectionHeader
          eyebrow="Surface Lab"
          title="Depth you can tune"
          description="Compare surface ramps and shadow treatments on one specimen. Picks re-skin the whole app while this screen is open."
        />
        <View style={styles.principles}>
          {PRINCIPLES.map((principle, index) => (
            <View key={principle.title} style={styles.principle}>
              <StyledText semantic="label">{`${index + 1}. ${principle.title}`}</StyledText>
              <StyledText semantic="caption" style={styles.dim}>{principle.body}</StyledText>
            </View>
          ))}
        </View>
      </View>

      <LabSection
        title="Candidates"
        description="Dark and light picks are independent. The scheme toggle shows whichever applies."
      >
        <View style={styles.stack}>
          <ThemeToggle />

          <View style={styles.control}>
            <StyledText semantic="label">
              {scheme === "dark" ? "Dark candidate (active)" : "Dark candidate"}
            </StyledText>
            <SegmentedControl
              values={DARK_CANDIDATES.map((candidate) => candidate.label)}
              value={darkCandidate.label}
              onValueChange={(label) =>
                dispatch({ type: "darkChanged", dark: idForLabel(DARK_CANDIDATES, label) })
              }
            />
            <StyledText semantic="caption" style={styles.dim}>{darkCandidate.summary}</StyledText>
          </View>

          <View style={styles.control}>
            <StyledText semantic="label">
              {scheme === "light" ? "Light candidate (active)" : "Light candidate"}
            </StyledText>
            <SegmentedControl
              values={LIGHT_CANDIDATES.map((candidate) => candidate.label)}
              value={lightCandidate.label}
              onValueChange={(label) =>
                dispatch({ type: "lightChanged", light: idForLabel(LIGHT_CANDIDATES, label) })
              }
            />
            <StyledText semantic="caption" style={styles.dim}>{lightCandidate.summary}</StyledText>
          </View>

          <View style={styles.control}>
            <StyledText semantic="label">Shadow treatment</StyledText>
            <SegmentedControl
              values={SHADOW_TREATMENTS.map((item) => item.label)}
              value={treatment.label}
              onValueChange={(label) =>
                dispatch({
                  type: "shadowChanged",
                  shadow: SHADOW_TREATMENTS.find((item) => item.label === label)?.id ?? DEFAULT_SHADOW_TREATMENT,
                })
              }
            />
            <StyledText semantic="caption" style={styles.dim}>{treatment.summary}</StyledText>
          </View>
        </View>
      </LabSection>

      <LabSection
        title="Tier ladder"
        description={`${activeCandidate.name}. L is OKLab lightness; in dark each tier should add a little light.`}
        inset={false}
      >
        <ItemGroup>
          {SURFACE_TIERS.map(({ token, role }) => {
            const hex = activeCandidate.ramp[token];
            return (
              <Item key={token}>
                <View style={[styles.swatch, { backgroundColor: hex }]} />
                <ItemContent>
                  <ItemTitle>{token}</ItemTitle>
                  <ItemDescription>{`${hex} · ${role}`}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ItemDescription>{`L ${oklabLightness(hex).toFixed(3)}`}</ItemDescription>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </LabSection>

      <LabSection
        title="Cards on background"
        description="Collection items: a card is one entry in a feed."
      >
        <View style={styles.cardStack}>
          {FEED.map((entry) => (
            <Card key={entry.title} style={cardShadow}>
              <CardHeader>
                <CardTitle>{entry.title}</CardTitle>
                <CardDescription>{entry.body}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Badge variant="secondary" text={entry.tag} />
              </CardFooter>
            </Card>
          ))}
        </View>
      </LabSection>

      <LabSection
        title="Muted on card"
        description="A muted chip and a text input sitting on the card tier."
      >
        <Card style={cardShadow}>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>Pick a role, then send the invite.</CardDescription>
          </CardHeader>
          <CardContent>
            <View style={styles.chipRow}>
              {CHIPS.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <StyledText size="sm">{chip}</StyledText>
                </View>
              ))}
            </View>
            <TextInput
              label="Email"
              placeholder="teammate@example.com"
              value={email}
              onChangeText={(value) => dispatch({ type: "emailChanged", email: value })}
            />
          </CardContent>
        </Card>
      </LabSection>

      <LabSection
        title="Popover over card"
        description="A static panel on the popover tier, drawn with the overlay styles so it stays in view. It has to read as a step above the card, not only a hairline."
      >
        <View>
          <Card style={cardShadow}>
            <CardHeader>
              <CardTitle>Project Atlas</CardTitle>
              <CardDescription>Last edited two hours ago by Maya.</CardDescription>
            </CardHeader>
            <CardContent>
              <StyledText semantic="caption" style={styles.dim}>
                14 files, 3 collaborators, shared with the design team.
              </StyledText>
            </CardContent>
          </Card>
          <View style={[styles.popover, popoverShadow]}>
            {MENU_ROWS.map((row, index) => (
              <React.Fragment key={row.label}>
                {index === MENU_ROWS.length - 1 && <Separator margin={spacing.xs} />}
                <View style={styles.menuRow}>
                  <Icon
                    name={row.icon}
                    size={16}
                    color={row.destructive ? "destructive" : "mutedForeground"}
                    decorative
                  />
                  <StyledText size="base" style={row.destructive ? styles.destructive : undefined}>
                    {row.label}
                  </StyledText>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      </LabSection>

      <LabSection
        title="Toast"
        description="A Notification-style surface on the popover tier with the strong hairline."
      >
        <View style={[styles.toast, toastShadow]}>
          <View style={[styles.toastIcon, { backgroundColor: withAlpha(theme.colors.success, 0.08) }]}>
            <Icon name="circle-check-big" size={18} color="success" decorative />
          </View>
          <View style={styles.toastBody}>
            <StyledText size="base" fontWeight="semibold" numberOfLines={1}>Changes saved</StyledText>
            <StyledText size="sm" style={styles.mutedForeground} numberOfLines={2}>
              Your workspace is up to date.
            </StyledText>
          </View>
          <Icon name="x" size={16} color="mutedForeground" decorative />
        </View>
      </LabSection>

      <LabSection
        title="ItemGroup"
        description="Flat rows on background: hairlines from border, muted media tiles, a switch on the muted track."
        inset={false}
      >
        <ItemGroup footer="Rows carry the 16 pt inset; there is no box around the group.">
          <Item>
            <ItemMedia icon="bell" />
            <ItemContent>
              <ItemTitle>Push notifications</ItemTitle>
              <ItemDescription>Replies and mentions</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={push}
                onCheckedChange={(value) => dispatch({ type: "pushChanged", push: value })}
              />
            </ItemActions>
          </Item>
          <Item onPress={() => {}}>
            <ItemMedia icon="moon" />
            <ItemContent>
              <ItemTitle>Appearance</ItemTitle>
              <ItemDescription>{scheme === "dark" ? "Dark" : "Light"}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Icon name="chevron-right" size={18} color="mutedForeground" decorative />
            </ItemActions>
          </Item>
          <Item>
            <ItemMedia icon="eye" />
            <ItemContent>
              <ItemTitle>Visibility</ItemTitle>
            </ItemContent>
            <ItemActions>
              <ItemDescription>Team only</ItemDescription>
            </ItemActions>
          </Item>
        </ItemGroup>
      </LabSection>
    </Screen>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // No horizontal padding: rows carry the inset, and `gutter` pads the rest.
    content: {
      width: "100%",
      maxWidth: 640,
      alignSelf: "center",
      paddingVertical: spacing.md,
      gap: spacing.sectionSpacing,
    },
    gutter: {
      paddingHorizontal: spacing.screenPadding,
    },
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      gap: spacing.xs,
    },
    stack: {
      gap: spacing.lg,
    },
    principles: {
      gap: spacing.smd,
    },
    principle: {
      gap: spacing.xxs,
    },
    control: {
      gap: spacing.sm,
    },
    dim: {
      color: theme.colors.textDim,
    },
    mutedForeground: {
      color: theme.colors.mutedForeground,
    },
    destructive: {
      color: theme.colors.destructive,
    },
    swatch: {
      width: spacing.xl + spacing.sm,
      height: spacing.xl + spacing.sm,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    cardStack: {
      gap: spacing.md,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.smd,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radiusFull,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.muted,
    },
    // Mirrors the Popover content surface: popover tier, `border` hairline,
    // `radiusMd`, 4 pt padding. It overlaps the card's lower edge.
    popover: {
      alignSelf: "flex-end",
      width: 224,
      marginTop: -spacing.xl,
      marginRight: spacing.md,
      padding: spacing.xs,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.popover,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.smd,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    // A Notification-style surface: the candidate's popover tier with the
    // `borderStrong` hairline. (The shipped Notification still lifts its dark
    // surface by hand, because dark `popover` equals `card`.)
    toast: {
      width: "100%",
      maxWidth: 420,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.popover,
    },
    toastIcon: {
      width: spacing.xl + spacing.xs,
      height: spacing.xl + spacing.xs,
      borderRadius: spacing.radiusMd,
      alignItems: "center",
      justifyContent: "center",
    },
    toastBody: {
      flex: 1,
      gap: spacing.xxs,
    },
  });

const themedStyles = createThemedStyles(createStyles);
