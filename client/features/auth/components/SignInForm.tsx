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

export interface SignInFormProps {
  onSignIn?: (data: { email: string; password: string }) => void | Promise<void>;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  onSocialSignIn?: (provider: "google" | "apple" | "github") => void;
  loading?: boolean;
  error?: string;
  socialProviders?: ("google" | "apple" | "github")[];
  title?: string;
  description?: string;
  /** Logo element rendered centered above the card */
  logo?: React.ReactNode;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function SignInForm({
  onSignIn,
  onForgotPassword,
  onSignUp,
  onSocialSignIn,
  loading = false,
  error,
  socialProviders = ["google", "apple"],
  title,
  description,
  logo,
  embedded = false,
}: SignInFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedTitle = title ?? t("auth.signInTitle");
  const resolvedDescription = description ?? t("auth.signInDescription");

  const emailRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);

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
    if (value.length < 6) {
      return t("errors.passwordMinLength", { count: 6 });
    }
    return "";
  }, [t]);

  const handleSubmit = useCallback(async () => {
    const isEmailValid = emailRef.current?.validate() ?? false;
    const isPasswordValid = passwordRef.current?.validate() ?? false;
    if (isEmailValid && isPasswordValid) {
      const email = emailRef.current?.getValue() ?? "";
      const password = passwordRef.current?.getValue() ?? "";
      await onSignIn?.({ email, password });
    }
  }, [onSignIn]);

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

          <View style={styles.inputGroup}>
            <AuthTextField
              ref={emailRef}
              testID="sign-in-email-input"
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
              testID="sign-in-password-input"
              label={t("auth.password")}
              placeholder={t("auth.passwordPlaceholder")}
              validateValue={validatePassword}
              secureTextEntry
              showSecureEntryToggle
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
              required
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {onForgotPassword && (
            <Pressable
              onPress={onForgotPassword}
              disabled={loading}
              style={styles.forgotPassword}
            >
              <SansSerifText style={styles.forgotPasswordText}>
                {t("auth.forgotPassword")}
              </SansSerifText>
            </Pressable>
          )}

          <Button
            testID="sign-in-submit-button"
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            <SansSerifBoldText>{t("auth.signIn")}</SansSerifBoldText>
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
                    onPress={() => onSocialSignIn?.(provider)}
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

        {onSignUp && (
          <CardFooter style={styles.footer}>
            <SansSerifText style={styles.footerText}>
              {t("auth.noAccount")}{" "}
            </SansSerifText>
            <Pressable onPress={onSignUp} disabled={loading}>
              <SansSerifBoldText style={styles.signUpLink}>
                {t("auth.signUp")}
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
    forgotPassword: {
      alignSelf: "flex-end",
      paddingVertical: spacing.xs,
    },
    forgotPasswordText: {
      color: theme.colors.primary,
      fontSize: 14,
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
    signUpLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default SignInForm;
