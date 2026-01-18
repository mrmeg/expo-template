import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthWrapper } from "@/client/components/auth/AuthWrapper";
import { useAuth } from "@/client/hooks/useAuth";
import { useAuthStore, AuthState } from "@/client/stores/authStore";
import { useTheme } from "@/client/hooks/useTheme";
import { Button } from "@/client/components/ui/Button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/client/components/ui/Card";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  User,
  Mail,
  Key,
  LogOut,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react-native";

// Auth state badge component
function AuthStateBadge({ state }: { state: AuthState }) {
  const { theme } = useTheme();

  const config = {
    loading: {
      icon: Loader2,
      color: theme.colors.warning,
      label: "Loading",
      bgColor: theme.colors.warning + "20",
    },
    authenticated: {
      icon: ShieldCheck,
      color: theme.colors.success,
      label: "Authenticated",
      bgColor: theme.colors.success + "20",
    },
    unauthenticated: {
      icon: ShieldX,
      color: theme.colors.destructive,
      label: "Unauthenticated",
      bgColor: theme.colors.destructive + "20",
    },
  };

  const { icon, color, label, bgColor } = config[state];

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Icon as={icon} size={16} color={color} />
      <SansSerifBoldText style={[styles.badgeText, { color }]}>
        {label}
      </SansSerifBoldText>
    </View>
  );
}

