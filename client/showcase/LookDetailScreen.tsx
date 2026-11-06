import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import {
  MonoText,
  SansSerifText,
  SerifText,
  StyledText,
  type SemanticVariant,
} from "@mrmeg/expo-ui/components/StyledText";
import { spacing, type FontVariant, type Theme } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { defaultShapeRadius, defaultTreatments, refinedLook } from "@mrmeg/expo-ui/state";

import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { CodeSnippet } from "./CodeSnippet";
import { SHOWCASE_ROUTES, lookRoute } from "./filters";
import {
  getDemoLook,
  lookButtonShadow,
  lookColorRows,
  lookFontRows,
  lookShapeRows,
  lookSnippet,
  lookTreatmentRows,
  neighbourLooks,
} from "./lookReference";
import type { DemoLook } from "./looks";
import { LookDisplayContext, type SampleScreen } from "./looks/context";
import { HomeSample } from "./looks/HomeSample";
import { claimLook } from "./looks/lookSession";
import { FRAME_WIDTH } from "./looks/parts";
import { SettingsSample } from "./looks/SettingsSample";

/**
 * One look, in full: the app takes this look while the page is open, and the
 * page lays out its preview, every color token, type, shape, treatments and the
 * code to adopt it. All reference values come from `lookReference.ts`; nothing
 * on this page is typed by hand. The look is claimed on focus and released on
 * blur (`looks/lookSession.ts`), so leaving the page restores Refined.
 */

/** Side by side from here up; a Home / Settings toggle below it. */
const WIDE_BREAKPOINT = 900;
const COLUMN_MAX_WIDTH = 640;
const SAMPLE_MAX_WIDTH = 480;

const SCREENS: SampleScreen[] = ["home", "settings"];
const SCREEN_LABELS: Record<SampleScreen, string> = { home: "Home", settings: "Settings" };
const SCHEMES = ["Light", "Dark"];

const ROLES: { semantic: SemanticVariant; sample: string }[] = [
  { semantic: "title", sample: "Quarterly overview" },
  { semantic: "heading", sample: "Recent activity" },
  { semantic: "body", sample: "The quick brown fox jumps over the lazy dog." },
  { semantic: "label", sample: "Account settings" },
  { semantic: "caption", sample: "Updated 2 hours ago" },
  { semantic: "eyebrow", sample: "This week" },
];

const VARIANT_LABELS: Record<FontVariant, string> = { sansSerif: "Sans serif", serif: "Serif", mono: "Mono" };
const VARIANT_TEXT: Record<FontVariant, typeof SansSerifText> = {
  sansSerif: SansSerifText,
  serif: SerifText,
  mono: MonoText,
};

export default function LookDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const demo = getDemoLook(id);

  // The look is on the app while this screen is focused. A new `demo` (the id
  // changed) re-runs the effect: the old claim is released, the new one applied.
  useFocusEffect(
    useCallback(() => (demo ? claimLook(demo) : undefined), [demo]),
  );

  if (!demo) return <MissingLook id={id} />;
  return <LookDetail demo={demo} />;
}

