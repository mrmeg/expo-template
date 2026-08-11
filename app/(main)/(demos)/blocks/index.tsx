/**
 * Blocks gallery — scale 02 of the three-scale showcase.
 *
 * Structure follows mockups/03-blocks.html: one full-width card per block, each
 * with a header (label + category), a stage holding the block rendered live at
 * its shipped defaults, and a recipe strip naming the components it composes.
 * The recipe chips are links into the component detail route, which is what
 * makes a block teach its own composition rather than just demo it.
 *
 * The stage has no dot-grid backdrop like the mockup's: every block paints its
 * own `background` (they're screen sections, not floating widgets), so a
 * patterned stage would be entirely hidden. The bordered, clipped container is
 * what remains visible and it reads the same.
 *
 * Each stage is a whole page section rendered live, so — exactly as in the
 * components gallery — client-side navigations mount them in per-frame batches
 * (`useProgressivePreviewCount`) behind a `Skeleton`. A direct load mounts all
 * six in one pass, so nothing streams into a tree that has to match the
 * prerendered HTML shell.
 */

import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Skeleton } from "@mrmeg/expo-ui/components/Skeleton";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { STAGGER_DELAY, useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { renderBlockStage } from "@/client/showcase/blockStages";
import { GalleryChips, buildCategoryChips } from "@/client/showcase/GalleryChips";
import {
  ALL_CATEGORIES,
  BLOCK_CATEGORIES,
  BLOCK_CATEGORY_LABELS,
  componentDetailRoute,
  countByCategory,
  filterBlocks,
  type CategoryFilter,
} from "@/client/showcase/filters";
import {
  BLOCKS,
  COMPONENTS,
  type BlockCategory,
  type BlockEntry,
} from "@/client/showcase/registry";
import {
  BLOCK_STAGE_SCHEDULE,
  useProgressivePreviewCount,
} from "@/client/showcase/useProgressivePreviewCount";

export default function BlocksGalleryScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [category, setCategory] = useState<CategoryFilter<BlockCategory>>(ALL_CATEGORIES);

  const counts = useMemo(() => countByCategory(BLOCKS, BLOCK_CATEGORIES), []);
  const chips = useMemo(
    () =>
      buildCategoryChips(
        BLOCK_CATEGORIES,
        BLOCK_CATEGORY_LABELS,
        counts,
        "All",
        BLOCKS.length,
      ),
    [counts],
  );
  const blocks = useMemo(() => filterBlocks(category), [category]);
  const liveStages = useProgressivePreviewCount(blocks.length, BLOCK_STAGE_SCHEDULE);

  return (
    <>
      <Seo
        title="Blocks - Expo Template"
        description="Composed sections between a component and a full screen: hero, feature grid, stat row, CTA banner, FAQ, and sign-in form."
      />
      <ScrollView
        testID="blocks-gallery"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedView type="fadeSlideUp" delay={0}>
          <SansSerifText style={styles.intro}>
            Composed sections you drop into any screen. Each block lives in{" "}
            <SansSerifText style={styles.mono}>client/blocks/&lt;id&gt;/</SansSerifText>,
            registers via{" "}
            <SansSerifText style={styles.mono}>bun run gen:blocks</SansSerifText>, and
            lists its component recipe below the preview.
          </SansSerifText>
        </AnimatedView>

        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY} style={styles.chipRow}>
          <GalleryChips
            chips={chips}
            selected={category}
            onSelect={setCategory}
            label="Filter blocks by category"
            testID="blocks-chips"
          />
        </AnimatedView>

        {blocks.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No blocks here yet"
            description={`Nothing is filed under ${BLOCK_CATEGORY_LABELS[category as BlockCategory]}.`}
          />
        ) : (
          blocks.map((entry, index) => (
            <AnimatedView
              key={entry.id}
              type="fadeSlideUp"
              delay={STAGGER_DELAY * (index + 2)}
            >
              <BlockCard entry={entry} styles={styles} live={index < liveStages} />
            </AnimatedView>
          ))
        )}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type BlocksStyles = ReturnType<typeof createStyles>;

