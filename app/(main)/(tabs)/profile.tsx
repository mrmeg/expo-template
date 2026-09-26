import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { router } from "expo-router";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@mrmeg/expo-ui/components/Item";
import { Alert } from "@mrmeg/expo-ui/components/Alert";
import { Collapsible, CollapsibleContent } from "@mrmeg/expo-ui/components/Collapsible";
import { notify } from "@mrmeg/expo-ui/state";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { useAuth } from "@/client/features/auth/hooks/useAuth";
import { isAuthError, type SocialAuthProviderName } from "@/client/features/auth/provider";
import { AuthGate } from "@/client/features/app";
import {
  ChangePasswordSheet,
  EditProfileSheet,
  useAccountCapabilities,
  useChangePassword,
  useHydrateProfile,
  useProfileStore,
} from "@/client/features/profile";
import Config from "@/client/config";
import {
  useBillingActions,
  useBillingSummary,
  isEntitled,
  type BillingProblem,
  type BillingSummary,
} from "@/client/features/billing";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { palette } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { Seo } from "@/client/components/Seo";

/**
 * Profile screen - displays user information and account settings.
 */
export default function ProfileRoute() {
  return (
    <AuthGate>
      <ProfileScreen />
    </AuthGate>
  );
}

function ProfileScreen() {
  const { theme, getShadowStyle } = useTheme();
  const styles = themedStyles(theme);
  const { signOut } = useAuth();
  const { user, state: authState } = useAuthStore();
  const billingQuery = useBillingSummary();
  const billing = billingQuery.data;
  const entitled = billing ? isEntitled(billing) : false;
  const statusLabel = statusToLabel(billing?.status);
  const statusColor = entitled
    ? theme.colors.success
    : billing?.status === "past_due"
      ? theme.colors.warning
      : theme.colors.mutedForeground;

  const billingActions = useBillingActions();
  const billingEnabled = Config.billingEnabled;
  const canManage = entitled || Boolean(billing?.customerId);
  const billingAction = !billingEnabled
    ? null
    : canManage
      ? ("manage" as const)
      : ("upgrade" as const);

  // Preferences persist in the profile store (device-local; the template ships
  // no profile API). Web reads persistence after mount so SSR and the first
  // client render agree.
  useHydrateProfile();
  const displayName = useProfileStore((s) => s.displayName);
  const publicProfile = useProfileStore((s) => s.publicProfile);
  const analytics = useProfileStore((s) => s.analytics);
  const emailNotifications = useProfileStore((s) => s.emailNotifications);
  const pushNotifications = useProfileStore((s) => s.pushNotifications);
  const marketingEmails = useProfileStore((s) => s.marketingEmails);
  const setPreference = useProfileStore((s) => s.setPreference);

  const { signInWithProvider, deleteAccount } = useAuth();
  const capabilities = useAccountCapabilities(user?.email);
  const changePassword = useChangePassword(user?.email);
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const isAuthenticated = authState === "authenticated";
  const fallbackName = user?.username || "Your profile";
  const headerName = displayName || fallbackName;
  const showDangerZone = isAuthenticated || capabilities.canDeleteAccount;

  const handleEditProfile = () => setEditOpen(true);

  const handleConnect = async (provider: SocialAuthProviderName) => {
    try {
      await signInWithProvider(provider);
    } catch (err) {
      notify({
        type: "error",
        messages: [
          isAuthError(err) && err.message
            ? err.message
            : `We couldn't start ${PROVIDER_META[provider].label} sign-in.`,
        ],
        duration: 3000,
      });
    }
  };

  const handleDeleteAccount = () => {
    Alert.show({
      title: "Delete Account",
      message: "This action cannot be undone. Your account and its data will be permanently deleted.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              notify({ type: "success", messages: ["Account deleted"], duration: 2000 });
            } catch (err) {
              notify({
                type: "error",
                messages: [isAuthError(err) && err.message ? err.message : "We couldn't delete your account. Try again."],
                duration: 3000,
              });
            }
          },
        },
      ],
    });
  };

  const handleManageBilling = async () => {
    const result = await billingActions.startPortal();
    if (result.status === "failed" && result.problem) {
      notify({
        type: "error",
        messages: messagesForProblem(result.problem),
        duration: 4000,
      });
    }
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
              notify({
                type: "success",
                messages: ["Signed out successfully"],
                duration: 2000,
              });
            } catch {
              notify({
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

  return (
    <>
      <Seo title="Profile - Expo Template" description="User profile screen with avatar, stats, and editable sections." />
      {/* Keep the ScrollView as the screen's first native child — the native
          tab bar finds it via first-subview traversal to drive
          minimizeBehavior and scroll edge effects on iOS 26. */}
      <ScrollView
        testID="profile-screen"
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header: free-form, so it pads itself. The grouped rows below
            carry the screen's 16pt inset, so the scroll view adds none. */}
        <View style={styles.headerSection}>
          <Pressable onPress={handleEditProfile}>
            <View style={[styles.avatar, getShadowStyle("soft")]}>
              <Icon name="user" color={palette.white} size={48} />
            </View>
          </Pressable>
          <SansSerifBoldText size="xl" style={[styles.name, !user?.email && styles.nameSpaced]}>
            {headerName}
          </SansSerifBoldText>
          {user?.email ? (
            <SansSerifText size="base" style={styles.email}>
              {user.email}
            </SansSerifText>
          ) : null}
          <Button
            preset="outline"
            size="sm"
            onPress={handleEditProfile}
          >
            <Icon name="pencil" size={14} color={theme.colors.primary} />
            <SansSerifText size="base" style={styles.editButtonText}> Edit Profile</SansSerifText>
          </Button>
        </View>

        <AccountInfoSection
          theme={theme}
          userId={user?.userId}
          billing={billing}
          entitled={entitled}
          statusColor={statusColor}
          statusLabel={statusLabel}
          billingAction={billingAction}
          isCreatingPortal={billingActions.isCreatingPortal}
          onManageBilling={handleManageBilling}
          onUpgrade={handleUpgrade}
        />

        <View>
          <ItemGroup title="Account Settings">
            {capabilities.canResetPassword && (
              <Item onPress={changePassword.start}>
                <ItemMedia size={36} icon="key" />
                <ItemContent>
                  <ItemTitle>Change Password</ItemTitle>
                  <ItemDescription>We email a code to {user?.email}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Icon name="chevron-right" size={18} color={theme.colors.mutedForeground} />
                </ItemActions>
              </Item>
            )}
            <Item onPress={() => setPrivacyOpen((open) => !open)}>
              <ItemMedia size={36} icon="shield" />
              <ItemContent>
                <ItemTitle>Privacy Settings</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Icon
                  name={privacyOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.colors.mutedForeground}
                />
              </ItemActions>
            </Item>
          </ItemGroup>
          <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <CollapsibleContent>
              <ItemGroup testID="profile-privacy-settings">
                <Item>
                  <ItemMedia size={36} icon="eye" />
                  <ItemContent>
                    <ItemTitle>Public profile</ItemTitle>
                    <ItemDescription>Let others find your profile</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      checked={publicProfile}
                      onCheckedChange={(value) => setPreference("publicProfile", value)}
                    />
                  </ItemActions>
                </Item>
                <Item>
                  <ItemMedia size={36} icon="chart-no-axes-column" />
                  <ItemContent>
                    <ItemTitle>Share analytics</ItemTitle>
                    <ItemDescription>Anonymous usage data helps improve the app</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      checked={analytics}
                      onCheckedChange={(value) => setPreference("analytics", value)}
                    />
                  </ItemActions>
                </Item>
              </ItemGroup>
            </CollapsibleContent>
          </Collapsible>
        </View>

        <ItemGroup title="Notifications">
          <Item>
            <ItemMedia size={36} icon="mail" />
            <ItemContent>
              <ItemTitle>Email Notifications</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={emailNotifications}
                onCheckedChange={(value) => setPreference("emailNotifications", value)}
              />
            </ItemActions>
          </Item>
          <Item>
            <ItemMedia size={36} icon="bell" />
            <ItemContent>
              <ItemTitle>Push Notifications</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={pushNotifications}
                onCheckedChange={(value) => setPreference("pushNotifications", value)}
              />
            </ItemActions>
          </Item>
          <Item>
            <ItemMedia size={36} icon="send" />
            <ItemContent>
              <ItemTitle>Marketing Emails</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={marketingEmails}
                onCheckedChange={(value) => setPreference("marketingEmails", value)}
              />
            </ItemActions>
          </Item>
        </ItemGroup>

        {capabilities.socialProviders.length > 0 && (
          <ItemGroup
            title="Connected Accounts"
            footer="Signing in with a provider links it to this account."
          >
            {capabilities.socialProviders.map((provider) => {
              const meta = PROVIDER_META[provider];
              return (
                <Item key={provider} onPress={() => handleConnect(provider)}>
                  <ItemMedia size={36} style={meta.tile(styles)}>
                    <SansSerifBoldText size="body" style={meta.letter(styles)}>
                      {meta.initial}
                    </SansSerifBoldText>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{meta.label}</ItemTitle>
                    <ItemDescription>Connect with {meta.label} sign-in</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon name="link-2" size={18} color={theme.colors.primary} />
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}

        {showDangerZone && (
          <ItemGroup title="Danger Zone">
            {isAuthenticated && (
              <Item onPress={handleSignOut}>
                <ItemMedia
                  size={36}
                  icon="log-out"
                  iconColor={theme.colors.destructive}
                  style={styles.destructiveTile}
                />
                <ItemContent>
                  <ItemTitle style={styles.destructiveLabel}>Sign Out</ItemTitle>
                </ItemContent>
              </Item>
            )}
            {capabilities.canDeleteAccount && (
              <Item onPress={handleDeleteAccount}>
                <ItemMedia
                  size={36}
                  icon="trash"
                  iconColor={theme.colors.destructive}
                  style={styles.destructiveTile}
                />
                <ItemContent>
                  <ItemTitle style={styles.destructiveLabel}>Delete Account</ItemTitle>
                </ItemContent>
              </Item>
            )}
          </ItemGroup>
        )}
      </ScrollView>
      <EditProfileSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        authEnabled={capabilities.authEnabled}
        fallbackName={fallbackName}
      />
      {capabilities.canResetPassword && user?.email ? (
        <ChangePasswordSheet flow={changePassword} email={user.email} />
      ) : null}
    </>
  );
}

type ProfileStyles = ReturnType<typeof createStyles>;

/** Brand tiles for the federated providers the env can list. */
const PROVIDER_META: Record<
  SocialAuthProviderName,
  {
    label: string;
    initial: string;
    tile: (styles: ProfileStyles) => StyleProp<ViewStyle>;
    letter: (styles: ProfileStyles) => StyleProp<TextStyle>;
  }
> = {
  google: {
    label: "Google",
    initial: "G",
    tile: (styles) => styles.googleTile,
    letter: (styles) => styles.providerLetter,
  },
  apple: {
    label: "Apple",
    initial: "A",
    tile: (styles) => styles.appleTile,
    letter: (styles) => styles.appleLetter,
  },
};

function AccountInfoSection({
  theme,
  userId,
  billing,
  entitled,
  statusColor,
  statusLabel,
  billingAction,
  isCreatingPortal,
  onManageBilling,
  onUpgrade,
}: {
  theme: Theme;
  userId?: string;
  billing?: BillingSummary;
  entitled: boolean;
  statusColor: string;
  statusLabel: string;
  billingAction: "manage" | "upgrade" | null;
  isCreatingPortal: boolean;
  onManageBilling: () => void;
  onUpgrade: () => void;
}) {
  return (
    <ItemGroup title="Account Info">
      <Item>
        <ItemMedia size={36} icon="user" />
        <ItemContent>
          <ItemTitle>User ID</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ItemDescription>{userId ? userId.slice(0, 8) + "..." : "—"}</ItemDescription>
        </ItemActions>
      </Item>
      <Item>
        <ItemMedia
          size={36}
          icon="award"
          iconColor={entitled ? theme.colors.success : theme.colors.mutedForeground}
        />
        <ItemContent>
          <ItemTitle>Plan</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ItemDescription>{billing?.planLabel ?? "Free"}</ItemDescription>
        </ItemActions>
      </Item>
      <Item>
        <ItemMedia size={36} icon="calendar" />
        <ItemContent>
          <ItemTitle>Renews</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ItemDescription>
            {formatPeriodEnd(billing?.currentPeriodEnd, billing?.cancelAtPeriodEnd)}
          </ItemDescription>
        </ItemActions>
      </Item>
      <Item>
        <ItemMedia size={36} icon="shield" iconColor={statusColor} />
        <ItemContent>
          <ItemTitle>Status</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ItemDescription style={{ color: statusColor }}>{statusLabel}</ItemDescription>
        </ItemActions>
      </Item>
      {billing?.cancelAtPeriodEnd && (
        <Item>
          <ItemMedia size={36} icon="triangle-alert" iconColor={theme.colors.warning} />
          <ItemContent>
            <ItemDescription>
              Your plan is scheduled to end. Re-enable from Manage
              subscription to keep access.
            </ItemDescription>
          </ItemContent>
        </Item>
      )}
      {billing?.status === "past_due" && (
        <Item>
          <ItemMedia size={36} icon="triangle-alert" iconColor={theme.colors.warning} />
          <ItemContent>
            <ItemDescription>
              Your last payment failed. Update your payment method in Manage
              subscription.
            </ItemDescription>
          </ItemContent>
        </Item>
      )}
      {billingAction && (
        <Item
          onPress={billingAction === "manage" ? onManageBilling : onUpgrade}
          disabled={isCreatingPortal}
        >
          <ItemMedia
            size={36}
            icon={billingAction === "manage" ? "credit-card" : "zap"}
            iconColor={theme.colors.accent}
          />
          <ItemContent>
            <ItemTitle style={{ color: theme.colors.accent }}>
              {billingAction === "manage"
                ? isCreatingPortal
                  ? "Opening…"
                  : "Manage Subscription"
                : "Upgrade"}
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" size={18} color={theme.colors.accent} />
          </ItemActions>
        </Item>
      )}
    </ItemGroup>
  );
}

function handleUpgrade() {
  router.push("/(main)/(demos)/screen-pricing");
}

function statusToLabel(status: BillingSummary["status"] | undefined): string {
  switch (status) {
  case "trialing":
    return "Trial";
  case "active":
    return "Active";
  case "past_due":
    return "Past due";
  case "canceled":
    return "Canceled";
  case "incomplete":
    return "Incomplete";
  case "free":
  case undefined:
  default:
    return "Free";
  }
}

function formatPeriodEnd(
  iso: string | null | undefined,
  cancelAtPeriodEnd: boolean | undefined,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const formatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return cancelAtPeriodEnd ? `Ends ${formatted}` : formatted;
}

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.sectionSpacing,
    },
    headerSection: {
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    name: {
      color: theme.colors.foreground,
      marginBottom: spacing.xs,
    },
    nameSpaced: {
      marginBottom: spacing.md,
    },
    email: {
      color: theme.colors.mutedForeground,
      marginBottom: spacing.md,
    },
    editButtonText: {
      color: theme.colors.primary,
    },
    googleTile: {
      // eslint-disable-next-line expo-ui/no-restyle, expo-ui/no-raw-colors -- Google brand tile; must not follow the theme, and ItemMedia has no tint variant
      backgroundColor: "#DB4437",
    },
    appleTile: {
      // eslint-disable-next-line expo-ui/no-restyle -- Apple brand tile inverts with the theme; ItemMedia has no tint variant
      backgroundColor: theme.colors.foreground,
    },
    providerLetter: {
      color: palette.white,
    },
    appleLetter: {
      color: theme.colors.background,
    },
    destructiveTile: {
      // eslint-disable-next-line expo-ui/no-restyle -- destructive icon tile tint; ItemMedia has no tint variant
      backgroundColor: withAlpha(theme.colors.destructive, 0.12),
    },
    destructiveLabel: {
      color: theme.colors.destructive,
    },
  });

const themedStyles = createThemedStyles(createStyles);

function messagesForProblem(problem: BillingProblem): string[] {
  switch (problem.kind) {
  case "unauthorized":
    return ["Sign in to manage billing."];
  case "billing-disabled":
    return ["Billing isn't enabled in this environment."];
  case "no-customer":
    return ["You don't have a Stripe customer yet — subscribe first."];
  case "billing-conflict":
    return ["Your account is linked to multiple Stripe customers — contact support."];
  case "configuration-missing":
    return [problem.message || "Billing configuration is incomplete."];
  case "unknown-plan":
    return ["That plan isn't available right now."];
  case "bad-request":
    return [problem.message || "We couldn't process that request."];
  case "network-error":
    return ["Connection interrupted — please try again."];
  case "server-error":
  default:
    return [problem.message || "Something went wrong. Please try again."];
  }
}