// Protected content section
function ProtectedSection() {
  const { theme } = useTheme();
  const dynamicStyles = createStyles(theme);

  return (
    <Card style={dynamicStyles.card}>
      <CardHeader>
        <View style={dynamicStyles.cardHeaderRow}>
          <Icon as={Lock} size={20} color={theme.colors.success} />
          <CardTitle style={{ marginLeft: spacing.sm }}>Protected Content</CardTitle>
        </View>
        <CardDescription>
          This section is only visible when authenticated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <View style={dynamicStyles.successBox}>
          <Icon as={CheckCircle} size={24} color={theme.colors.success} />
          <View style={dynamicStyles.successTextContainer}>
            <SansSerifBoldText style={[dynamicStyles.successTitle, { color: theme.colors.success }]}>
              Access Granted
            </SansSerifBoldText>
            <SansSerifText style={dynamicStyles.successMessage}>
              The AuthWrapper successfully validated your authentication state
              and is rendering this protected content.
            </SansSerifText>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}

// User info section
function UserInfoSection() {
  const { theme } = useTheme();
  const dynamicStyles = createStyles(theme);
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
    <Card style={dynamicStyles.card}>
      <CardHeader>
        <View style={dynamicStyles.cardHeaderRow}>
          <Icon as={User} size={20} color={theme.colors.primary} />
          <CardTitle style={{ marginLeft: spacing.sm }}>User Details</CardTitle>
        </View>
        <CardDescription>
          Current authenticated user information from Cognito.
        </CardDescription>
      </CardHeader>
      <CardContent style={dynamicStyles.cardContent}>
        <View style={dynamicStyles.infoRow}>
          <View style={dynamicStyles.infoLabel}>
            <Icon as={Key} size={14} color={theme.colors.mutedForeground} />
            <SansSerifText style={dynamicStyles.labelText}>User ID</SansSerifText>
          </View>
          <SansSerifText style={dynamicStyles.infoValue} numberOfLines={1}>
            {user.userId}
          </SansSerifText>
        </View>

        <View style={dynamicStyles.infoRow}>
          <View style={dynamicStyles.infoLabel}>
            <Icon as={User} size={14} color={theme.colors.mutedForeground} />
            <SansSerifText style={dynamicStyles.labelText}>Username</SansSerifText>
          </View>
          <SansSerifText style={dynamicStyles.infoValue} numberOfLines={1}>
            {user.username}
          </SansSerifText>
        </View>

        {user.email && (
          <View style={dynamicStyles.infoRow}>
            <View style={dynamicStyles.infoLabel}>
              <Icon as={Mail} size={14} color={theme.colors.mutedForeground} />
              <SansSerifText style={dynamicStyles.labelText}>Email</SansSerifText>
            </View>
            <SansSerifText style={dynamicStyles.infoValue} numberOfLines={1}>
              {user.email}
            </SansSerifText>
          </View>
        )}

        <View style={dynamicStyles.signOutContainer}>
          <Button
            preset="destructive"
            onPress={handleSignOut}
            disabled={signingOut}
            fullWidth
          >
            <Icon as={LogOut} size={16} color={theme.colors.destructiveForeground} />
            <SansSerifBoldText style={{ color: theme.colors.destructiveForeground, marginLeft: spacing.xs }}>
              {signingOut ? "Signing Out..." : "Sign Out"}
            </SansSerifBoldText>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}

// Auth state monitor section
function AuthStateMonitor() {
  const { theme } = useTheme();
  const dynamicStyles = createStyles(theme);
  const { state, pendingVerificationEmail, error } = useAuthStore();
  const { checkAuthState } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stateHistory, setStateHistory] = useState<{ state: AuthState; timestamp: Date }[]>([]);

  // Track state changes
  useEffect(() => {
    setStateHistory((prev) => [...prev.slice(-4), { state, timestamp: new Date() }]);
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
    <Card style={dynamicStyles.card}>
      <CardHeader>
        <View style={dynamicStyles.cardHeaderRow}>
          <Icon as={Shield} size={20} color={theme.colors.primary} />
          <CardTitle style={{ marginLeft: spacing.sm }}>Auth State Monitor</CardTitle>
        </View>
        <CardDescription>
          Real-time authentication state tracking and diagnostics.
        </CardDescription>
      </CardHeader>
      <CardContent style={dynamicStyles.cardContent}>
        {/* Current State */}
        <View style={dynamicStyles.stateContainer}>
          <SansSerifText style={dynamicStyles.stateLabel}>Current State</SansSerifText>
          <AuthStateBadge state={state} />
        </View>

        {/* Pending Verification */}
        {pendingVerificationEmail && (
          <View style={dynamicStyles.warningBox}>
            <Icon as={Clock} size={16} color={theme.colors.warning} />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <SansSerifBoldText style={{ color: theme.colors.warning, fontSize: 13 }}>
                Pending Verification
              </SansSerifBoldText>
              <SansSerifText style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
                {pendingVerificationEmail}
              </SansSerifText>
            </View>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={dynamicStyles.errorBox}>
            <Icon as={XCircle} size={16} color={theme.colors.destructive} />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <SansSerifBoldText style={{ color: theme.colors.destructive, fontSize: 13 }}>
                Error
              </SansSerifBoldText>
              <SansSerifText style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
                {error}
              </SansSerifText>
            </View>
          </View>
        )}

        {/* State History */}
        <View style={dynamicStyles.historyContainer}>
          <SansSerifText style={dynamicStyles.historyTitle}>State History</SansSerifText>
          {stateHistory.length === 0 ? (
            <SansSerifText style={dynamicStyles.historyEmpty}>No state changes yet</SansSerifText>
          ) : (
            stateHistory.map((entry, index) => (
              <View key={index} style={dynamicStyles.historyItem}>
                <SansSerifText style={dynamicStyles.historyTime}>
                  {entry.timestamp.toLocaleTimeString()}
                </SansSerifText>
                <SansSerifText style={dynamicStyles.historyState}>
                  {entry.state}
                </SansSerifText>
              </View>
            ))
          )}
        </View>

        {/* Refresh Button */}
        <Button
          preset="outline"
          onPress={handleRefresh}
          disabled={refreshing}
          fullWidth
        >
          <Icon as={RefreshCw} size={16} color={theme.colors.primary} />
          <SansSerifText style={{ color: theme.colors.primary, marginLeft: spacing.xs }}>
            {refreshing ? "Refreshing..." : "Refresh Auth State"}
          </SansSerifText>
        </Button>
      </CardContent>
    </Card>
  );
}

// How It Works section
function HowItWorksSection() {
  const { theme } = useTheme();
  const dynamicStyles = createStyles(theme);

  return (
    <Card style={dynamicStyles.card}>
      <CardHeader>
        <View style={dynamicStyles.cardHeaderRow}>
          <Icon as={Unlock} size={20} color={theme.colors.primary} />
          <CardTitle style={{ marginLeft: spacing.sm }}>How It Works</CardTitle>
        </View>
      </CardHeader>
      <CardContent style={dynamicStyles.cardContent}>
        <View style={dynamicStyles.stepItem}>
          <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <SansSerifBoldText style={{ color: theme.colors.primaryForeground, fontSize: 12 }}>1</SansSerifBoldText>
          </View>
          <View style={dynamicStyles.stepContent}>
            <SansSerifBoldText style={dynamicStyles.stepTitle}>AuthWrapper Component</SansSerifBoldText>
            <SansSerifText style={dynamicStyles.stepDescription}>
              Wrap any content with AuthWrapper to protect it. Shows loading state, then auth screen or content.
            </SansSerifText>
          </View>
        </View>

        <View style={dynamicStyles.stepItem}>
          <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <SansSerifBoldText style={{ color: theme.colors.primaryForeground, fontSize: 12 }}>2</SansSerifBoldText>
          </View>
          <View style={dynamicStyles.stepContent}>
            <SansSerifBoldText style={dynamicStyles.stepTitle}>Auth Store (Zustand)</SansSerifBoldText>
            <SansSerifText style={dynamicStyles.stepDescription}>
              Centralized state management. Tracks user, auth state, and pending verification.
            </SansSerifText>
          </View>
        </View>

        <View style={dynamicStyles.stepItem}>
          <View style={[dynamicStyles.stepNumber, { backgroundColor: theme.colors.primary }]}>
            <SansSerifBoldText style={{ color: theme.colors.primaryForeground, fontSize: 12 }}>3</SansSerifBoldText>
          </View>
          <View style={dynamicStyles.stepContent}>
            <SansSerifBoldText style={dynamicStyles.stepTitle}>AWS Amplify + Cognito</SansSerifBoldText>
            <SansSerifText style={dynamicStyles.stepDescription}>
              Handles sign in, sign up, email verification, password reset, and token management.
            </SansSerifText>
          </View>
        </View>

        <View style={dynamicStyles.codeBlock}>
          <SansSerifText style={dynamicStyles.codeText}>
            {`<AuthWrapper>
  <ProtectedContent />
</AuthWrapper>`}
          </SansSerifText>
        </View>
      </CardContent>
    </Card>
  );
}

// Main content when authenticated
function AuthenticatedContent() {
  const { theme } = useTheme();
  const dynamicStyles = createStyles(theme);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={["bottom"]}>
      <ScrollView
        style={dynamicStyles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AuthStateMonitor />
        <ProtectedSection />
        <UserInfoSection />
        <HowItWorksSection />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AuthDemoScreen() {
  return (
    <AuthWrapper>
      <AuthenticatedContent />
    </AuthWrapper>
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
  badgeText: {
    fontSize: 13,
  },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    card: {
      marginBottom: spacing.md,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    cardContent: {
      gap: spacing.md,
    },
    stateContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stateLabel: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    labelText: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
    infoValue: {
      fontSize: 14,
      color: theme.colors.foreground,
      flex: 1,
      textAlign: "right",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    signOutContainer: {
      marginTop: spacing.sm,
    },
    successBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.success + "15",
      padding: spacing.md,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      borderColor: theme.colors.success + "30",
    },
    successTextContainer: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    successTitle: {
      fontSize: 14,
      marginBottom: spacing.xs,
    },
    successMessage: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      lineHeight: 18,
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.warning + "15",
      padding: spacing.sm,
      borderRadius: spacing.radiusSm,
      borderWidth: 1,
      borderColor: theme.colors.warning + "30",
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.destructive + "15",
      padding: spacing.sm,
      borderRadius: spacing.radiusSm,
      borderWidth: 1,
      borderColor: theme.colors.destructive + "30",
    },
    historyContainer: {
      backgroundColor: theme.colors.muted,
      padding: spacing.sm,
      borderRadius: spacing.radiusSm,
    },
    historyTitle: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      marginBottom: spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    historyEmpty: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      fontStyle: "italic",
    },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.xs / 2,
    },
    historyTime: {
      fontSize: 11,
      color: theme.colors.mutedForeground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    historyState: {
      fontSize: 12,
      color: theme.colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    stepItem: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    stepNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 14,
      color: theme.colors.foreground,
      marginBottom: spacing.xs / 2,
    },
    stepDescription: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
      lineHeight: 18,
    },
    codeBlock: {
      backgroundColor: theme.colors.muted,
      padding: spacing.md,
      borderRadius: spacing.radiusSm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    codeText: {
      fontSize: 12,
      color: theme.colors.foreground,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      lineHeight: 18,
    },
  });
