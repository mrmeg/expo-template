import React, { useState } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/client/components/ui/Card";
import { TextInput } from "@/client/components/ui/TextInput";
import { Button } from "@/client/components/ui/Button";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import type { Theme } from "@/client/constants/colors";

export interface ResetPasswordFormProps {
  onSubmit?: (password: string) => void | Promise<void>;
  onBack?: () => void;
  loading?: boolean;
  error?: string;
  success?: boolean;
  title?: string;
  description?: string;
  minPasswordLength?: number;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function ResetPasswordForm({
  onSubmit,
  onBack,
  loading = false,
  error,
  success = false,
  title = "Reset your password",
  description = "Enter your new password below.",
  minPasswordLength = 8,
  embedded = false,
}: ResetPasswordFormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    if (value.length < minPasswordLength) {
      setPasswordError(`Password must be at least ${minPasswordLength} characters`);
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateConfirmPassword = (value: string): boolean => {
    if (!value) {
      setConfirmPasswordError("Please confirm your password");
      return false;
    }
    if (value !== password) {
      setConfirmPasswordError("Passwords do not match");
      return false;
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleSubmit = async () => {
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);
    if (isPasswordValid && isConfirmPasswordValid) {
      await onSubmit?.(password);
    }
  };

  const wrapContent = (content: React.ReactNode) => {
    if (embedded) {
      return <View style={styles.embeddedContainer}>{content}</View>;
    }
    return (
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  if (success) {
    return wrapContent(
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Password reset successful</CardTitle>
          <CardDescription>
            Your password has been successfully updated. You can now sign in with your new password.
          </CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          <Button
            preset="default"
            onPress={onBack}
            fullWidth
          >
            <SansSerifBoldText>Sign in</SansSerifBoldText>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return wrapContent(
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <SansSerifText style={styles.errorText}>{error}</SansSerifText>
          </View>
        )}

        <View style={styles.inputGroup}>
          <TextInput
            label="New Password"
            placeholder="Enter your new password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) validatePassword(text);
              if (confirmPassword && confirmPasswordError) {
                validateConfirmPassword(confirmPassword);
              }
            }}
            onBlur={() => validatePassword(password)}
            error={!!passwordError}
            errorText={passwordError}
            secureTextEntry
            showSecureEntryToggle
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!loading}
            required
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            label="Confirm New Password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmPasswordError) validateConfirmPassword(text);
            }}
            onBlur={() => validateConfirmPassword(confirmPassword)}
            error={!!confirmPasswordError}
            errorText={confirmPasswordError}
            secureTextEntry
            showSecureEntryToggle
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!loading}
            required
          />
        </View>

        <View style={styles.requirements}>
          <SansSerifText style={styles.requirementsText}>
            Password must be at least {minPasswordLength} characters
          </SansSerifText>
        </View>

        <Button
          preset="default"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
        >
          <SansSerifBoldText>Reset Password</SansSerifBoldText>
        </Button>
      </CardContent>

      {onBack && (
        <CardFooter style={styles.footer}>
          <Pressable onPress={onBack} disabled={loading}>
            <SansSerifText style={styles.backLink}>
              ← Back to sign in
            </SansSerifText>
          </Pressable>
        </CardFooter>
      )}
    </Card>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
    },
    embeddedContainer: {
      width: "100%",
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.md,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    content: {
      gap: spacing.md,
    },
    inputGroup: {
      width: "100%",
    },
    errorContainer: {
      backgroundColor: theme.colors.destructive + "15",
      borderRadius: spacing.radiusSm,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.destructive,
    },
    errorText: {
      color: theme.colors.destructive,
      fontSize: 14,
      textAlign: "center",
    },
    requirements: {
      paddingHorizontal: spacing.xs,
    },
    requirementsText: {
      color: theme.colors.textDim,
      fontSize: 13,
    },
    footer: {
      justifyContent: "center",
    },
    backLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default ResetPasswordForm;
