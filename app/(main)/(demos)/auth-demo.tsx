import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/client/features/auth/hooks/useAuth";
import { useAuthStore, AuthState } from "@/client/features/auth/stores/authStore";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText, MonoText, EyebrowText } from "@mrmeg/expo-ui/components/StyledText";
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
import { spacing } from "@mrmeg/expo-ui/constants";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";
import type { IconName } from "@mrmeg/expo-ui/components/Icon";

/**
 * AuthWrapper comes from a lazy `import()` of the auth components barrel so this
 * demo route doesn't drag the auth screen and its five forms onto the eager web
 * download path — see `@/client/features/auth/components` for why the specifier
 * has to match the one used by AuthGate and the showcase gallery. `useAuth` and
 * `useAuthStore` above stay static: they're small and every section here reads
 * auth state directly.
 *
 * The fallback is `null` because AuthWrapper renders its own loading indicator
 * as soon as it mounts; a second spinner would only flash between the two.
 */
const AuthWrapper = lazy(async () => ({
  default: (await import("@/client/features/auth/components")).AuthWrapper,
}));

// Auth state badge component
function AuthStateBadge({ state }: { state: AuthState }) {
  const { theme } = useTheme();

  const config: Record<AuthState, { icon: IconName; color: string; label: string; bgColor: string }> = {
    loading: {
      icon: "loader",
      color: theme.colors.warning,
      label: "Loading",
      bgColor: withAlpha(theme.colors.warning, 0.13),
    },
    authenticated: {
      icon: "shield",
      color: theme.colors.success,
      label: "Authenticated",
      bgColor: withAlpha(theme.colors.success, 0.13),
    },
    unauthenticated: {
      icon: "shield-off",
      color: theme.colors.destructive,
      label: "Unauthenticated",
      bgColor: withAlpha(theme.colors.destructive, 0.13),
    },
  };

  const { icon, color, label, bgColor } = config[state];

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Icon name={icon} size={16} color={color} />
      <SansSerifBoldText size="sm" style={{ color }}>
        {label}
      </SansSerifBoldText>
    </View>
  );
}

// Protected content section
function ProtectedSection() {
  const { theme } = useTheme();

  return (
    <ItemGroup
      title="Protected Content"
      description="This section is only visible when authenticated."
    >
      <Item>
        <ItemMedia size={36} icon="circle-check-big" iconColor={theme.colors.success} />
        <ItemContent>
          <ItemTitle style={{ color: theme.colors.success }}>Access Granted</ItemTitle>
          <ItemDescription>
            The AuthWrapper successfully validated your authentication state
            and is rendering this protected content.
          </ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  );
}

// User info section
function UserInfoSection() {
  const { theme } = useTheme();
  const dynamicStyles = themedStyles(theme);
  const { user } = useAuthStore();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (!user) return null;

  return (
    <View style={dynamicStyles.section}>
      {/* Values stack under their labels: ids and emails are too long to
          share a row with them on a phone. */}
      <ItemGroup
        title="User Details"
        description="Current authenticated user information from Cognito."
      >
        <Item>
          <ItemMedia size={36} icon="key" />
          <ItemContent>
            <ItemTitle>User ID</ItemTitle>
            <MonoText size="sm" style={dynamicStyles.infoValue} numberOfLines={1}>
              {user.userId}
            </MonoText>
          </ItemContent>
        </Item>

        <Item>
          <ItemMedia size={36} icon="user" />
          <ItemContent>
            <ItemTitle>Username</ItemTitle>
            <MonoText size="sm" style={dynamicStyles.infoValue} numberOfLines={1}>
              {user.username}
            </MonoText>
          </ItemContent>
        </Item>

        {!!user.email && (
          <Item>
            <ItemMedia size={36} icon="mail" />
            <ItemContent>
              <ItemTitle>Email</ItemTitle>
              <MonoText size="sm" style={dynamicStyles.infoValue} numberOfLines={1}>
                {user.email}
              </MonoText>
            </ItemContent>
          </Item>
        )}
      </ItemGroup>

      <View style={dynamicStyles.actions}>
        <Button
          preset="destructive"
          onPress={handleSignOut}
          disabled={signingOut}
          fullWidth
        >
          <Icon name="log-out" size={16} color={theme.colors.destructiveForeground} />
          <SansSerifBoldText style={{ color: theme.colors.destructiveForeground, marginLeft: spacing.xs }}>
            {signingOut ? "Signing Out..." : "Sign Out"}
          </SansSerifBoldText>
        </Button>
      </View>
    </View>
  );
}

