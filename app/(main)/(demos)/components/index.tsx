/**
 * Components gallery — scale 01 of the three-scale showcase.
 *
 * Layout follows mockups/02-components.html on wide viewports (category
 * sections, three-up cards) and mockups/05-mobile.html frame 2 on a phone
 * (category chips, two-up cards). Both are the same tree: the chip row filters,
 * and the card grid's column count comes from `useDimensions()`.
 *
 * Every card renders a live instance of the real component from
 * `client/showcase/previews.tsx` — a gallery of screenshots would go stale, and
 * a live one shows a regression the moment it lands. Counts come from the
 * registry so they can't drift from what's shipped.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
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
  COMPONENT_CATEGORIES,
  COMPONENT_CATEGORY_DESCRIPTIONS,
  COMPONENT_CATEGORY_LABELS,
  COMPONENT_CATEGORY_SHORT_LABELS,
  SHOWCASE_ROUTES,
  componentDetailRoute,
  countByCategory,
  filterComponents,
  groupComponentsByCategory,
  type CategoryFilter,
} from "@/client/showcase/filters";
import { renderPreview } from "@/client/showcase/previews";
import { COMPONENTS, type ComponentCategory, type ComponentEntry } from "@/client/showcase/registry";

export default function ComponentsGalleryScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { isSmallScreen } = useDimensions();
  const [category, setCategory] = useState<CategoryFilter<ComponentCategory>>(ALL_CATEGORIES);

  const counts = useMemo(
    () => countByCategory(COMPONENTS, COMPONENT_CATEGORIES),
    [],
  );
  const chips = useMemo(
    () =>
      buildCategoryChips(
        COMPONENT_CATEGORIES,
        COMPONENT_CATEGORY_LABELS,
        counts,
        "All",
        COMPONENTS.length,
      ),
    [counts],
  );

  // One section per category under "All" (the desktop mockup's category rail
  // is a set of headings on a phone), a single unlabelled section otherwise.
  const sections = useMemo(() => {
    if (category === ALL_CATEGORIES) return groupComponentsByCategory(COMPONENTS);
    return [{ category, entries: filterComponents(category) }];
  }, [category]);

  // Two-up on a phone (mockup 05 frame 2), three-up above that (mockup 02).
  // `flexBasis` is a hair under 100/columns so the 14px gutter fits without
  // wrapping a row early; `flexGrow` takes the slack back.
  const basis = isSmallScreen ? "47%" : "30%";

  return (
    <>
      <Seo
        title="Components - Expo Template"
        description="Every themed primitive in @mrmeg/expo-ui, rendered live: form, feedback, navigation, overlay, layout, and typography."
      />
      {/* The ScrollView stays the screen's first native child so the stack
          header's scroll-edge effect finds it (see (tabs)/index.tsx). */}
      <ScrollView
        testID="components-gallery"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedView type="fadeSlideUp" delay={0}>
          <SansSerifText style={styles.intro}>
            Every primitive in the library, rendered live in the current theme.
            Tap a card for variants and a copyable snippet.
          </SansSerifText>

          <View style={styles.headerRow}>
            <SansSerifText style={styles.count}>
              {COMPONENTS.length} components
            </SansSerifText>
            <Link href={SHOWCASE_ROUTES.kitchenSink as never} asChild>
              <Pressable
                onPressIn={blurActiveElementOnWeb}
                accessibilityRole="link"
                testID="components-kitchen-sink-link"
                style={linkPressableStyle(styles.kitchenSink)}
              >
                <SansSerifText style={styles.kitchenSinkText}>
                  Full showcase
                </SansSerifText>
                <Icon name="arrow-right" size={13} color={theme.colors.accent} />
              </Pressable>
            </Link>
          </View>
        </AnimatedView>

        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY}>
          <GalleryChips
            chips={chips}
            selected={category}
            onSelect={setCategory}
            label="Filter components by category"
            testID="components-chips"
          />
        </AnimatedView>

        {sections.map((section, index) => (
          <AnimatedView
            key={section.category}
            type="fadeSlideUp"
            delay={STAGGER_DELAY * (index + 2)}
            style={styles.section}
          >
            <View style={styles.sectionHead}>
              <SansSerifBoldText style={styles.sectionTitle}>
                {COMPONENT_CATEGORY_LABELS[section.category]}
              </SansSerifBoldText>
              <SansSerifText style={styles.sectionCount}>
                {section.entries.length}
              </SansSerifText>
            </View>
            <SansSerifText style={styles.sectionDesc}>
              {COMPONENT_CATEGORY_DESCRIPTIONS[section.category]}
            </SansSerifText>
            <View style={styles.grid}>
              {section.entries.map((entry) => (
                <ComponentCard
                  key={entry.id}
                  entry={entry}
                  basis={basis}
                  styles={styles}
                />
              ))}
            </View>
          </AnimatedView>
        ))}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type GalleryStyles = ReturnType<typeof createStyles>;

/**
 * One preview card. The preview is rendered inside a `pointerEvents="none"`
 * wrapper on purpose: several previews are real interactive components (a
 * `Switch`, a `Dialog` trigger), and a tap on the card should open the detail
 * screen rather than half-operate the preview. The detail screen is where the
 * instances are live.
 */
function ComponentCard({
  entry,
  basis,
  styles,
}: {
  entry: ComponentEntry;
  /** Flex basis per card, derived from the viewport's column count. */
  basis: `${number}%`;
  styles: GalleryStyles;
}) {
  const preview = renderPreview(entry.id);

  return (
    <Link href={componentDetailRoute(entry.id) as never} asChild>
      <Pressable
        onPressIn={blurActiveElementOnWeb}
        accessibilityRole="link"
        accessibilityLabel={`${entry.id}, ${COMPONENT_CATEGORY_LABELS[entry.category]}`}
        testID={`component-card-${entry.id}`}
        style={linkPressableStyle(styles.card, { flexBasis: basis })}
      >
        <View style={styles.cardPreview} pointerEvents="none">
          {preview ?? (
            <Icon name="box" size={22} color="mutedForeground" decorative />
          )}
        </View>
        <View style={styles.cardMeta}>
          <SansSerifText style={styles.cardName} numberOfLines={1}>
            {entry.id}
          </SansSerifText>
          <SansSerifText style={styles.cardCategory}>
            {COMPONENT_CATEGORY_SHORT_LABELS[entry.category]}
          </SansSerifText>
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

    intro: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedForeground,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
    count: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    kitchenSink: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    kitchenSinkText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.accent,
    },

    section: {
      marginTop: spacing.lg,
    },
    sectionHead: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 15,
      color: theme.colors.foreground,
    },
    sectionCount: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
    },
    sectionDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xxs,
      marginBottom: spacing.sm + 2,
    },

    // Mockup 02 `.grid`: 3 columns (2 on a phone), 14px gutter. `flexBasis` is
    // set per card from the column count; the negative-free gap keeps the row
    // wrapping without a spacer element.
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
    },
    // Mockup 02 `.card`
    card: {
      flexGrow: 1,
      minWidth: 140,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    // `.pv` — the preview well sits on the sunken surface so the card's own
    // components (which use `card`) stay legible against it.
    cardPreview: {
      minHeight: 110,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.md,
      backgroundColor: theme.colors.surfaceSunken,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    // `.meta`
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md - 2,
    },
    cardName: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.foreground,
    },
    cardCategory: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
