import React, { useCallback, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";
import { AuthFormCard } from "./AuthFormCard";
import { authFormStyles } from "./authFormStyles";
import { getSocialLabel, validateEmail, validatePassword } from "./validators";

const MIN_PASSWORD_LENGTH = 6;

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
  const shared = authFormStyles(theme);

  const emailRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);

  const emailValidator = useCallback((value: string) => validateEmail(value, t), [t]);
  const passwordValidator = useCallback(
    (value: string) => validatePassword(value, t, MIN_PASSWORD_LENGTH),
    [t],
  );

  const handleSubmit = useCallback(async () => {
    const isEmailValid = emailRef.current?.validate() ?? false;
    const isPasswordValid = passwordRef.current?.validate() ?? false;
    if (isEmailValid && isPasswordValid) {
      const email = emailRef.current?.getValue() ?? "";
      const password = passwordRef.current?.getValue() ?? "";
      await onSignIn?.({ email, password });
    }
  }, [onSignIn]);

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.signInTitle")}
      description={description ?? t("auth.signInDescription")}
      footer={
        onSignUp && (
          <>
            <SansSerifText style={shared.mutedText}>
              {t("auth.noAccount")}{" "}
            </SansSerifText>
            <Pressable onPress={onSignUp} disabled={loading}>
              <SansSerifBoldText style={shared.linkText}>
                {t("auth.signUp")}
              </SansSerifBoldText>
            </Pressable>
          </>
        )
      }
    >
      <View style={shared.inputGroup}>
        <AuthTextField
          ref={emailRef}
          testID="sign-in-email-input"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          validateValue={emailValidator}
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

      <View style={shared.inputGroup}>
        <AuthTextField
          ref={passwordRef}
          testID="sign-in-password-input"
          label={t("auth.password")}
          placeholder={t("auth.passwordPlaceholder")}
          validateValue={passwordValidator}
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
          <SansSerifText style={shared.linkText}>
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
          <View style={shared.separatorRow}>
            <View style={shared.separatorLine} />
            <SansSerifText style={shared.hintText}>{t("auth.or")}</SansSerifText>
            <View style={shared.separatorLine} />
          </View>

          <View style={shared.socialButtons}>
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                preset="outline"
                onPress={() => onSocialSignIn?.(provider)}
                disabled={loading}
                fullWidth
              >
                <SansSerifText>{getSocialLabel(provider, t)}</SansSerifText>
              </Button>
            ))}
          </View>
        </>
      )}
    </AuthFormCard>
  );
}

/** Theme-independent, so a plain module-scope sheet is enough. */
const styles = StyleSheet.create({
  forgotPassword: {
    alignSelf: "flex-end",
    paddingVertical: spacing.xs,
  },
});

export default SignInForm;
