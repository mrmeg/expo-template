/**
 * Component detail — mockups/05-mobile.html frame 3.
 *
 * The mockup draws this as a bottom sheet over the gallery. It ships as a
 * pushed stack screen instead: the content is a variant row plus two code
 * blocks that can outgrow a sheet detent, and a route means a component is
 * linkable (Explore search results and every block recipe strip point here).
 * The sheet's read — dimmed gallery behind, one component in focus — is what a
 * pushed screen already gives on both platforms.
 *
 * Content comes from `client/showcase/details.tsx` for the seeded components,
 * and falls back to the gallery's live preview plus the import line for the
 * rest. Unlike the gallery cards, the instances here are interactive: this is
 * where you tap the switch.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { STAGGER_DELAY, useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { CodeSnippet } from "@/client/showcase/CodeSnippet";
import {
  getComponentDetail,
  importSnippet,
  VARIANT_GAP,
} from "@/client/showcase/details";
import {
  COMPONENT_CATEGORY_LABELS,
  SHOWCASE_ROUTES,
} from "@/client/showcase/filters";
import { renderPreview } from "@/client/showcase/previews";
import { COMPONENTS } from "@/client/showcase/registry";

export default function ComponentDetailScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { id } = useLocalSearchParams<{ id?: string }>();

  const entry = COMPONENTS.find((component) => component.id === id);

  // An unknown id is reachable by hand-typing a URL on web, so it gets a real
  // state rather than a crash or a blank screen.
  if (!entry) {
    return (
      <>
        <Stack.Screen options={{ title: "Component" }} />
        <View style={styles.missing} testID="component-detail-missing">
          <EmptyState
            icon="search"
            title="No such component"
            description={
              id
                ? `"${id}" isn't in the component registry.`
                : "No component was requested."
            }
          />
          <Link href={SHOWCASE_ROUTES.components as never} asChild>
            <Pressable
              onPressIn={blurActiveElementOnWeb}
              accessibilityRole="link"
              style={linkPressableStyle(styles.cta)}
            >
              <SansSerifText style={styles.ctaText}>
                Back to components
              </SansSerifText>
            </Pressable>
          </Link>
        </View>
      </>
    );
  }

  const detail = getComponentDetail(entry.id);
  const preview = renderPreview(entry.id);
  const categoryLabel = COMPONENT_CATEGORY_LABELS[entry.category];

  return (
    <>
      <Stack.Screen options={{ title: entry.id }} />
      <Seo
        title={`${entry.id} - Expo Template`}
        description={
          detail?.summary ??
          `${entry.id} from @mrmeg/expo-ui: live preview, variants, and a copyable import.`
        }
      />
      <ScrollView
        testID="component-detail"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedView type="fadeSlideUp" delay={0}>
          <SansSerifBoldText style={styles.title}>{entry.id}</SansSerifBoldText>
          <SansSerifText style={styles.sub}>
            {categoryLabel} · iOS / Android / web
          </SansSerifText>
          {detail?.summary && (
            <SansSerifText style={styles.summary}>{detail.summary}</SansSerifText>
          )}
        </AnimatedView>

        {/* Seeded components show a labelled variant row; everything else shows
            the gallery preview, which is the same live instance one size up. */}
        {detail ? (
          <AnimatedView
            type="fadeSlideUp"
            delay={STAGGER_DELAY}
            style={styles.section}
          >
            <SansSerifText style={styles.sectionLabel}>Variants</SansSerifText>
            <View style={styles.variantRow} testID="component-detail-variants">
              {detail.variants.map((variant) => (
                <View key={variant.label} style={styles.variant}>
                  <View style={styles.variantStage}>{variant.render()}</View>
                  <SansSerifText style={styles.variantLabel}>
                    {variant.label}
                  </SansSerifText>
                </View>
              ))}
            </View>
          </AnimatedView>
        ) : preview ? (
          <AnimatedView
            type="fadeSlideUp"
            delay={STAGGER_DELAY}
            style={styles.section}
          >
            <SansSerifText style={styles.sectionLabel}>Preview</SansSerifText>
            <View style={styles.previewStage} testID="component-detail-preview">
              {preview}
            </View>
          </AnimatedView>
        ) : null}

        <AnimatedView
          type="fadeSlideUp"
          delay={STAGGER_DELAY * 2}
          style={styles.section}
        >
          <CodeSnippet
            label="Import"
            code={importSnippet(entry.id, entry.importPath)}
            testID="component-detail-import"
          />
        </AnimatedView>

        {detail && (
          <AnimatedView
            type="fadeSlideUp"
            delay={STAGGER_DELAY * 3}
            style={styles.section}
          >
            <CodeSnippet
              label="Usage"
              code={detail.usage}
              testID="component-detail-usage"
            />
          </AnimatedView>
        )}

        {/* Mockup 05 frame 3's "Open full demo": the kitchen sink is still the
            exhaustive per-component reference. */}
        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * 4}>
          <Link href={SHOWCASE_ROUTES.kitchenSink as never} asChild>
            <Pressable
              onPressIn={blurActiveElementOnWeb}
              accessibilityRole="link"
              testID="component-detail-full-demo"
              style={linkPressableStyle(styles.cta)}
            >
              <SansSerifText style={styles.ctaText}>Open full demo</SansSerifText>
              <Icon
                name="arrow-right"
                size={14}
                color={theme.colors.primaryForeground}
              />
            </Pressable>
          </Link>
        </AnimatedView>
      </ScrollView>
    </>
  );
}

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
    missing: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.lg,
      padding: spacing.lg,
      backgroundColor: theme.colors.background,
    },

    title: {
      fontSize: 24,
      letterSpacing: -0.4,
      color: theme.colors.foreground,
    },
    sub: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xxs,
    },
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textDim,
      marginTop: spacing.sm,
    },

    section: {
      marginTop: spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.colors.mutedForeground,
      marginBottom: spacing.sm,
    },

    // A wrapping row of tiles rather than the mockup's single line: eight
    // Button presets don't fit a phone's width, and wrapping keeps every
    // variant labelled instead of clipping the tail off-screen.
    variantRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: VARIANT_GAP,
    },
    variant: {
      gap: spacing.xs,
    },
    variantStage: {
      alignItems: "flex-start",
      justifyContent: "center",
      padding: spacing.sm + 2,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
    },
    variantLabel: {
      fontSize: 11,
      textAlign: "center",
      color: theme.colors.mutedForeground,
    },

    previewStage: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 140,
      padding: spacing.lg,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
    },

    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.xl,
      paddingVertical: spacing.sm + 4,
      borderRadius: spacing.radiusMd,
      backgroundColor: theme.colors.primary,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.primaryForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
