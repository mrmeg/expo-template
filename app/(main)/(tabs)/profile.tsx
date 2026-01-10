import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Switch } from "@/client/components/ui/Switch";
import { Icon } from "@/client/components/ui/Icon";
import { Alert } from "@/client/components/ui/Alert";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { useAuthStore } from "@/client/stores/authStore";
import { useAuth } from "@/client/hooks/useAuth";
import {
  User,
  Edit3,
  Key,
  Mail,
  Bell,
  Shield,
  Link2,
  Unlink,
  LogOut,
  Trash2,
  Crown,
  Calendar,
  ChevronRight,
} from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";
import { palette } from "@/client/constants/colors";

/**
 * Profile screen - displays user information and account settings.
 */
export default function ProfileScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);
  const { signOut } = useAuth();
  const { user, state: authState } = useAuthStore();

  // Mock preference states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const isAuthenticated = authState === "authenticated";

  const handleEditProfile = () => {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Edit profile functionality coming soon"],
      duration: 2000,
    });
  };

  const handleChangePassword = () => {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Password change functionality coming soon"],
      duration: 2000,
    });
  };

  const handlePrivacySettings = () => {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Privacy settings coming soon"],
      duration: 2000,
    });
  };

  const handleConnectGoogle = () => {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Google account linking coming soon"],
      duration: 2000,
    });
  };

  const handleConnectApple = () => {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Apple account linking coming soon"],
      duration: 2000,
    });
  };

  const handleSignOut = async () => {
    Alert.show({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              globalUIStore.getState().show({
                type: "success",
                messages: ["Signed out successfully"],
                duration: 2000,
              });
            } catch (error) {
              globalUIStore.getState().show({
                type: "error",
                messages: ["Failed to sign out"],
                duration: 2000,
              });
            }
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    Alert.show({
      title: "Delete Account",
      message: "This action cannot be undone. All your data will be permanently deleted.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            globalUIStore.getState().show({
              type: "info",
              messages: ["Account deletion coming soon"],
              duration: 2000,
            });
          },
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Profile Header */}
          <View style={styles.headerSection}>
            <Pressable onPress={handleEditProfile}>
              <View style={[styles.avatar, getShadowStyle("soft")]}>
                <Icon as={User} color={palette.white} size={48} />
              </View>
            </Pressable>
            <SansSerifBoldText style={styles.name}>
              {user?.username || "User"}
            </SansSerifBoldText>
            <SansSerifText style={styles.email}>
              {user?.email || "user@example.com"}
            </SansSerifText>
            <Button
              preset="outline"
              size="sm"
              onPress={handleEditProfile}
              style={styles.editButton}
            >
              <Icon as={Edit3} size={14} color={theme.colors.primary} />
              <SansSerifText style={styles.editButtonText}> Edit Profile</SansSerifText>
            </Button>
          </View>

          {/* Account Info Card */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>Account Info</SansSerifBoldText>
            <View style={[styles.card, getShadowStyle("subtle")]}>
              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <Icon as={User} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.infoLabel}>User ID</SansSerifText>
                </View>
                <SansSerifText style={styles.infoValue}>
                  {user?.userId ? user.userId.slice(0, 8) + "..." : "—"}
                </SansSerifText>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <Icon as={Crown} size={18} color={theme.colors.warning} />
                  <SansSerifText style={styles.infoLabel}>Plan</SansSerifText>
                </View>
                <SansSerifText style={[styles.infoValue, { color: theme.colors.warning }]}>
                  Free
                </SansSerifText>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <Icon as={Calendar} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.infoLabel}>Member Since</SansSerifText>
                </View>
                <SansSerifText style={styles.infoValue}>Jan 2024</SansSerifText>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoRowLeft}>
                  <Icon as={Shield} size={18} color={theme.colors.success} />
                  <SansSerifText style={styles.infoLabel}>Status</SansSerifText>
                </View>
                <SansSerifText style={[styles.infoValue, { color: theme.colors.success }]}>
                  Active
                </SansSerifText>
              </View>
            </View>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>Account Settings</SansSerifBoldText>
            <View style={[styles.card, getShadowStyle("subtle")]}>
              <Pressable style={styles.settingsRow} onPress={handleChangePassword}>
                <View style={styles.settingsRowLeft}>
                  <Icon as={Key} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.settingsLabel}>Change Password</SansSerifText>
                </View>
                <Icon as={ChevronRight} size={18} color={theme.colors.mutedForeground} />
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.settingsRow} onPress={handlePrivacySettings}>
                <View style={styles.settingsRowLeft}>
                  <Icon as={Shield} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.settingsLabel}>Privacy Settings</SansSerifText>
                </View>
                <Icon as={ChevronRight} size={18} color={theme.colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {/* Notification Preferences */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>Notifications</SansSerifBoldText>
            <View style={[styles.card, getShadowStyle("subtle")]}>
              <View style={styles.switchRow}>
                <View style={styles.switchRowLeft}>
                  <Icon as={Mail} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.settingsLabel}>Email Notifications</SansSerifText>
                </View>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </View>
              <View style={styles.divider} />
              <View style={styles.switchRow}>
                <View style={styles.switchRowLeft}>
                  <Icon as={Bell} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.settingsLabel}>Push Notifications</SansSerifText>
                </View>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </View>
              <View style={styles.divider} />
              <View style={styles.switchRow}>
                <View style={styles.switchRowLeft}>
                  <Icon as={Mail} size={18} color={theme.colors.mutedForeground} />
                  <SansSerifText style={styles.settingsLabel}>Marketing Emails</SansSerifText>
                </View>
                <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
              </View>
            </View>
          </View>

          {/* Connected Accounts */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>Connected Accounts</SansSerifBoldText>
            <View style={[styles.card, getShadowStyle("subtle")]}>
              <Pressable style={styles.connectedRow} onPress={handleConnectGoogle}>
                <View style={styles.connectedRowLeft}>
                  <View style={[styles.providerIcon, { backgroundColor: "#DB4437" }]}>
                    <SansSerifBoldText style={styles.providerLetter}>G</SansSerifBoldText>
                  </View>
                  <View>
                    <SansSerifText style={styles.settingsLabel}>Google</SansSerifText>
                    <SansSerifText style={styles.connectedStatus}>Not connected</SansSerifText>
                  </View>
                </View>
                <Icon as={Link2} size={18} color={theme.colors.primary} />
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.connectedRow} onPress={handleConnectApple}>
                <View style={styles.connectedRowLeft}>
                  <View style={[styles.providerIcon, { backgroundColor: theme.colors.foreground }]}>
                    <SansSerifBoldText style={[styles.providerLetter, { color: theme.colors.background }]}>
                      A
                    </SansSerifBoldText>
                  </View>
                  <View>
                    <SansSerifText style={styles.settingsLabel}>Apple</SansSerifText>
                    <SansSerifText style={styles.connectedStatus}>Not connected</SansSerifText>
                  </View>
                </View>
                <Icon as={Link2} size={18} color={theme.colors.primary} />
              </Pressable>
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.section}>
            <SansSerifBoldText style={[styles.sectionTitle, { color: theme.colors.destructive }]}>
              Danger Zone
            </SansSerifBoldText>
            <View style={[styles.card, styles.dangerCard, getShadowStyle("subtle")]}>
              {isAuthenticated && (
                <>
                  <Pressable style={styles.dangerRow} onPress={handleSignOut}>
                    <View style={styles.dangerRowLeft}>
                      <Icon as={LogOut} size={18} color={theme.colors.destructive} />
                      <SansSerifText style={styles.dangerLabel}>Sign Out</SansSerifText>
                    </View>
                  </Pressable>
                  <View style={styles.divider} />
                </>
              )}
              <Pressable style={styles.dangerRow} onPress={handleDeleteAccount}>
                <View style={styles.dangerRowLeft}>
                  <Icon as={Trash2} size={18} color={theme.colors.destructive} />
                  <SansSerifText style={styles.dangerLabel}>Delete Account</SansSerifText>
                </View>
              </Pressable>
            </View>
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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    headerSection: {
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
      fontSize: 14,
      color: theme.colors.mutedForeground,
      marginBottom: spacing.md,
    },
    editButton: {
      paddingHorizontal: spacing.md,
    },
    editButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    dangerCard: {
      borderColor: theme.colors.destructive + "40",
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
    },
    infoRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    infoValue: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: spacing.md,
    },
    settingsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
    },
    settingsRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    settingsLabel: {
      fontSize: 14,
      color: theme.colors.foreground,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
    },
    switchRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    connectedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
    },
    connectedRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    providerIcon: {
      width: 32,
      height: 32,
      borderRadius: spacing.radiusSm,
      alignItems: "center",
      justifyContent: "center",
    },
    providerLetter: {
      fontSize: 16,
      color: palette.white,
      fontWeight: "bold",
    },
    connectedStatus: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    dangerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.md,
    },
    dangerRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    dangerLabel: {
      fontSize: 14,
      color: theme.colors.destructive,
    },
  });
