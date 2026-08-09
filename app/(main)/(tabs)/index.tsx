/**
 * Explore — the three-scale home.
 *
 * Structure follows mockups/01-home.html §Scale 01–03 and mockups/05-mobile.html
 * frame 1: a search field over all three registries, then one section per scale
 * (component rail → block spotlight → template grid), each with its count and a
 * link to its gallery. "Demos & Tools" stays at the bottom — it's app plumbing,
 * not part of the library story.
 *
 * The search field is plain client-side filtering over the registries, not a
 * command palette: typing shows hits *instead of* the scale sections, and
 * clearing the field restores them.
 */

import { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { Seo } from "@/client/components/Seo";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import { renderBlockStage } from "@/client/showcase/blockStages";
import {
  EXPLORE_BLOCK_SPOTLIGHT_ID,
  EXPLORE_RAIL_IDS,
  EXPLORE_TEMPLATE_PREVIEW_COUNT,
  SHOWCASE_ROUTES,
  componentDetailRoute,
  pickComponents,
  pickSpotlightBlock,
  searchRegistries,
  type SearchHit,
} from "@/client/showcase/filters";
import { renderPreview } from "@/client/showcase/previews";
import {
  BLOCKS,
  COMPONENTS,
  DEMOS,
  SCREEN_TEMPLATES,
  type ComponentEntry,
  type ScreenTemplateEntry,
} from "@/client/showcase/registry";
import type { Theme } from "@mrmeg/expo-ui/constants";

export default function ExploreScreen() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [query, setQuery] = useState("");

  // Blank query → `[]`, which is how "not searching" is expressed: the scale
  // sections render instead of results.
  const hits = useMemo(() => searchRegistries(query), [query]);
  const searching = query.trim().length > 0;

  const rail = useMemo(() => pickComponents(EXPLORE_RAIL_IDS), []);
  const spotlight = useMemo(() => pickSpotlightBlock(EXPLORE_BLOCK_SPOTLIGHT_ID), []);
  const templates = useMemo(
    () => SCREEN_TEMPLATES.slice(0, EXPLORE_TEMPLATE_PREVIEW_COUNT),
    [],
  );

  // Pair the previewed templates into rows of 2 for the grid.
  const templateRows: ScreenTemplateEntry[][] = [];
  for (let i = 0; i < templates.length; i += 2) {
    templateRows.push(templates.slice(i, i + 2));
  }

  return (
    <>
      <Seo title="Explore - Expo Template" description="Browse UI components, composed blocks, screen templates, and interactive demos built with Expo and React Native." />
      {/* The ScrollView must be the screen's first native child: the native tab
          bar (and stack header) locate it by walking first subviews, and that
          hookup drives minimizeBehavior + scroll edge effects on iOS 26. */}
      <ScrollView
        testID="explore-screen"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search — mockup 05 frame 1 `.m-search` */}
        <AnimatedView type="fadeSlideUp" delay={0} style={styles.searchWrapper}>
          <TextInput
            testID="explore-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search components, blocks, templates…"
            variant="filled"
            size="md"
            wrapperStyle={styles.searchField}
            style={styles.searchFieldInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search components, blocks, and templates"
            leftElement={
              <Icon name="search" size={18} color={theme.colors.mutedForeground} />
            }
          />
        </AnimatedView>

        {searching ? (
          <SearchResults hits={hits} query={query} styles={styles} theme={theme} />
        ) : (
          <>
            {/* ── Scale 01 · Components ───────────────────────────── */}
            <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY} style={styles.section}>
              <SectionHead
                title="Components"
                count={COMPONENTS.length}
                href={SHOWCASE_ROUTES.components}
                accent={theme.colors.accent}
                styles={styles}
                testID="explore-components-link"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.railContent}
                testID="explore-component-rail"
              >
                {rail.map((entry) => (
                  <RailCard key={entry.id} entry={entry} styles={styles} />
                ))}
              </ScrollView>
            </AnimatedView>

            {/* ── Scale 02 · Blocks ───────────────────────────────── */}
            {spotlight && (
              <AnimatedView
                type="fadeSlideUp"
                delay={STAGGER_DELAY * 2}
                style={styles.section}
              >
                <SectionHead
                  title="Blocks"
                  count={BLOCKS.length}
                  href={SHOWCASE_ROUTES.blocks}
                  accent={theme.colors.accent}
                  styles={styles}
                  testID="explore-blocks-link"
                />
                <Link href={SHOWCASE_ROUTES.blocks as never} asChild>
                  <Pressable
                    onPressIn={blurActiveElementOnWeb}
                    accessibilityRole="link"
                    accessibilityLabel={`${spotlight.label} block, ${spotlight.description}`}
                    testID={`explore-block-${spotlight.id}`}
                    style={linkPressableStyle(styles.spotlight)}
                  >
                    {/* The block owns its own screen-section padding; the
                        spotlight card supplies its own, so override it. */}
                    <View pointerEvents="none">
                      {renderBlockStage(spotlight.id, { style: styles.spotlightStage })}
                    </View>
                    {/* `.recipe` — the block doubles as a recipe. */}
                    <SansSerifText style={styles.spotlightRecipe}>
                      {spotlight.recipe.join(" + ")}
                    </SansSerifText>
                  </Pressable>
                </Link>
              </AnimatedView>
            )}

            {/* ── Scale 03 · Templates ────────────────────────────── */}
            <AnimatedView
              type="fadeSlideUp"
              delay={STAGGER_DELAY * 3}
              style={styles.section}
            >
              <SectionHead
                title="Templates"
                count={SCREEN_TEMPLATES.length}
                href={SHOWCASE_ROUTES.templates}
                accent={theme.colors.accent}
                styles={styles}
                testID="explore-templates-link"
              />
              <View style={styles.grid}>
                {templateRows.map((row) => (
                  <View key={row.map((item) => item.id).join("-")} style={styles.gridRow}>
                    {row.map((item) => (
                      // No accessibilityLabel on purpose: the children collapse
                      // into ", <label>, <description>", which is the string
                      // .maestro/templates.yml matches (see docs/e2e.md).
                      <Link key={item.id} href={item.route as never} asChild>
                        <Pressable
                          onPressIn={blurActiveElementOnWeb}
                          style={linkPressableStyle(styles.gridCard)}
                        >
                          <View style={styles.gridIcon}>
                            <Icon name={item.icon} color={theme.colors.primary} size={22} />
                          </View>
                          <SansSerifBoldText style={styles.gridName}>
                            {item.label}
                          </SansSerifBoldText>
                          {item.description && (
                            <SansSerifText style={styles.gridDesc}>
                              {item.description}
                            </SansSerifText>
                          )}
                        </Pressable>
                      </Link>
                    ))}
                    {row.length === 1 && <View style={styles.gridSpacer} />}
                  </View>
                ))}
              </View>
            </AnimatedView>

            {/* ── Demos & Tools — compact list ─────────────────────── */}
            <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * 4} style={styles.section}>
              <SansSerifText style={styles.sectionLabel}>Demos & Tools</SansSerifText>
              <View style={styles.demoCard}>
                {DEMOS.map((item, index) => (
                  <View key={item.id}>
                    <Link href={item.route as never} asChild>
                      <Pressable
                        onPressIn={blurActiveElementOnWeb}
                        style={linkPressableStyle(styles.demoRow)}
                      >
                        <View style={styles.demoLeft}>
                          <View style={styles.demoIcon}>
                            <Icon name={item.icon} color={theme.colors.mutedForeground} size={16} />
                          </View>
                          <SansSerifText style={styles.demoLabel}>{item.label}</SansSerifText>
                        </View>
                        <Icon name="chevron-right" color={theme.colors.border} size={16} />
                      </Pressable>
                    </Link>
                    {index < DEMOS.length - 1 && <View style={styles.demoDivider} />}
                  </View>
                ))}
              </View>
            </AnimatedView>
          </>
        )}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

