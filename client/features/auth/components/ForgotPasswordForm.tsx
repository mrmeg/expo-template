import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme, withAlpha } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";
import { AuthFormCard } from "./AuthFormCard";
import { authFormStyles } from "./authFormStyles";
import { validateEmail } from "./validators";

export interface ForgotPasswordFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  onBack?: () => void;
  loading?: boolean;
  error?: string;
  success?: boolean;
  title?: string;
  description?: string;
  /** Logo element rendered centered above the card */
  logo?: React.ReactNode;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function ForgotPasswordForm({
  onSubmit,
  onBack,
  loading = false,
  error,
  success = false,
  title,
  description,
  logo,
  embedded = false,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const shared = authFormStyles(theme);
  const styles = themedStyles(theme);

  const emailRef = useRef<AuthTextFieldHandle>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const emailValidator = useCallback((value: string) => validateEmail(value, t), [t]);

  const handleSubmit = useCallback(async () => {
    if (emailRef.current?.validate()) {
      const email = emailRef.current.getValue();
      setSubmittedEmail(email);
      await onSubmit?.(email);
    }
  }, [onSubmit]);

  if (success) {
    return (
      <AuthFormCard
        embedded={embedded}
        logo={logo}
        title={t("auth.checkYourEmail")}
        description={t("auth.resetLinkSentDescription", { email: submittedEmail })}
      >
        <View style={styles.successContainer}>
          <SansSerifText style={styles.successText}>
            {t("auth.didntReceiveEmail")}
          </SansSerifText>
        </View>

        <Button
          preset="outline"
          onPress={() => {
            emailRef.current?.setValue("");
            onBack?.();
          }}
          fullWidth
        >
          <SansSerifBoldText>{t("auth.backToSignIn")}</SansSerifBoldText>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.forgotPasswordTitle")}
      description={description ?? t("auth.forgotPasswordDescription")}
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
          ref={emailRef}
          testID="forgot-password-email-input"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          validateValue={emailValidator}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!loading}
          required
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <Button
        testID="forgot-password-submit-button"
        preset="default"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        fullWidth
      >
        <SansSerifBoldText>{t("auth.sendResetLink")}</SansSerifBoldText>
      </Button>
    </AuthFormCard>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    successContainer: {
      backgroundColor: withAlpha(theme.colors.success, 0.08),
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
  });

const themedStyles = createThemedStyles(createStyles);

export default ForgotPasswordForm;
