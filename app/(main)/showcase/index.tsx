import { View, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
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
  description: string;
}

const showcaseItems: NavItem[] = [
  { href: "/(main)/showcase/buttons", icon: MousePointerClick, label: "Buttons", description: "Button presets, states, and sizes" },
  { href: "/(main)/showcase/forms", icon: TextCursorInput, label: "Form Controls", description: "Inputs, switches, checkboxes, toggles" },
  { href: "/(main)/showcase/navigation", icon: Navigation, label: "Navigation & Menus", description: "Accordion, popover, dropdown, drawer" },
  { href: "/(main)/showcase/feedback", icon: Bell, label: "Feedback", description: "Alerts, notifications, tooltips" },
  { href: "/(main)/showcase/typography", icon: Type, label: "Typography & Icons", description: "Text styles, icons, separators" },
  { href: "/(main)/showcase/auth-forms", icon: Lock, label: "Auth Forms", description: "Sign in, sign up, verification forms" },
];

export default function ShowcaseIndexScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <View style={[styles.card, getShadowStyle("subtle")]}>
            {showcaseItems.map((item, index) => {
              const isLast = index === showcaseItems.length - 1;
              return (
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
                        <View style={styles.textContainer}>
                          <SansSerifBoldText style={styles.rowLabel}>{item.label}</SansSerifBoldText>
                          <SansSerifText style={styles.rowDescription}>{item.description}</SansSerifText>
                        </View>
                      </View>
                      <Icon as={ChevronRight} color={theme.colors.mutedForeground} size={20} />
                    </Pressable>
                  </Link>
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}
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
    scrollView: {
      flex: 1,
    },
    content: {
      flex: 1,
      padding: spacing.md,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
      marginTop: spacing.md,
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
      width: 40,
      height: 40,
      borderRadius: spacing.radiusSm,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    textContainer: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    rowDescription: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginLeft: spacing.md + 40 + spacing.md,
    },
  });
