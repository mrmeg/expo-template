import React, { useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@mrmeg/expo-ui/components/Card";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";

export interface ResetPasswordFormProps {
  onSubmit?: (params: { code: string; newPassword: string }) => void | Promise<void>;
  onBack?: () => void;
  loading?: boolean;
  error?: string;
  success?: boolean;
  title?: string;
  description?: string;
  minPasswordLength?: number;
  /** Logo element rendered centered above the card */
  logo?: React.ReactNode;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function ResetPasswordForm({
  onSubmit,
  onBack,
  loading = false,
  error,
  success = false,
  title,
  description,
  minPasswordLength = 8,
  logo,
  embedded = false,
}: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedTitle = title ?? t("auth.resetYourPassword");
  const resolvedDescription = description ?? t("auth.resetYourPasswordDescription");

  const codeRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);
  const confirmPasswordRef = useRef<AuthTextFieldHandle>(null);

  const validateCode = useCallback((value: string): string => {
    if (!value) {
      return t("errors.codeRequired");
    }
    return "";
  }, [t]);

  const validatePassword = useCallback((value: string): string => {
    if (!value) {
      return t("errors.passwordRequired");
    }
    if (value.length < minPasswordLength) {
      return t("errors.passwordMinLength", { count: minPasswordLength });
    }
    return "";
  }, [minPasswordLength, t]);

  const validateConfirmPassword = useCallback((value: string): string => {
    if (!value) {
      return t("errors.confirmPasswordRequired");
    }
    if (value !== passwordRef.current?.getValue()) {
      return t("errors.passwordMismatch");
    }
    return "";
  }, [t]);

  const handleSubmit = useCallback(async () => {
    const isCodeValid = codeRef.current?.validate() ?? false;
    const isPasswordValid = passwordRef.current?.validate() ?? false;
    const isConfirmPasswordValid = confirmPasswordRef.current?.validate() ?? false;
    if (isCodeValid && isPasswordValid && isConfirmPasswordValid) {
      const code = codeRef.current?.getValue() ?? "";
      const password = passwordRef.current?.getValue() ?? "";
      await onSubmit?.({ code, newPassword: password });
    }
  }, [onSubmit]);

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
      <View style={styles.formWrapper}>
        {logo && <View style={styles.logoContainer}>{logo}</View>}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>{t("auth.passwordResetSuccess")}</CardTitle>
            <CardDescription>
              {t("auth.passwordResetSuccessDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent style={styles.content}>
            <Button
              preset="default"
              onPress={onBack}
              fullWidth
            >
              <SansSerifBoldText>{t("auth.signIn")}</SansSerifBoldText>
            </Button>
          </CardContent>
        </Card>
      </View>
    );
  }

  return wrapContent(
    <View style={styles.formWrapper}>
      {logo && <View style={styles.logoContainer}>{logo}</View>}
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription>{resolvedDescription}</CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          {!!error && (
            <View style={styles.errorContainer}>
              <SansSerifText style={styles.errorText}>{error}</SansSerifText>
            </View>
          )}

          <View style={styles.inputGroup}>
            <AuthTextField
              ref={codeRef}
              testID="reset-password-code-input"
              label={t("auth.verificationCode")}
              placeholder={t("auth.verificationCodePlaceholder")}
              validateValue={validateCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              editable={!loading}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.inputGroup}>
            <AuthTextField
              ref={passwordRef}
              testID="reset-password-password-input"
              label={t("auth.newPassword")}
              placeholder={t("auth.newPasswordPlaceholder")}
              validateValue={validatePassword}
              onValueChange={() => {
                if (confirmPasswordRef.current?.getValue() && confirmPasswordRef.current.hasError()) {
                  confirmPasswordRef.current.validate();
                }
              }}
              secureTextEntry
              showSecureEntryToggle
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!loading}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
          </View>

          <View style={styles.inputGroup}>
            <AuthTextField
              ref={confirmPasswordRef}
              testID="reset-password-confirm-password-input"
              label={t("auth.confirmNewPassword")}
              placeholder={t("auth.confirmNewPasswordPlaceholder")}
              validateValue={validateConfirmPassword}
              secureTextEntry
              showSecureEntryToggle
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!loading}
              required
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <View style={styles.requirements}>
            <SansSerifText style={styles.requirementsText}>
              {t("auth.passwordMinLength", { count: minPasswordLength })}
            </SansSerifText>
          </View>

          <Button
            testID="reset-password-submit-button"
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            <SansSerifBoldText>{t("auth.resetPasswordButton")}</SansSerifBoldText>
          </Button>
        </CardContent>

        {onBack && (
          <CardFooter style={styles.footer}>
            <Pressable onPress={onBack} disabled={loading}>
              <SansSerifText style={styles.backLink}>
                {t("auth.backToSignIn")}
              </SansSerifText>
            </Pressable>
          </CardFooter>
        )}
      </Card>
    </View>
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
    },
    formWrapper: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: spacing.lg,
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