type ExploreStyles = ReturnType<typeof createStyles>;

/** Mockup 05 `.m-sec`: section title on the left, "<count> →" link on the right. */
function SectionHead({
  title,
  count,
  href,
  accent,
  styles,
  testID,
}: {
  title: string;
  count: number;
  href: string;
  accent: string;
  styles: ExploreStyles;
  testID: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <SansSerifBoldText style={styles.sectionTitle}>{title}</SansSerifBoldText>
      <Link href={href as never} asChild>
        <Pressable
          onPressIn={blurActiveElementOnWeb}
          accessibilityRole="link"
          accessibilityLabel={`All ${count} ${title.toLowerCase()}`}
          testID={testID}
          style={linkPressableStyle(styles.sectionLink)}
        >
          <SansSerifText style={styles.sectionLinkText}>{count}</SansSerifText>
          <Icon name="arrow-right" size={13} color={accent} />
        </Pressable>
      </Link>
    </View>
  );
}

/**
 * One card in the component rail. The preview is a live instance behind
 * `pointerEvents="none"` — a tap should open the component's detail screen, not
 * half-operate the preview inside it (same rule as the gallery cards).
 */
function RailCard({ entry, styles }: { entry: ComponentEntry; styles: ExploreStyles }) {
  const preview = renderPreview(entry.id);

  return (
    <Link href={componentDetailRoute(entry.id) as never} asChild>
      <Pressable
        onPressIn={blurActiveElementOnWeb}
        accessibilityRole="link"
        accessibilityLabel={entry.id}
        testID={`explore-rail-${entry.id}`}
        style={linkPressableStyle(styles.railCard)}
      >
        <View style={styles.railPreview} pointerEvents="none">
          {preview ?? <Icon name="box" size={20} color="mutedForeground" decorative />}
        </View>
        <SansSerifText style={styles.railName} numberOfLines={1}>
          {entry.id}
        </SansSerifText>
      </Pressable>
    </Link>
  );
}

