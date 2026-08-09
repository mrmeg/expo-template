import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Link, usePathname, useLocalSearchParams } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing, type Theme } from "@mrmeg/expo-ui/constants";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";

import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";
import { linkPressableStyle } from "@/client/features/navigation/linkPressableStyle";
import {
  ALL_CATEGORIES,
  COMPONENT_CATEGORIES,
  COMPONENT_CATEGORY_LABELS,
  SHOWCASE_ROUTES,
  countByCategory,
} from "@/client/showcase/filters";
import {
  COMPONENTS,
  SCREEN_TEMPLATES,
  getBlockCount,
  getComponentCount,
} from "@/client/showcase/registry";

/**
 * The drawer's navigation content — one component rendered by both shell
 * modes (desktop rail and mobile-web overlay), so the two can never disagree
 * about what the app's navigation is. Mirrors the mockups' drawer
 * (mockups/01-home.html `<aside class="drawer">`): wordmark, search
 * affordance, "Library" nav with registry counts, a page-contextual category
 * section on the components gallery, app destinations, and a theme footer.
 */

interface DrawerNavContentProps {
  /**
   * Called after any nav item is pressed. The overlay shell uses it to close
   * the drawer; the rail passes nothing (it's persistent).
   */
  onNavigate?: () => void;
}

interface NavItemProps {
  label: string;
  href: string | { pathname: string; params?: Record<string, string> };
  active: boolean;
  count?: number;
  testID: string;
  onNavigate?: () => void;
}

/** One drawer row: accent left edge + raised background when active. */
function DrawerNavItem({ label, href, active, count, testID, onNavigate }: NavItemProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        testID={testID}
        onPress={onNavigate}
        style={linkPressableStyle(styles.item, active ? styles.itemActive : undefined)}
      >
        <SansSerifText style={[styles.itemLabel, active && styles.itemLabelActive]}>
          {label}
        </SansSerifText>
        {typeof count === "number" && (
          <SansSerifText style={styles.itemCount}>{count}</SansSerifText>
        )}
      </Pressable>
    </Link>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  return <SansSerifBoldText style={styles.sectionTitle}>{children}</SansSerifBoldText>;
}

