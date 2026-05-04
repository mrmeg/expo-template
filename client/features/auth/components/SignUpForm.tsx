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

export interface SignUpFormProps {
  onSignUp?: (data: { name: string; email: string; password: string }) => void | Promise<void>;
  onSignIn?: () => void;
  onSocialSignUp?: (provider: "google" | "apple" | "github") => void;
  loading?: boolean;
  error?: string;
  socialProviders?: ("google" | "apple" | "github")[];
  title?: string;
  description?: string;
  requireName?: boolean;
  /** Logo element rendered centered above the card */
  logo?: React.ReactNode;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function SignUpForm({
  onSignUp,
  onSignIn,
  onSocialSignUp,
  loading = false,
  error,
  socialProviders = ["google", "apple"],
  title,
  description,
  requireName = true,
  logo,
  embedded = false,
}: SignUpFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedTitle = title ?? t("auth.signUpTitle");
  const resolvedDescription = description ?? t("auth.signUpDescription");

  const nameRef = useRef<AuthTextFieldHandle>(null);
  const emailRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);
  const confirmPasswordRef = useRef<AuthTextFieldHandle>(null);

  const validateName = useCallback((value: string): string => {
    if (!requireName) {
      return "";
    }
    if (!value.trim()) {
      return t("errors.nameRequired");
    }
    if (value.trim().length < 2) {
      return t("errors.nameTooShort");
    }
    return "";
  }, [requireName, t]);

  const validateEmail = useCallback((value: string): string => {
    if (!value.trim()) {
      return t("errors.emailRequired");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return t("errors.invalidEmail");
    }
    return "";
  }, [t]);

  const validatePassword = useCallback((value: string): string => {
    if (!value) {
      return t("errors.passwordRequired");
    }
    if (value.length < 8) {
      return t("errors.passwordMinLength", { count: 8 });
    }
    return "";
  }, [t]);

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
    const isNameValid = !requireName || (nameRef.current?.validate() ?? false);
    const isEmailValid = emailRef.current?.validate() ?? false;
    const isPasswordValid = passwordRef.current?.validate() ?? false;
    const isConfirmPasswordValid = confirmPasswordRef.current?.validate() ?? false;
    if (isNameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
      const name = nameRef.current?.getValue() ?? "";
      const email = emailRef.current?.getValue() ?? "";
      const password = passwordRef.current?.getValue() ?? "";
      await onSignUp?.({ name: name.trim(), email, password });
    }
  }, [onSignUp, requireName]);

  const getSocialLabel = (provider: string): string => {
    switch (provider) {
    case "google":
      return t("auth.continueWithGoogle");
    case "apple":
      return t("auth.continueWithApple");
    case "github":
      return t("auth.continueWithGithub");
    default:
      return t("auth.continueWith", { provider });
    }
  };

  const formContent = (
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

          {requireName && (
            <View style={styles.inputGroup}>
              <AuthTextField
                ref={nameRef}
                testID="sign-up-name-input"
                label={t("auth.name")}
                placeholder={t("auth.namePlaceholder")}
                validateValue={validateName}
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                editable={!loading}
                required
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <AuthTextField
              ref={emailRef}
              testID="sign-up-email-input"
              label={t("auth.email")}
              placeholder={t("auth.emailPlaceholder")}
              validateValue={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
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
              testID="sign-up-password-input"
              label={t("auth.password")}
              placeholder={t("auth.createPasswordPlaceholder")}
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
              testID="sign-up-confirm-password-input"
              label={t("auth.confirmPassword")}
              placeholder={t("auth.confirmPasswordPlaceholder")}
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

          <Button
            testID="sign-up-submit-button"
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            <SansSerifBoldText>{t("auth.createAccountButton")}</SansSerifBoldText>
          </Button>

          {socialProviders.length > 0 && (
            <>
              <View style={styles.separatorContainer}>
                <View style={styles.separatorLine} />
                <SansSerifText style={styles.separatorText}>{t("auth.or")}</SansSerifText>
                <View style={styles.separatorLine} />
              </View>

              <View style={styles.socialContainer}>
                {socialProviders.map((provider) => (
                  <Button
                    key={provider}
                    preset="outline"
                    onPress={() => onSocialSignUp?.(provider)}
                    disabled={loading}
                    fullWidth
                  >
                    <SansSerifText>{getSocialLabel(provider)}</SansSerifText>
                  </Button>
                ))}
              </View>
            </>
          )}
        </CardContent>

        {onSignIn && (
          <CardFooter style={styles.footer}>
            <SansSerifText style={styles.footerText}>
              {t("auth.hasAccount")}{" "}
            </SansSerifText>
            <Pressable onPress={onSignIn} disabled={loading}>
              <SansSerifBoldText style={styles.signInLink}>
                {t("auth.signIn")}
              </SansSerifBoldText>
            </Pressable>
          </CardFooter>
        )}
      </Card>
    </View>
  );

  if (embedded) {
    return <View style={styles.embeddedContainer}>{formContent}</View>;
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
        {formContent}
      </ScrollView>
    </KeyboardAvoidingView>
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
    separatorContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: spacing.sm,
      gap: spacing.md,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    separatorText: {
      color: theme.colors.textDim,
      fontSize: 13,
    },
    socialContainer: {
      gap: spacing.sm,
    },
    footer: {
      justifyContent: "center",
    },
    footerText: {
      color: theme.colors.textDim,
      fontSize: 14,
    },
    signInLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default SignUpForm;