/**
 * Search results across all three registries. Each row carries the tier it came
 * from, because "Hero" exists as both a block and a template and the badge is
 * what disambiguates them.
 */
function SearchResults({
  hits,
  query,
  styles,
  theme,
}: {
  hits: SearchHit[];
  query: string;
  styles: ExploreStyles;
  theme: Theme;
}) {
  if (hits.length === 0) {
    return (
      <View testID="explore-search-empty" style={styles.section}>
        <EmptyState
          icon="search"
          title="No matches"
          description={`Nothing in the component, block, or template registries matches "${query.trim()}".`}
        />
      </View>
    );
  }

  return (
    <View style={styles.section} testID="explore-search-results">
      <SansSerifText style={styles.sectionLabel}>
        {hits.length} {hits.length === 1 ? "result" : "results"}
      </SansSerifText>
      <View style={styles.demoCard}>
        {hits.map((hit, index) => (
          <View key={`${hit.kind}:${hit.id}`}>
            <Link href={hit.route as never} asChild>
              <Pressable
                onPressIn={blurActiveElementOnWeb}
                accessibilityRole="link"
                testID={`explore-hit-${hit.kind}-${hit.id}`}
                style={linkPressableStyle(styles.hitRow)}
              >
                <View style={styles.hitBody}>
                  <SansSerifText style={styles.hitLabel} numberOfLines={1}>
                    {hit.label}
                  </SansSerifText>
                  {hit.description && (
                    <SansSerifText style={styles.hitDesc} numberOfLines={1}>
                      {hit.description}
                    </SansSerifText>
                  )}
                </View>
                <View style={styles.hitKind}>
                  <SansSerifText style={styles.hitKindText}>{hit.kind}</SansSerifText>
                </View>
                <Icon name="chevron-right" color={theme.colors.border} size={16} />
              </Pressable>
            </Link>
            {index < hits.length - 1 && <View style={styles.demoDivider} />}
          </View>
        ))}
      </View>
    </View>
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

    // ── Search ─────────────────────────────────────────────
    searchWrapper: {
      marginBottom: spacing.xs,
    },
    // The `filled` field paints `card`, and in light mode `card` *is*
    // `background` — so on its own the field reads as bare placeholder text with
    // no container. Mockup 01's search field (`.kbd`) is a card surface with a
    // 1px border, and that border is what carries it in light mode; dark keeps
    // its existing filled look. No `overflow: "hidden"`: on web the field's
    // focus ring is a `boxShadow` on the view inside this one, which clipping
    // would swallow.
    searchField: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    // Web only — the native field drops `style`. The surface now lives on the
    // wrapper above, so the `filled` variant's own fill and 2px underline would
    // double up inside the border.
    searchFieldInput: {
      backgroundColor: "transparent",
      borderBottomWidth: 0,
    },

    // ── Section scaffolding ────────────────────────────────
    section: {
      marginTop: spacing.lg,
    },
    // Mockup 05 `.m-sec`
    sectionHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: spacing.sm + 2,
    },
    sectionTitle: {
      fontSize: 17,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    sectionLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingLeft: spacing.sm,
    },
    sectionLinkText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.accent,
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm + 2,
      marginLeft: spacing.xxs,
    },

    // ── Component rail (mockup 05 `.hscroll` / `.mini-card`) ─
    railContent: {
      flexDirection: "row",
      gap: spacing.sm + 2,
      paddingRight: spacing.lg,
      paddingVertical: spacing.xxs,
    },
    railCard: {
      width: 124,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    railPreview: {
      height: 68,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      backgroundColor: theme.colors.surfaceSunken,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    railName: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.foreground,
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm,
    },

    // ── Block spotlight (mockup 05 `.m-block`) ──────────────
    spotlight: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
      paddingBottom: spacing.sm + 2,
    },
    // Overrides the block's own screen-section padding: inside a card it needs
    // card padding, and its `background` fill would fight the card surface.
    spotlightStage: {
      backgroundColor: "transparent",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    spotlightRecipe: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      color: theme.colors.mutedForeground,
      paddingHorizontal: spacing.md,
    },

    // ── Template grid ──────────────────────────────────────
    grid: {
      gap: 12,
    },
    gridRow: {
      flexDirection: "row",
      gap: 12,
    },
    gridCard: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
    },
    gridSpacer: {
      flex: 1,
    },
    gridIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    gridName: {
      fontSize: 15,
      color: theme.colors.foreground,
      marginBottom: 2,
    },
    gridDesc: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      lineHeight: 16,
    },

    // ── Demo list / search results ─────────────────────────
    demoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    demoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    demoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
    },
    demoIcon: {
      width: 30,
      height: 30,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    demoLabel: {
      fontSize: 15,
      color: theme.colors.foreground,
    },
    demoDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md,
    },

    hitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    hitBody: {
      flex: 1,
      minWidth: 0,
    },
    hitLabel: {
      fontSize: 15,
      color: theme.colors.foreground,
    },
    hitDesc: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    hitKind: {
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.muted,
    },
    hitKindText: {
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      color: theme.colors.mutedForeground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