/**
 * One block card. Header and recipe strip always render — a card whose stage
 * hasn't been scheduled yet still names its block and links its recipe, so the
 * gallery is navigable before the last stage mounts.
 */
function BlockCard({
  entry,
  styles,
  live,
}: {
  entry: BlockEntry;
  styles: BlocksStyles;
  /** Whether this stage's turn in the mount schedule has come up yet. */
  live: boolean;
}) {
  // Memoized so an already-mounted stage keeps its element identity across the
  // re-render each streamed batch causes; otherwise frame N re-renders every
  // stage from frames 1..N-1 and the per-frame budget stops meaning anything.
  const stage = useMemo(() => (live ? renderBlockStage(entry.id) : null), [live, entry.id]);

  return (
    <View style={styles.block} testID={`block-card-${entry.id}`}>
      <View style={styles.blockHead}>
        <SansSerifBoldText style={styles.blockLabel}>{entry.label}</SansSerifBoldText>
        <View style={styles.blockCategory}>
          <SansSerifText style={styles.blockCategoryText}>
            {BLOCK_CATEGORY_LABELS[entry.category]}
          </SansSerifText>
        </View>
      </View>

      <View style={styles.stage}>
        {live ? (
          stage ?? (
            <SansSerifText style={styles.stageMissing}>
              {entry.description}
            </SansSerifText>
          )
        ) : (
          // testID on the wrapper: `Skeleton` renders only its documented props.
          <View style={styles.stageSkeleton} testID={`block-card-skeleton-${entry.id}`}>
            <Skeleton width="100%" height={140} />
          </View>
        )}
      </View>

      <View style={styles.recipe}>
        <SansSerifText style={styles.recipeLabel}>Recipe</SansSerifText>
        {entry.recipe.map((componentId) => (
          <RecipeChip key={componentId} componentId={componentId} styles={styles} />
        ))}
      </View>
    </View>
  );
}

/**
 * One component in a block's recipe. Links to the component detail when the id
 * is in `COMPONENTS`; renders as plain text otherwise, so a recipe naming
 * something outside the showcase registry still shows up instead of linking
 * into a dead route.
 */
function RecipeChip({
  componentId,
  styles,
}: {
  componentId: string;
  styles: BlocksStyles;
}) {
  const known = COMPONENTS.some((component) => component.id === componentId);

  if (!known) {
    return (
      <View style={styles.recipeChip}>
        <SansSerifText style={styles.recipeChipText}>{componentId}</SansSerifText>
      </View>
    );
  }

  return (
    <Link href={componentDetailRoute(componentId) as never} asChild>
      <Pressable
        onPressIn={blurActiveElementOnWeb}
        accessibilityRole="link"
        accessibilityLabel={`${componentId} component`}
        testID={`recipe-chip-${componentId}`}
        style={linkPressableStyle(styles.recipeChip)}
      >
        <SansSerifText style={styles.recipeChipLink}>{componentId}</SansSerifText>
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

    // Mockup 03 `.block`
    block: {
      marginTop: spacing.md,
      borderRadius: spacing.radiusXl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
    },
    blockHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 4,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    blockLabel: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    blockCategory: {
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
    },
    blockCategoryText: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      color: theme.colors.mutedForeground,
    },
    // `.stage` — the block paints its own background, so this only bounds it.
    stage: {
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceSunken,
    },
    stageMissing: {
      padding: spacing.lg,
      textAlign: "center",
      color: theme.colors.mutedForeground,
    },
    // Placeholder for a stage that hasn't been scheduled yet. Roughly the height
    // a real stage occupies, so the scroll position doesn't lurch as they land.
    stageSkeleton: {
      padding: spacing.lg,
    },
    // `.recipe`
    recipe: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.xs + 2,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    recipeLabel: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.colors.mutedForeground,
    },
    recipeChip: {
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
    },
    recipeChipText: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    recipeChipLink: {
      fontSize: 12,
      color: theme.colors.accent,
    },
  });

const themedStyles = createThemedStyles(createStyles);
