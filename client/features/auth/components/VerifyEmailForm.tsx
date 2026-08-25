import React, { useCallback, useRef, useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { AuthTextField, type AuthTextFieldHandle } from "./AuthTextField";
import { AuthFormCard } from "./AuthFormCard";
import { authFormStyles } from "./authFormStyles";

export interface VerifyEmailFormProps {
  email: string;
  onVerify?: (code: string) => void | Promise<void>;
  onResendCode?: () => void | Promise<void>;
  onBack?: () => void;
  onChangeEmail?: () => void;
  loading?: boolean;
  resending?: boolean;
  error?: string;
  codeLength?: number;
  title?: string;
  description?: string;
  resendCooldown?: number;
  /** Logo element rendered centered above the card */
  logo?: React.ReactNode;
  /** Set to true when form is embedded in a parent scroll view */
  embedded?: boolean;
}

export function VerifyEmailForm({
  email,
  onVerify,
  onResendCode,
  onBack,
  onChangeEmail,
  loading = false,
  resending = false,
  error,
  codeLength = 6,
  // No default: `title` must stay undefined so the i18n fallback below applies.
  title,
  description,
  resendCooldown = 60,
  logo,
  embedded = false,
}: VerifyEmailFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const shared = authFormStyles(theme);
  const styles = themedStyles(theme);

  const codeRef = useRef<AuthTextFieldHandle>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const normalizeCode = useCallback(
    (value: string) => value.replace(/[^0-9]/g, "").slice(0, codeLength),
    [codeLength],
  );

  const validateCode = useCallback((value: string): string => {
    if (value.length !== codeLength) {
      return t("auth.enterAllDigits", { count: codeLength });
    }
    if (!/^\d+$/.test(value)) {
      return t("auth.codeDigitsOnly");
    }
    return "";
  }, [codeLength, t]);

  const handleSubmit = useCallback(async () => {
    if (codeRef.current?.validate()) {
      const code = codeRef.current.getValue();
      await onVerify?.(code);
    }
  }, [onVerify]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    await onResendCode?.();
    setCooldown(resendCooldown);
  };

  return (
    <AuthFormCard
      embedded={embedded}
      error={error}
      logo={logo}
      title={title ?? t("auth.verifyEmailTitle")}
      description={description ?? t("auth.verifyEmailDescription", { email })}
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
      {/* Simple visible input */}
      <AuthTextField
        ref={codeRef}
        testID="verify-email-code-input"
        label={t("auth.verificationCode")}
        placeholder={t("auth.enterDigitCode", { count: codeLength })}
        normalize={normalizeCode}
        validateValue={validateCode}
        keyboardType="number-pad"
        maxLength={codeLength}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={!loading}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <Button
        testID="verify-email-submit-button"
        preset="default"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        fullWidth
      >
        <SansSerifBoldText>{t("auth.verifyEmailButton")}</SansSerifBoldText>
      </Button>

      <View style={styles.resendRow}>
        <SansSerifText style={shared.mutedText}>
          {t("auth.didntReceiveCode")}{" "}
        </SansSerifText>
        {cooldown > 0 ? (
          <SansSerifText style={shared.mutedText}>
            {t("auth.resendIn", { count: cooldown })}
          </SansSerifText>
        ) : (
          <Pressable onPress={handleResend} disabled={loading || resending}>
            <SansSerifBoldText style={shared.linkText}>
              {resending ? t("auth.sending") : t("auth.resendCodeLink")}
            </SansSerifBoldText>
          </Pressable>
        )}
      </View>

      {onChangeEmail && (
        <Pressable onPress={onChangeEmail} disabled={loading} style={styles.changeEmail}>
          <SansSerifText style={shared.hintText}>
            {t("auth.wrongEmail")} <SansSerifBoldText style={styles.changeEmailLink}>{t("auth.changeIt")}</SansSerifBoldText>
          </SansSerifText>
        </Pressable>
      )}
    </AuthFormCard>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    resendRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    changeEmail: {
      alignSelf: "center",
    },
    /** Inherits the 13px size from the surrounding hint text. */
    changeEmailLink: {
      color: theme.colors.primary,
    },
  });

const themedStyles = createThemedStyles(createStyles);

export default VerifyEmailForm;
