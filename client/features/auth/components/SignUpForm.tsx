import React, { useCallback, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";
import { AuthFormCard } from "./AuthFormCard";
import { authFormStyles } from "./authFormStyles";
import {
  getSocialLabel,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
} from "./validators";

const MIN_PASSWORD_LENGTH = 8;

export interface SignUpFormProps {
  onSignUp?: (data: { name: string; email: string; password: string }) => void | Promise<void>;
  /**
   * Passwordless path: create the account with no password at all — the emailed
   * confirmation code finishes sign-up and the user signs in with email codes
   * afterwards. Providing it makes the form lead with the email-only layout and
   * hide the password + confirm fields behind an "Add a password" toggle;
   * without it the form is password-first, which is what the showcase and
   * template blocks render.
   */
  onPasswordlessSignUp?: (data: { name: string; email: string }) => void | Promise<void>;
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
  onPasswordlessSignUp,
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
  const shared = authFormStyles(theme);

  const nameRef = useRef<AuthTextFieldHandle>(null);
  const emailRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);
  const confirmPasswordRef = useRef<AuthTextFieldHandle>(null);

  /**
   * Whether the account being created gets a password. Passwordless is the
   * default when the caller supports it — there are no password rules to satisfy
   * and email codes work for accounts that never set one — and the toggle below
   * reveals the password fields without leaving the screen.
   */
  const [usePassword, setUsePassword] = useState(!onPasswordlessSignUp);
  const showPasswordFields = usePassword || !onPasswordlessSignUp;

  const nameValidator = useCallback((value: string): string => {
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

  const emailValidator = useCallback((value: string) => validateEmail(value, t), [t]);
  const passwordValidator = useCallback(
    (value: string) => validatePassword(value, t, MIN_PASSWORD_LENGTH),
    [t],
  );
  const confirmPasswordValidator = useCallback(
    (value: string) => validateConfirmPassword(value, t, passwordRef.current?.getValue()),
    [t],
  );

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

  const handlePasswordlessSubmit = useCallback(async () => {
    const isNameValid = !requireName || (nameRef.current?.validate() ?? false);
    const isEmailValid = emailRef.current?.validate() ?? false;
    if (isNameValid && isEmailValid) {
      const name = nameRef.current?.getValue() ?? "";
      await onPasswordlessSignUp?.({
        name: name.trim(),
        email: emailRef.current?.getValue() ?? "",
      });
    }
  }, [onPasswordlessSignUp, requireName]);

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.signUpTitle")}
      description={
        description ??
        (showPasswordFields
          ? t("auth.signUpDescription")
          : t("auth.signUpWithoutPasswordDescription"))
      }
      footer={
        onSignIn && (
          <>
            <SansSerifText style={shared.mutedText}>
              {t("auth.hasAccount")}{" "}
            </SansSerifText>
            <Pressable onPress={onSignIn} disabled={loading}>
              <SansSerifBoldText style={shared.linkText}>
                {t("auth.signIn")}
              </SansSerifBoldText>
            </Pressable>
          </>
        )
      }
    >
      {requireName && (
        <View style={shared.inputGroup}>
          <AuthTextField
            ref={nameRef}
            testID="sign-up-name-input"
            label={t("auth.name")}
            placeholder={t("auth.namePlaceholder")}
            validateValue={nameValidator}
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

      <View style={shared.inputGroup}>
        <AuthTextField
          ref={emailRef}
          testID="sign-up-email-input"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          validateValue={emailValidator}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!loading}
          required
          returnKeyType={showPasswordFields ? "next" : "go"}
          blurOnSubmit={!showPasswordFields}
          onSubmitEditing={
            showPasswordFields
              ? () => passwordRef.current?.focus()
              : handlePasswordlessSubmit
          }
        />
      </View>

      {showPasswordFields && (
        <>
          <View style={shared.inputGroup}>
            <AuthTextField
              ref={passwordRef}
              testID="sign-up-password-input"
              label={t("auth.password")}
              placeholder={t("auth.createPasswordPlaceholder")}
              validateValue={passwordValidator}
              onValueChange={() => {
                if (
                  confirmPasswordRef.current?.getValue()
                  && confirmPasswordRef.current.hasError()
                ) {
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

          <View style={shared.inputGroup}>
            <AuthTextField
              ref={confirmPasswordRef}
              testID="sign-up-confirm-password-input"
              label={t("auth.confirmPassword")}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              validateValue={confirmPasswordValidator}
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
        </>
      )}

      {showPasswordFields ? (
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
      ) : (
        <Button
          testID="sign-up-passwordless-button"
          preset="default"
          onPress={handlePasswordlessSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
        >
          <SansSerifBoldText>{t("auth.signUpWithoutPassword")}</SansSerifBoldText>
        </Button>
      )}

      {onPasswordlessSignUp && (
        <Pressable
          testID={
            usePassword ? "sign-up-use-passwordless-button" : "sign-up-add-password-button"
          }
          onPress={() => setUsePassword((current) => !current)}
          disabled={loading}
          style={styles.methodToggle}
        >
          <SansSerifText style={shared.linkText}>
            {usePassword ? t("auth.signUpWithoutPasswordInstead") : t("auth.addAPassword")}
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
                preset="outline"
                onPress={() => onSocialSignUp?.(provider)}
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
  methodToggle: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
  },
});

export default SignUpForm;
