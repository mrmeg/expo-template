import React, { useState, useRef } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, ScrollView, Platform, TextInput as RNTextInput } from "react-native";
import { useTranslation } from "react-i18next";
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
  const styles = createStyles(theme);

  const resolvedTitle = title ?? t("auth.resetYourPassword");
  const resolvedDescription = description ?? t("auth.resetYourPasswordDescription");

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const passwordRef = useRef<RNTextInput>(null);
  const confirmPasswordRef = useRef<RNTextInput>(null);

  const validateCode = (value: string): boolean => {
    if (!value) {
      setCodeError(t("errors.codeRequired"));
      return false;
    }
    setCodeError("");
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError(t("errors.passwordRequired"));
      return false;
    }
    if (value.length < minPasswordLength) {
      setPasswordError(t("errors.passwordMinLength", { count: minPasswordLength }));
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateConfirmPassword = (value: string): boolean => {
    if (!value) {
      setConfirmPasswordError(t("errors.confirmPasswordRequired"));
      return false;
    }
    if (value !== password) {
      setConfirmPasswordError(t("errors.passwordMismatch"));
      return false;
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleSubmit = async () => {
    const isCodeValid = validateCode(code);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);
    if (isCodeValid && isPasswordValid && isConfirmPasswordValid) {
      await onSubmit?.({ code, newPassword: password });
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
            <TextInput
              label={t("auth.verificationCode")}
              placeholder={t("auth.verificationCodePlaceholder")}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (codeError) validateCode(text);
              }}
              onBlur={() => validateCode(code)}
              error={!!codeError}
              errorText={codeError}
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
            <TextInput
              ref={passwordRef}
              label={t("auth.newPassword")}
              placeholder={t("auth.newPasswordPlaceholder")}
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
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              ref={confirmPasswordRef}
              label={t("auth.confirmNewPassword")}
              placeholder={t("auth.confirmNewPasswordPlaceholder")}
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