function MissingLook({ id }: { id?: string }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <>
      <Stack.Screen options={{ title: "Look" }} />
      <View style={styles.missing} testID="look-detail-missing">
        <EmptyState
          icon="search"
          title="No such look"
          description={id ? `"${id}" isn't in the looks list.` : "No look was requested."}
        />
        <Link href={SHOWCASE_ROUTES.looks as never} asChild>
          <Pressable
            onPressIn={blurActiveElementOnWeb}
            accessibilityRole="link"
            testID="look-detail-back"
            style={linkPressableStyle(styles.cta)}
          >
            <SansSerifText semantic="label" style={styles.ctaText}>
              Back to looks
            </SansSerifText>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

function LookDetail({ demo }: { demo: DemoLook }) {
  const { theme, scheme, setTheme } = useTheme();
  const styles = themedStyles(theme);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [screen, setScreen] = useState<SampleScreen>("home");

  const { look } = demo;
  const neighbours = neighbourLooks(look.id);

  return (
    <>
      <Stack.Screen options={{ title: look.name }} />
      <Seo
        title={`${look.name} look - Expo Template`}
        description={look.description ?? `The ${look.name} look for @mrmeg/expo-ui.`}
      />
      <ScrollView
        testID="look-detail"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.gutter}>
            <View style={styles.nameRow}>
              <StyledText semantic="title">{look.name}</StyledText>
              {look.id === refinedLook.id && <Badge variant="secondary">Default</Badge>}
            </View>
            {!!look.description && (
              <SansSerifText size="base" style={styles.muted}>{look.description}</SansSerifText>
            )}
            <SansSerifText size="sm" style={styles.muted} testID="look-detail-note">
              The whole app takes this look while this page is open.
            </SansSerifText>
          </View>

          <ItemGroup title="Preview">
            <View style={styles.gutter}>
              <SegmentedControl
                values={SCHEMES}
                value={scheme === "dark" ? "Dark" : "Light"}
                onValueChange={(value) => setTheme(value === "Dark" ? "dark" : "light")}
              />
              {!wide && (
                <View style={styles.toggle}>
                  <SegmentedControl
                    values={SCREENS.map((key) => SCREEN_LABELS[key])}
                    value={SCREEN_LABELS[screen]}
                    onValueChange={(value) => setScreen(value === "Settings" ? "settings" : "home")}
                  />
                </View>
              )}
            </View>
          </ItemGroup>
        </View>

        <LookDisplayContext.Provider value={demo.display}>
          {wide ? (
            <View style={styles.pair}>
              <View style={styles.framed}>
                <HomeSample framed />
              </View>
              <View style={styles.framed}>
                <SettingsSample framed />
              </View>
            </View>
          ) : (
            <View style={styles.sample}>
              {screen === "home" ? (
                <HomeSample framed={false} onNavigate={setScreen} />
              ) : (
                <SettingsSample framed={false} onNavigate={setScreen} />
              )}
            </View>
          )}
        </LookDisplayContext.Provider>

        <View style={styles.column}>
          <ColorsSection demo={demo} />
          <TypeSection demo={demo} />
          <ShapeSection demo={demo} />
          <TreatmentsSection demo={demo} />

          <ItemGroup title="Use it">
            <View style={styles.gutter}>
              <CodeSnippet label="Snippet" code={lookSnippet(demo)} testID="look-detail-snippet" />
            </View>
          </ItemGroup>

          {neighbours && (
            <ItemGroup title="More looks">
              {[neighbours.previous, neighbours.next].map((other, index) => (
                <Item
                  key={other.look.id}
                  onPress={() => router.push(lookRoute(other.look.id) as never)}
                  accessibilityLabel={`${index === 0 ? "Previous" : "Next"} look, ${other.look.name}`}
                  testID={index === 0 ? "look-detail-previous" : "look-detail-next"}
                >
                  <ItemContent>
                    <ItemTitle>{other.look.name}</ItemTitle>
                    <ItemDescription>{index === 0 ? "Previous" : "Next"}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon name="chevron-right" size={18} color="mutedForeground" decorative />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function ColorsSection({ demo }: { demo: DemoLook }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const rows = lookColorRows(demo.look);
  return (
    <ItemGroup title="Colors" description="Every semantic token, light and dark. Tokens the look does not set take the package value." testID="look-detail-colors">
      {rows.map((row) => (
        <Item key={row.token} testID={`look-color-${row.token}`}>
          <ItemContent>
            <ItemTitle>{row.token}</ItemTitle>
            <ItemDescription>{`Light ${row.light} · Dark ${row.dark}`}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <View style={styles.swatchPair}>
              <View style={[styles.swatch, { backgroundColor: row.light }]} />
              <View style={[styles.swatch, { backgroundColor: row.dark }]} />
            </View>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}

function TypeSection({ demo }: { demo: DemoLook }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const fonts = lookFontRows(demo.look);
  return (
    <ItemGroup title="Type" testID="look-detail-type">
      {fonts.map(({ variant, family }) => {
        const Sample = VARIANT_TEXT[variant];
        return (
          <Item key={variant} testID={`look-font-${variant}`}>
            <ItemContent>
              <ItemTitle>{VARIANT_LABELS[variant]}</ItemTitle>
              <ItemDescription>{family}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Sample size="xl">Aa</Sample>
            </ItemActions>
          </Item>
        );
      })}
      <View style={[styles.gutter, styles.roles]} testID="look-detail-roles">
        {ROLES.map(({ semantic, sample }) => (
          <View key={semantic} style={styles.role}>
            <SansSerifText size="xs" style={styles.muted}>{semantic}</SansSerifText>
            <StyledText semantic={semantic}>{sample}</StyledText>
          </View>
        ))}
      </View>
    </ItemGroup>
  );
}

function ShapeSection({ demo }: { demo: DemoLook }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const rows = lookShapeRows(demo.look);
  const shadow = lookButtonShadow(demo.look);
  return (
    <ItemGroup title="Shape" description="Corner radius per slot, in points." testID="look-detail-shape">
      {rows.map((row) => (
        <Item key={row.slot} testID={`look-shape-${row.slot}`}>
          <ItemContent>
            <ItemTitle>{row.slot}</ItemTitle>
            <ItemDescription>
              {row.radius === "platform" ? "Drawn by the platform" : `Radius ${row.radius}`}
              {row.changed ? ` · package ${String(defaultShapeRadius[row.slot])}` : ""}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {typeof row.radius === "number" && (
              <View style={[styles.corner, { borderTopLeftRadius: Math.min(row.radius, CORNER_PREVIEW) }]} />
            )}
          </ItemActions>
        </Item>
      ))}
      <Item testID="look-shape-buttonShadow">
        <ItemContent>
          <ItemTitle>button shadow</ItemTitle>
          <ItemDescription>{shadow ? "On for the default preset" : "Off"}</ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  );
}

/** The corner swatch is a 28pt square, so a pill clamps to a quarter circle. */
const CORNER_PREVIEW = 28;

function TreatmentsSection({ demo }: { demo: DemoLook }) {
  const rows = lookTreatmentRows(demo.look);
  return (
    <ItemGroup title="Treatments" testID="look-detail-treatments">
      {rows.map((row) => (
        <Item key={row.name} testID={`look-treatment-${row.name}`}>
          <ItemContent>
            <ItemTitle>{row.name}</ItemTitle>
            <ItemDescription>
              {row.changed ? `${row.value} · package ${defaultTreatments[row.name]}` : row.value}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingVertical: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sectionSpacing },
    // The groups' rows carry the 16 pt inset; other blocks pad their own wrapper.
    column: { width: "100%", maxWidth: COLUMN_MAX_WIDTH, alignSelf: "center", gap: spacing.sectionSpacing },
    gutter: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm },
    nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    muted: { color: theme.colors.mutedForeground },
    toggle: { marginTop: spacing.xs },
    sample: { width: "100%", maxWidth: SAMPLE_MAX_WIDTH, alignSelf: "center" },
    pair: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xl },
    framed: { width: FRAME_WIDTH },
    swatchPair: { flexDirection: "row", gap: spacing.xs },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: spacing.radiusXs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
    },
    corner: {
      width: CORNER_PREVIEW,
      height: CORNER_PREVIEW,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderColor: theme.colors.foreground,
    },
    roles: { paddingVertical: spacing.sm, gap: spacing.md },
    role: { gap: spacing.xxs },
    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.screenPadding,
      backgroundColor: theme.colors.background,
    },
    cta: {
      minHeight: spacing.touchTarget,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.primary,
    },
    ctaText: { color: theme.colors.primaryForeground },
  });

const themedStyles = createThemedStyles(createStyles);
