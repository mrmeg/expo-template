import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import { ThemeToggle } from "@/client/components/showcase";
import {
  MousePointerClick,
  TextCursorInput,
  Navigation,
  Bell,
  Type,
  Lock,
  ChevronRight,
} from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";
import type { LucideIcon } from "lucide-react-native";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}

const categoryItems: NavItem[] = [
  { href: "/(main)/showcase/buttons", icon: MousePointerClick, label: "Buttons", description: "Presets, states, sizes" },
  { href: "/(main)/showcase/forms", icon: TextCursorInput, label: "Form Controls", description: "Inputs, switches, toggles" },
  { href: "/(main)/showcase/navigation", icon: Navigation, label: "Navigation & Menus", description: "Accordion, popover, dropdown" },
  { href: "/(main)/showcase/feedback", icon: Bell, label: "Feedback", description: "Alerts, notifications, tooltips" },
  { href: "/(main)/showcase/typography", icon: Type, label: "Typography & Icons", description: "Text styles, icons, separators" },
  { href: "/(main)/showcase/auth-forms", icon: Lock, label: "Auth Forms", description: "Sign in, sign up, verify, reset" },
];

export default function ShowcaseIndexScreen() {
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
              <Icon as={item.icon} color={theme.colors.primary} size={20} />
            </View>
            <View style={styles.rowText}>
              <SansSerifBoldText style={styles.rowLabel}>{item.label}</SansSerifBoldText>
              {item.description && (
                <SansSerifText style={styles.rowDescription}>{item.description}</SansSerifText>
              )}
            </View>
          </View>
          <Icon as={ChevronRight} color={theme.colors.mutedForeground} size={20} />
        </Pressable>
      </Link>
      {!isLast && <View style={styles.divider} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Theme Toggle */}
        <View style={styles.themeSection}>
          <ThemeToggle />
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <SansSerifBoldText style={styles.sectionTitle}>
            Categories
          </SansSerifBoldText>
          <View style={[styles.card, shadowStyle]}>
            {categoryItems.map((item, index) =>
              renderNavRow(item, index === categoryItems.length - 1)
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    themeSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
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
    rowText: {
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
