/**
 * Templates gallery — scale 03 of the three-scale showcase.
 *
 * Follows mockups/04-templates.html: an eyebrow/title header, category chips
 * with counts, and a grid of phone-framed cards whose meta row carries the
 * label, the description, and the registry id.
 *
 * Deviation: the mockup's phone screens are stylized wireframes and its footer
 * says the in-app gallery renders live ones. It doesn't. Mounting 17 complete
 * screens at once means 17 nested ScrollViews, 17 sets of screen state, and a
 * scroll that costs more than the screens it advertises — so the frame shows
 * the template's registry icon and the live screen is one tap away. Every card
 * navigates by the entry's own `route`, never a path built from the id.
 */

import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { STAGGER_DELAY, useDimensions, useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { GalleryChips, buildCategoryChips } from "@/client/showcase/GalleryChips";
import {
  ALL_CATEGORIES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  countByCategory,
  filterTemplates,
  type CategoryFilter,
} from "@/client/showcase/filters";
import { SCREEN_TEMPLATES } from "@/client/showcase/registry";
import type {
  ScreenTemplateCategory,
  ScreenTemplateEntry,
} from "@/client/templates/types";

export default function TemplatesGalleryScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { isSmallScreen, isMediumScreen } = useDimensions();
  const [category, setCategory] =
    useState<CategoryFilter<ScreenTemplateCategory>>(ALL_CATEGORIES);

  const counts = useMemo(
    () => countByCategory(SCREEN_TEMPLATES, TEMPLATE_CATEGORIES),
    [],
  );
  const chips = useMemo(
    () =>
      buildCategoryChips(
        TEMPLATE_CATEGORIES,
        TEMPLATE_CATEGORY_LABELS,
        counts,
        "All",
        SCREEN_TEMPLATES.length,
      ),
    [counts],
  );
  const templates = useMemo(() => filterTemplates(category), [category]);

  // Mockup 04's grid breakpoints: 4 columns, 3 under 980px, 2 under 700px.
  // `flexBasis` sits under 100/columns so the gutter fits; `flexGrow` on the
  // card takes the remainder back.
  const basis = isSmallScreen ? "47%" : isMediumScreen ? "30%" : "22%";

  return (
    <>
      <Seo
        title="Screen templates - Expo Template"
        description="Finished screens with routing, state, and theming wired: dashboards, chat, pricing, settings, onboarding, and more."
      />
      <ScrollView
        testID="templates-gallery"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedView type="fadeSlideUp" delay={0}>
          <SansSerifText style={styles.eyebrow}>
            Scale 03 · complete screens
          </SansSerifText>
          <SansSerifText style={styles.intro}>
            {SCREEN_TEMPLATES.length} finished screens with routing, state, and
            theming wired. Copy a folder from{" "}
            <SansSerifText style={styles.mono}>
              client/templates/&lt;id&gt;/
            </SansSerifText>
            , run <SansSerifText style={styles.mono}>bun run gen:templates</SansSerifText>
            , and it&apos;s registered.
          </SansSerifText>
        </AnimatedView>

        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY} style={styles.chipRow}>
          <GalleryChips
            chips={chips}
            selected={category}
            onSelect={setCategory}
            label="Filter templates by category"
            testID="templates-chips"
          />
        </AnimatedView>

        {templates.length === 0 ? (
          <EmptyState
            icon="layout"
            title="No templates here yet"
            description={`Nothing is filed under ${TEMPLATE_CATEGORY_LABELS[category as ScreenTemplateCategory]}.`}
          />
        ) : (
          <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * 2} style={styles.grid}>
            {templates.map((entry) => (
              <TemplateCard
                key={entry.id}
                entry={entry}
                basis={basis}
                styles={styles}
                iconColor={theme.colors.accent}
              />
            ))}
          </AnimatedView>
        )}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type TemplatesStyles = ReturnType<typeof createStyles>;

function TemplateCard({
  entry,
  basis,
  styles,
  iconColor,
}: {
  entry: ScreenTemplateEntry;
  /** Flex basis per card, derived from the viewport's column count. */
  basis: `${number}%`;
  styles: TemplatesStyles;
  iconColor: string;
}) {
  return (
    <Link href={entry.route as never} asChild>
      <Pressable
        onPressIn={blurActiveElementOnWeb}
        accessibilityRole="link"
        accessibilityLabel={`${entry.label}, ${entry.description}`}
        testID={`template-card-${entry.id}`}
        style={linkPressableStyle(styles.card, { flexBasis: basis })}
      >
        {/* `.phone` + `.notch` + `.screen` */}
        <View style={styles.phone}>
          <View style={styles.notch} />
          <View style={styles.screen}>
            <Icon name={entry.icon} size={28} color={iconColor} decorative />
          </View>
        </View>
        {/* `.tmeta` */}
        <View style={styles.meta}>
          <SansSerifBoldText style={styles.metaLabel} numberOfLines={1}>
            {entry.label}
          </SansSerifBoldText>
          <SansSerifText style={styles.metaDesc} numberOfLines={2}>
            {entry.description}
          </SansSerifText>
          <SansSerifText style={styles.metaId}>{entry.id}</SansSerifText>
        </View>
      </Pressable>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },

    eyebrow: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.4,
      color: theme.colors.accent,
      marginBottom: spacing.sm,
    },
    intro: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.mutedForeground,
    },
    mono: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12.5,
      color: theme.colors.textDim,
    },
    chipRow: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 18,
    },
    card: {
      flexGrow: 1,
      minWidth: 140,
    },
    // `.phone`
    phone: {
      padding: 9,
      borderRadius: spacing.radius2xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    notch: {
      width: 50,
      height: 13,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
      alignSelf: "center",
      marginTop: 2,
      marginBottom: 9,
    },
    screen: {
      height: 150,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
      overflow: "hidden",
    },
    // `.tmeta`
    meta: {
      paddingTop: spacing.sm + 4,
      paddingHorizontal: spacing.xxs,
    },
    metaLabel: {
      fontSize: 13,
      color: theme.colors.foreground,
    },
    metaDesc: {
      fontSize: 11.5,
      lineHeight: 16,
      color: theme.colors.mutedForeground,
    },
    metaId: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xxs,
    },
  });

const themedStyles = createThemedStyles(createStyles);