// Auth state monitor section
function AuthStateMonitor() {
  const { theme } = useTheme();
  const dynamicStyles = themedStyles(theme);
  const { state, pendingVerificationEmail, error } = useAuthStore();
  const { checkAuthState } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const stateHistoryId = useRef(0);
  const [stateHistory, setStateHistory] = useState<{ id: string; state: AuthState; timestamp: Date }[]>([]);

  // Track state changes
  useEffect(() => {
    setStateHistory((prev) => [
      ...prev.slice(-4),
      {
        id: `${state}-${stateHistoryId.current++}`,
        state,
        timestamp: new Date(),
      },
    ]);
  }, [state]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await checkAuthState();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={dynamicStyles.section}>
      <ItemGroup
        title="Auth State Monitor"
        description="Real-time authentication state tracking and diagnostics."
      >
        <Item>
          <ItemContent>
            <ItemTitle>Current State</ItemTitle>
          </ItemContent>
          <ItemActions>
            <AuthStateBadge state={state} />
          </ItemActions>
        </Item>

        {!!pendingVerificationEmail && (
          <Item>
            <ItemMedia size={36} icon="clock" iconColor={theme.colors.warning} />
            <ItemContent>
              <ItemTitle style={{ color: theme.colors.warning }}>Pending Verification</ItemTitle>
              <ItemDescription>{pendingVerificationEmail}</ItemDescription>
            </ItemContent>
          </Item>
        )}

        {!!error && (
          <Item>
            <ItemMedia size={36} icon="circle-x" iconColor={theme.colors.destructive} />
            <ItemContent>
              <ItemTitle style={{ color: theme.colors.destructive }}>Error</ItemTitle>
              <ItemDescription>{error}</ItemDescription>
            </ItemContent>
          </Item>
        )}
      </ItemGroup>

      <ItemGroup
        title="State History"
        footer={stateHistory.length === 0 ? "No state changes yet" : undefined}
      >
        {stateHistory.map((entry) => (
          <Item key={entry.id}>
            <ItemContent>
              <MonoText size="xs" style={dynamicStyles.historyTime}>
                {entry.timestamp.toLocaleTimeString()}
              </MonoText>
            </ItemContent>
            <ItemActions>
              <MonoText size="sm" style={dynamicStyles.historyState}>
                {entry.state}
              </MonoText>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>

      <View style={dynamicStyles.actions}>
        <Button
          preset="outline"
          onPress={handleRefresh}
          disabled={refreshing}
          fullWidth
        >
          <Icon name="refresh-cw" size={16} color={theme.colors.primary} />
          <SansSerifText style={{ color: theme.colors.primary, marginLeft: spacing.xs }}>
            {refreshing ? "Refreshing..." : "Refresh Auth State"}
          </SansSerifText>
        </Button>
      </View>
    </View>
  );
}

// How It Works section: explanatory copy, so a flat padded block under a
// section header rather than rows.
function HowItWorksSection() {
  const { theme } = useTheme();
  const dynamicStyles = themedStyles(theme);

  return (
    <View style={dynamicStyles.flatSection}>
      <EyebrowText accessibilityRole="header" style={{ color: theme.colors.mutedForeground }}>
        How It Works
      </EyebrowText>

      <View style={dynamicStyles.stepItem}>
        <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
          <SansSerifBoldText size="sm" style={{ color: theme.colors.primaryForeground }}>1</SansSerifBoldText>
        </View>
        <View style={dynamicStyles.stepContent}>
          <SansSerifBoldText size="base" style={dynamicStyles.stepTitle}>AuthWrapper Component</SansSerifBoldText>
          <SansSerifText size="sm" style={dynamicStyles.stepDescription}>
            Wrap any content with AuthWrapper to protect it. Shows loading state, then auth screen or content.
          </SansSerifText>
        </View>
      </View>

      <View style={dynamicStyles.stepItem}>
        <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
          <SansSerifBoldText size="sm" style={{ color: theme.colors.primaryForeground }}>2</SansSerifBoldText>
        </View>
        <View style={dynamicStyles.stepContent}>
          <SansSerifBoldText size="base" style={dynamicStyles.stepTitle}>Auth Store (Zustand)</SansSerifBoldText>
          <SansSerifText size="sm" style={dynamicStyles.stepDescription}>
            Centralized state management. Tracks user, auth state, and pending verification.
          </SansSerifText>
        </View>
      </View>

      <View style={dynamicStyles.stepItem}>
        <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
          <SansSerifBoldText size="sm" style={{ color: theme.colors.primaryForeground }}>3</SansSerifBoldText>
        </View>
        <View style={dynamicStyles.stepContent}>
          <SansSerifBoldText size="base" style={dynamicStyles.stepTitle}>AWS Amplify + Cognito</SansSerifBoldText>
          <SansSerifText size="sm" style={dynamicStyles.stepDescription}>
            Handles sign in, sign up, email verification, password reset, and token management.
          </SansSerifText>
        </View>
      </View>

      <View style={dynamicStyles.codeBlock}>
        <MonoText size="sm" style={dynamicStyles.codeText}>
          {`<AuthWrapper>
  <ProtectedContent />
</AuthWrapper>`}
        </MonoText>
      </View>
    </View>
  );
}

// Main content when authenticated
function AuthenticatedContent() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicStyles = themedStyles(theme);

  return (
    <ScrollView
      style={dynamicStyles.container}
      contentContainerStyle={[
        dynamicStyles.scrollContent,
        { paddingBottom: spacing.xxxl + insets.bottom },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* The grouped rows carry the screen's 16pt inset, so the scroll view
          adds none; buttons and prose pad their own blocks. */}
      <AuthStateMonitor />
      <ProtectedSection />
      <UserInfoSection />
      <HowItWorksSection />
    </ScrollView>
  );
}

export default function AuthDemoScreen() {
  return (
    <Suspense fallback={null}>
      <AuthWrapper>
        <AuthenticatedContent />
      </AuthWrapper>
    </Suspense>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusFull,
    gap: spacing.xs,
  },
});

// Wide screens cap and centre the column instead of boxing it.
const MAX_CONTENT_WIDTH = 640;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      width: "100%",
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: "center",
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
      gap: spacing.sectionSpacing,
    },
    // A section's groups and its action button sit closer to each other than
    // to the next section.
    section: {
      gap: spacing.md,
    },
    actions: {
      paddingHorizontal: spacing.screenPadding,
    },
    infoValue: {
      color: theme.colors.mutedForeground,
    },
    historyTime: {
      color: theme.colors.mutedForeground,
    },
    historyState: {
      color: theme.colors.foreground,
    },
    flatSection: {
      paddingHorizontal: spacing.screenPadding,
      gap: spacing.md,
    },
    stepItem: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    stepNumber: {
      width: 24,
      height: 24,
      borderRadius: spacing.radiusFull,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      color: theme.colors.foreground,
      marginBottom: spacing.xxs,
    },
    stepDescription: {
      color: theme.colors.mutedForeground,
    },
    codeBlock: {
      backgroundColor: theme.colors.muted,
      padding: spacing.md,
      borderRadius: spacing.radiusSm,
    },
    codeText: {
      color: theme.colors.foreground,
    },
  });

const themedStyles = createThemedStyles(createStyles);
