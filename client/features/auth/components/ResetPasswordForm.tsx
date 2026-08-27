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
import { validateConfirmPassword, validatePassword } from "./validators";

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
  const shared = authFormStyles(theme);

  const codeRef = useRef<AuthTextFieldHandle>(null);
  const passwordRef = useRef<AuthTextFieldHandle>(null);
  const confirmPasswordRef = useRef<AuthTextFieldHandle>(null);

  const validateCode = useCallback((value: string): string => {
    if (!value) {
      return t("errors.codeRequired");
    }
    return "";
  }, [t]);

  const passwordValidator = useCallback(
    (value: string) => validatePassword(value, t, minPasswordLength),
    [minPasswordLength, t],
  );
  const confirmPasswordValidator = useCallback(
    (value: string) => validateConfirmPassword(value, t, passwordRef.current?.getValue()),
    [t],
  );

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

  if (success) {
    return (
      <AuthFormCard
        embedded={embedded}
        logo={logo}
        title={t("auth.passwordResetSuccess")}
        description={t("auth.passwordResetSuccessDescription")}
      >
        <Button
          preset="default"
          onPress={onBack}
          fullWidth
        >
          <SansSerifBoldText>{t("auth.signIn")}</SansSerifBoldText>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.resetYourPassword")}
      description={description ?? t("auth.resetYourPasswordDescription")}
      footer={
        onBack && (
          <Pressable onPress={onBack} disabled={loading}>
            <SansSerifText style={shared.linkText}>
              {t("auth.backToSignIn")}
            </SansSerifText>
          </Pressable>
        )
      }
    >
      <View style={shared.inputGroup}>
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

      <View style={shared.inputGroup}>
        <AuthTextField
          ref={passwordRef}
          testID="reset-password-password-input"
          label={t("auth.newPassword")}
          placeholder={t("auth.newPasswordPlaceholder")}
          validateValue={passwordValidator}
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

      <View style={shared.inputGroup}>
        <AuthTextField
          ref={confirmPasswordRef}
          testID="reset-password-confirm-password-input"
          label={t("auth.confirmNewPassword")}
          placeholder={t("auth.confirmNewPasswordPlaceholder")}
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

      <View style={styles.requirements}>
        <SansSerifText style={shared.hintText}>
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
    </AuthFormCard>
  );
}

/** Theme-independent, so a plain module-scope sheet is enough. */
const styles = StyleSheet.create({
  requirements: {
    paddingHorizontal: spacing.xs,
  },
});

export default ResetPasswordForm;
