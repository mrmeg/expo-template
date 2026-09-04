import React, { useCallback, useRef, useState } from "react";
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
  /**
   * Passwordless path: send a one-time code to the address entered above.
   * Providing it makes the form lead with the code layout and hide the password
   * field behind a "use password instead" toggle; without it the form is
   * password-only, which is what the showcase and template blocks render.
   */
  onEmailCodeSignIn?: (data: { email: string }) => void | Promise<void>;
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
  onEmailCodeSignIn,
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

  /**
   * Which credential the form is collecting. Email-code is the default when the
   * caller supports it — the code path needs no password rules and works for
   * users who never set one — and the toggle below switches to the password
   * field without leaving the screen.
   */
  const [usePassword, setUsePassword] = useState(!onEmailCodeSignIn);

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

  const handleEmailCodeSubmit = useCallback(async () => {
    if (emailRef.current?.validate()) {
      await onEmailCodeSignIn?.({ email: emailRef.current.getValue() });
    }
  }, [onEmailCodeSignIn]);

  const showPasswordField = usePassword || !onEmailCodeSignIn;

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.signInTitle")}
      description={
        description ??
        (showPasswordField ? t("auth.signInDescription") : t("auth.signInWithCodeDescription"))
      }
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
          returnKeyType={showPasswordField ? "next" : "go"}
          blurOnSubmit={!showPasswordField}
          onSubmitEditing={
            showPasswordField ? () => passwordRef.current?.focus() : handleEmailCodeSubmit
          }
        />
      </View>

      {showPasswordField && (
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
      )}

      {showPasswordField && onForgotPassword && (
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

      {showPasswordField ? (
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
      ) : (
        <Button
          testID="sign-in-email-code-button"
          preset="default"
          onPress={handleEmailCodeSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
        >
          <SansSerifBoldText>{t("auth.emailMeACode")}</SansSerifBoldText>
        </Button>
      )}

      {onEmailCodeSignIn && (
        <Pressable
          testID={usePassword ? "sign-in-use-code-button" : "sign-in-use-password-button"}
          onPress={() => setUsePassword((current) => !current)}
          disabled={loading}
          style={styles.methodToggle}
        >
          <SansSerifText style={shared.linkText}>
            {usePassword ? t("auth.useEmailCodeInstead") : t("auth.usePasswordInstead")}
          </SansSerifText>
        </Pressable>
      )}

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
                testID={`sign-in-social-${provider}-button`}
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
  methodToggle: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
  },
});

export default SignInForm;