export function DrawerNavContent({ onNavigate }: DrawerNavContentProps) {
  const { theme, toggleTheme, currentTheme, scheme } = useTheme();
  const styles = themedStyles(theme);
  const pathname = usePathname();
  const params = useLocalSearchParams<{ category?: string }>();

  const onComponentsGallery = pathname.startsWith("/components");
  const categoryCounts = countByCategory(COMPONENTS, COMPONENT_CATEGORIES);
  const activeCategory =
    typeof params.category === "string" && params.category.length > 0
      ? params.category
      : ALL_CATEGORIES;

  const themeLabel =
    currentTheme === "system"
      ? `System (${scheme})`
      : scheme === "dark"
        ? "Dark"
        : "Light";

  return (
    <View style={styles.root} testID="drawer-nav-content">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Wordmark — accent dot + package name, links home like the mockups'. */}
        <Link href={"/(main)/(tabs)" as never} asChild>
          <Pressable
            accessibilityRole="link"
            testID="drawer-wordmark"
            onPress={onNavigate}
            style={linkPressableStyle(styles.wordmark)}
          >
            <View style={styles.wordmarkDot} />
            <SansSerifBoldText style={styles.wordmarkText}>@mrmeg/expo-ui</SansSerifBoldText>
          </Pressable>
        </Link>

        {/* Search affordance. The real search field lives on Explore (the ⌘K
            palette is explicitly out of scope), so this navigates there. */}
        <Link href={"/(main)/(tabs)" as never} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Search the library on Explore"
            testID="drawer-search"
            onPress={onNavigate}
            style={linkPressableStyle(styles.search)}
          >
            <SansSerifText style={styles.searchText}>Search…</SansSerifText>
            <SansSerifText style={styles.searchHint}>⌘K</SansSerifText>
          </Pressable>
        </Link>

        <SectionTitle>Library</SectionTitle>
        <View style={styles.nav}>
          <DrawerNavItem
            label="Overview"
            href="/(main)/(tabs)"
            active={pathname === "/"}
            testID="drawer-nav-overview"
            onNavigate={onNavigate}
          />
          <DrawerNavItem
            label="Components"
            href={SHOWCASE_ROUTES.components}
            active={onComponentsGallery}
            count={getComponentCount()}
            testID="drawer-nav-components"
            onNavigate={onNavigate}
          />
          <DrawerNavItem
            label="Blocks"
            href={SHOWCASE_ROUTES.blocks}
            active={pathname.startsWith("/blocks")}
            count={getBlockCount()}
            testID="drawer-nav-blocks"
            onNavigate={onNavigate}
          />
          <DrawerNavItem
            label="Templates"
            href={SHOWCASE_ROUTES.templates}
            active={pathname.startsWith("/templates")}
            count={SCREEN_TEMPLATES.length}
            testID="drawer-nav-templates"
            onNavigate={onNavigate}
          />
        </View>

        {/* Page-contextual section: component categories, only while the
            components gallery is the active page (mockups/02-components.html).
            Items navigate via the `category` search param, which the gallery
            mirrors into its chip filter. */}
        {onComponentsGallery && (
          <>
            <SectionTitle>Categories</SectionTitle>
            <View style={styles.nav} testID="drawer-category-nav">
              <DrawerNavItem
                label="All"
                href={{ pathname: SHOWCASE_ROUTES.components, params: { category: ALL_CATEGORIES } }}
                active={activeCategory === ALL_CATEGORIES}
                count={getComponentCount()}
                testID="drawer-category-all"
                onNavigate={onNavigate}
              />
              {COMPONENT_CATEGORIES.map((category) => (
                <DrawerNavItem
                  key={category}
                  label={COMPONENT_CATEGORY_LABELS[category]}
                  href={{ pathname: SHOWCASE_ROUTES.components, params: { category } }}
                  active={activeCategory === category}
                  count={categoryCounts[category]}
                  testID={`drawer-category-${category}`}
                  onNavigate={onNavigate}
                />
              ))}
            </View>
          </>
        )}

        <SectionTitle>App</SectionTitle>
        <View style={styles.nav}>
          {NAV_DESTINATIONS.filter((destination) => destination.name !== "index").map(
            (destination) => (
              <DrawerNavItem
                key={destination.name}
                label={destination.label}
                href={`/(main)/(tabs)/${destination.name}`}
                active={pathname.startsWith(`/${destination.name}`)}
                testID={`drawer-nav-${destination.name}`}
                onNavigate={onNavigate}
              />
            ),
          )}
        </View>
      </ScrollView>

      {/* Theme footer — label + toggle, like the mockups' `.d-foot`. */}
      <View style={styles.footer}>
        <SansSerifText style={styles.footerLabel}>Theme: {themeLabel}</SansSerifText>
        <Pressable
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel="Toggle theme"
          testID="drawer-theme-toggle"
          style={styles.footerButton}
        >
          <Icon name={scheme === "dark" ? "moon" : "sun"} size={15} color={theme.colors.textDim} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ({
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    wordmark: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    wordmarkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    wordmarkText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: spacing.radiusSm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: theme.colors.background,
    },
    searchText: {
      fontSize: 13,
      color: theme.colors.textDim,
    },
    searchHint: {
      fontSize: 11,
      color: theme.colors.textDim,
    },
    sectionTitle: {
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: theme.colors.textDim,
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    nav: {
      gap: 2,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: spacing.radiusSm,
      borderLeftWidth: 2,
      borderLeftColor: "transparent",
    },
    itemActive: {
      backgroundColor: theme.colors.muted,
      borderLeftColor: theme.colors.accent,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
    itemLabel: {
      fontSize: 13.5,
      color: theme.colors.textDim,
    },
    itemLabelActive: {
      color: theme.colors.text,
    },
    itemCount: {
      fontSize: 11.5,
      color: theme.colors.textDim,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    footerLabel: {
      fontSize: 12,
      color: theme.colors.textDim,
    },
    footerButton: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: spacing.radiusSm,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
  }) as const;

const themedStyles = createThemedStyles(createStyles);
