import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import { User } from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";
import { palette } from "@/client/constants/colors";

/**
 * Profile screen - displays user information.
 */
export default function ProfileScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.content}>
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, getShadowStyle("soft")]}>
            <Icon as={User} color={palette.white} size={48} />
          </View>
          <SansSerifBoldText style={styles.name}>User</SansSerifBoldText>
          <SansSerifText style={styles.email}>user@example.com</SansSerifText>
        </View>

        {/* Info cards */}
        <View style={[styles.infoCard, getShadowStyle("subtle")]}>
          <View style={styles.infoRow}>
            <SansSerifText style={styles.infoLabel}>User ID</SansSerifText>
            <SansSerifText style={styles.infoValue}>—</SansSerifText>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <SansSerifText style={styles.infoLabel}>Account Status</SansSerifText>
            <SansSerifText style={[styles.infoValue, styles.activeStatus]}>
              Active
            </SansSerifText>
          </View>
        </View>
      </View>
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
      paddingTop: spacing.xl,
    },
    avatarSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    name: {
      fontSize: 24,
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    email: {
      fontSize: 16,
      color: theme.colors.foreground,
      opacity: 0.7,
    },
    infoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: spacing.xl,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.colors.foreground,
      opacity: 0.7,
    },
    infoValue: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    activeStatus: {
      color: theme.colors.success,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
  });
