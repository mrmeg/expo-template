import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import type { IconName } from "@/client/components/ui/Icon";
import { Badge } from "@/client/components/ui/Badge";
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { SEO } from "@/client/components/SEO";
import type { Theme } from "@/client/constants/colors";

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  description?: string;
}

const screenTemplates: NavItem[] = [
  { href: "/(main)/(demos)/screen-settings", icon: "sliders", label: "Settings", description: "Grouped lists & toggles" },
  { href: "/(main)/(demos)/screen-profile", icon: "user", label: "Profile", description: "Avatar, stats, sections" },
  { href: "/(main)/(demos)/screen-list", icon: "list", label: "List", description: "Search & pull to refresh" },
  { href: "/(main)/(demos)/screen-pricing", icon: "credit-card", label: "Pricing", description: "Plans & comparison" },
  { href: "/(main)/(demos)/screen-welcome", icon: "log-in", label: "Welcome", description: "Landing & social login" },
  { href: "/(main)/(demos)/screen-card-grid", icon: "grid", label: "Card Grid", description: "Filterable card layout" },
  { href: "/(main)/(demos)/screen-chat", icon: "message-circle", label: "Chat", description: "Messaging conversation" },
  { href: "/(main)/(demos)/screen-dashboard", icon: "bar-chart-2", label: "Dashboard", description: "Metrics & activity feed" },
  { href: "/(main)/(demos)/screen-form", icon: "edit-3", label: "Form", description: "Multi-step wizard" },
  { href: "/(main)/(demos)/screen-notifications", icon: "bell", label: "Notifications", description: "Grouped notification list" },
  { href: "/(main)/(demos)/screen-search", icon: "search", label: "Search", description: "Filtered search results" },
  { href: "/(main)/(demos)/screen-error", icon: "alert-triangle", label: "Error", description: "Error state variants" },
  { href: "/(main)/(demos)/detail-hero", icon: "layout", label: "Detail / Hero", description: "Hero image detail view" },
];

const demos: NavItem[] = [
  { href: "/(main)/(demos)/form-demo", icon: "edit-3", label: "Form Validation" },
  { href: "/(main)/(demos)/auth-demo", icon: "shield", label: "Auth Demo" },
  { href: "/(main)/(demos)/developer", icon: "terminal", label: "Developer Tools" },
  { href: "/(main)/(demos)/onboarding", icon: "navigation", label: "Onboarding" },
];

export default function ExploreScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Pair templates into rows of 2 for grid layout
  const templateRows: NavItem[][] = [];
  for (let i = 0; i < screenTemplates.length; i += 2) {
    templateRows.push(screenTemplates.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      <SEO title="Explore - Expo Template" description="Browse UI components, screen templates, and interactive demos built with Expo and React Native." />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured: Component Library */}
        <AnimatedView type="fadeSlideUp" delay={0}>
          <Link href={"/(main)/(demos)/showcase" as any} asChild>
            <Pressable
              style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
            >
              <View style={styles.featured}>
                <View style={styles.featuredBody}>
                  <View style={styles.featuredHeader}>
                    <View style={styles.featuredIcon}>
                      <Icon name="layers" color={theme.colors.accentForeground} size={22} />
                    </View>
                    <Badge variant="outline">35 components</Badge>
                  </View>
                  <SansSerifBoldText style={styles.featuredTitle}>
                    Component Library
                  </SansSerifBoldText>
                  <SansSerifText style={styles.featuredDesc}>
                    Buttons, inputs, cards, toggles, menus — themed and cross-platform.
                  </SansSerifText>
                  <View style={styles.featuredCta}>
                    <SansSerifText style={styles.featuredCtaText}>
                      Browse all
                    </SansSerifText>
                    <Icon name="arrow-right" color={theme.colors.accent} size={14} />
                  </View>
                </View>
              </View>
            </Pressable>
          </Link>
        </AnimatedView>

        {/* Screen Templates — 2-column grid */}
        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * 3}>
          <SansSerifText style={styles.sectionLabel}>Screen Templates</SansSerifText>
          <View style={styles.grid}>
            {templateRows.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map((item) => (
                  <Link key={item.href} href={item.href as any} asChild>
                    <Pressable
                      style={Platform.OS === "web"
                        ? { ...styles.gridCard, cursor: "pointer" as any }
                        : styles.gridCard
                      }
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

        {/* Demos & Tools — compact list */}
        <AnimatedView type="fadeSlideUp" delay={STAGGER_DELAY * 6}>
          <SansSerifText style={styles.sectionLabel}>Demos & Tools</SansSerifText>
          <View style={styles.demoCard}>
            {demos.map((item, index) => (
              <View key={item.href}>
                <Link href={item.href as any} asChild>
                  <Pressable
                    style={Platform.OS === "web"
                      ? { ...styles.demoRow, cursor: "pointer" as any }
                      : styles.demoRow
                    }
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
                {index < demos.length - 1 && <View style={styles.demoDivider} />}
              </View>
            ))}
          </View>
        </AnimatedView>
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },

    // ── Featured card ──────────────────────────────────────
    featured: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.accent + "40",
      marginBottom: spacing.xl,
    },
    featuredBody: {
      padding: spacing.md,
    },
    featuredHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    featuredIcon: {
      width: 40,
      height: 40,
      borderRadius: spacing.radiusMd,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    featuredTitle: {
      fontSize: 18,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      marginBottom: spacing.xxs,
    },
    featuredDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedForeground,
    },
    featuredCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    featuredCtaText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.accent,
    },

    // ── Section label ──────────────────────────────────────
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm + 2,
      marginLeft: spacing.xxs,
    },

    // ── Template grid ──────────────────────────────────────
    grid: {
      gap: 12,
      marginBottom: spacing.xl,
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

    // ── Demo list ──────────────────────────────────────────
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
      marginLeft: spacing.md + 30 + spacing.sm + 2,
    },
  });
