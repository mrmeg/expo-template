import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthWrapper } from "@/client/components/auth/AuthWrapper";
import { useAuth } from "@/client/hooks/useAuth";
import { useAuthStore } from "@/client/stores/authStore";
import { useTheme } from "@/client/hooks/useTheme";
import { Button } from "@/client/components/ui/Button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/client/components/ui/Card";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";

function ProtectedContent() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { signOut } = useAuth();
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Protected Content</CardTitle>
            <CardDescription>
              You are authenticated and can see this content.
            </CardDescription>
          </CardHeader>

          <CardContent style={styles.cardContent}>
            <View style={styles.userInfo}>
              <SansSerifText style={styles.label}>User ID:</SansSerifText>
              <SansSerifBoldText style={styles.value}>
                {user?.userId || "Unknown"}
              </SansSerifBoldText>
            </View>

            <View style={styles.userInfo}>
              <SansSerifText style={styles.label}>Username:</SansSerifText>
              <SansSerifBoldText style={styles.value}>
                {user?.username || "Unknown"}
              </SansSerifBoldText>
            </View>

            {user?.email && (
              <View style={styles.userInfo}>
                <SansSerifText style={styles.label}>Email:</SansSerifText>
                <SansSerifBoldText style={styles.value}>
                  {user.email}
                </SansSerifBoldText>
              </View>
            )}

            <Button preset="destructive" onPress={signOut} fullWidth>
              <SansSerifBoldText>Sign Out</SansSerifBoldText>
            </Button>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}

export default function AuthDemoScreen() {
  return (
    <AuthWrapper>
      <ProtectedContent />
    </AuthWrapper>
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
      justifyContent: "center",
      padding: spacing.md,
    },
    card: {
      maxWidth: 400,
      alignSelf: "center",
      width: "100%",
    },
    cardContent: {
      gap: spacing.md,
    },
    userInfo: {
      gap: spacing.xs,
    },
    label: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
    },
    value: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
  });
