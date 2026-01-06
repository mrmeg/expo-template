import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
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

export interface ForgotPasswordFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  onBack?: () => void;
  loading?: boolean;
  error?: string;
  success?: boolean;
  title?: string;
  description?: string;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function ForgotPasswordForm({
  onSubmit,
  onBack,
  loading = false,
  error,
  success = false,
  title = "Forgot password?",
  description = "Enter your email address and we'll send you a link to reset your password.",
  embedded = false,
}: ForgotPasswordFormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async () => {
    if (validateEmail(email)) {
      await onSubmit?.(email);
    }
  };

  const wrapContent = (content: React.ReactNode) => {
    if (embedded) {
      return <View style={styles.embeddedContainer}>{content}</View>;
    }
    return (
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        {content}
      </KeyboardAwareScrollView>
    );
  };

  if (success) {
    return wrapContent(
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We've sent a password reset link to {email}. Please check your inbox and follow the instructions.
          </CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          <View style={styles.successContainer}>
            <SansSerifText style={styles.successText}>
              Didn't receive the email? Check your spam folder or try again.
            </SansSerifText>
          </View>

          <Button
            preset="outline"
            onPress={() => {
              setEmail("");
              onBack?.();
            }}
            fullWidth
          >
            <SansSerifBoldText>Back to sign in</SansSerifBoldText>
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
            label="Email"
            placeholder="name@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) validateEmail(text);
            }}
            onBlur={() => validateEmail(email)}
            error={!!emailError}
            errorText={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loading}
            required
          />
        </View>

        <Button
          preset="default"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
        >
          <SansSerifBoldText>Send Reset Link</SansSerifBoldText>
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
    successContainer: {
      backgroundColor: theme.colors.success + "15",
      borderRadius: spacing.radiusSm,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    successText: {
      color: theme.colors.foreground,
      fontSize: 14,
      textAlign: "center",
    },
    footer: {
      justifyContent: "center",
    },
    backLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default ForgotPasswordForm;
