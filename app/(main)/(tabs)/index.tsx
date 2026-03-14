import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import type { IconName } from "@/client/components/ui/Icon";
import type { Theme } from "@/client/constants/colors";

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  description?: string;
}

const componentItems: NavItem[] = [
  { href: "/(main)/(demos)/showcase", icon: "layers", label: "UI Components", description: "Buttons, forms, navigation, and more" },
];

const demoItems: NavItem[] = [
  { href: "/(main)/(demos)/form-demo", icon: "clipboard", label: "Form Validation" },
  { href: "/(main)/(demos)/auth-demo", icon: "lock", label: "Auth Demo" },
  { href: "/(main)/(demos)/developer", icon: "tool", label: "Developer Tools" },
  { href: "/(main)/(demos)/onboarding", icon: "compass", label: "Onboarding Flow" },
  { href: "/(main)/(demos)/detail-hero", icon: "box", label: "Detail / Hero Screen" },
];

const screenTemplateItems: NavItem[] = [
  { href: "/(main)/(demos)/screen-settings", icon: "settings", label: "Settings", description: "Grouped-list settings with toggles, radios, navigation" },
  { href: "/(main)/(demos)/screen-profile", icon: "user", label: "Profile", description: "Avatar hero, stats grid, info sections" },
  { href: "/(main)/(demos)/screen-list", icon: "list", label: "List", description: "Searchable, refreshable list with empty state" },
  { href: "/(main)/(demos)/screen-pricing", icon: "credit-card", label: "Pricing", description: "Plan selection with feature comparison" },
  { href: "/(main)/(demos)/screen-welcome", icon: "log-in", label: "Welcome", description: "Branded landing page with social login" },
];

export default function ExploreScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);
  const shadowStyle = getShadowStyle("subtle");

  const renderNavRow = (item: NavItem, isLast: boolean) => (
    <View key={item.href}>
      <Link href={item.href as any} asChild>
        <Pressable
          style={Platform.OS === "web"
            ? { ...styles.row, cursor: "pointer" as any }
            : styles.row
          }
        >
          <View style={styles.rowLeft}>
            <View style={styles.iconContainer}>
              <Icon name={item.icon} color={theme.colors.primary} size={20} />
            </View>
            <View>
              <SansSerifText style={styles.rowLabel}>{item.label}</SansSerifText>
              {item.description && (
                <SansSerifText style={styles.rowDescription}>{item.description}</SansSerifText>
              )}
            </View>
          </View>
          <Icon name="chevron-right" color={theme.colors.mutedForeground} size={20} />
        </Pressable>
      </Link>
      {!isLast && <View style={styles.divider} />}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Components Section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            UI Components
          </SansSerifBoldText>
          <View style={[styles.card, shadowStyle]}>
            {componentItems.map((item, index) =>
              renderNavRow(item, index === componentItems.length - 1)
            )}
          </View>
        </View>

        {/* Screen Templates Section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            Screen Templates
          </SansSerifBoldText>
          <View style={[styles.card, shadowStyle]}>
            {screenTemplateItems.map((item, index) =>
              renderNavRow(item, index === screenTemplateItems.length - 1)
            )}
          </View>
        </View>

        {/* Demos Section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            Demos & Tools
          </SansSerifBoldText>
          <View style={[styles.card, shadowStyle]}>
            {demoItems.map((item, index) =>
              renderNavRow(item, index === demoItems.length - 1)
            )}
          </View>
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
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    rowLabel: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    rowDescription: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md + 36 + spacing.md,
    },
  });
