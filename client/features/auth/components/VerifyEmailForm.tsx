import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
  title = "Verify your email",
  description,
  resendCooldown = 60,
  logo,
  embedded = false,
}: VerifyEmailFormProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const codeRef = useRef<AuthTextFieldHandle>(null);
  const [cooldown, setCooldown] = useState(0);

  const resolvedTitle = title ?? t("auth.verifyEmailTitle");
  const defaultDescription = description || t("auth.verifyEmailDescription", { email });

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
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

  const formContent = (
    <View style={styles.formWrapper}>
      {logo && <View style={styles.logoContainer}>{logo}</View>}
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>{resolvedTitle}</CardTitle>
          <CardDescription>{defaultDescription}</CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          {!!error && (
            <View style={styles.errorContainer}>
              <SansSerifText style={styles.errorText}>{error}</SansSerifText>
            </View>
          )}

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

          <View style={styles.resendContainer}>
            <SansSerifText style={styles.resendText}>
              {t("auth.didntReceiveCode")}{" "}
            </SansSerifText>
            {cooldown > 0 ? (
              <SansSerifText style={styles.cooldownText}>
                {t("auth.resendIn", { count: cooldown })}
              </SansSerifText>
            ) : (
              <Pressable onPress={handleResend} disabled={loading || resending}>
                <SansSerifBoldText style={styles.resendLink}>
                  {resending ? t("auth.sending") : t("auth.resendCodeLink")}
                </SansSerifBoldText>
              </Pressable>
            )}
          </View>

          {onChangeEmail && (
            <Pressable onPress={onChangeEmail} disabled={loading} style={styles.changeEmail}>
              <SansSerifText style={styles.changeEmailText}>
                {t("auth.wrongEmail")} <SansSerifBoldText style={styles.changeEmailLink}>{t("auth.changeIt")}</SansSerifBoldText>
              </SansSerifText>
            </Pressable>
          )}
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
    resendContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    resendText: {
      color: theme.colors.textDim,
      fontSize: 14,
    },
    resendLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    cooldownText: {
      color: theme.colors.textDim,
      fontSize: 14,
    },
    changeEmail: {
      alignSelf: "center",
    },
    changeEmailText: {
      color: theme.colors.textDim,
      fontSize: 13,
    },
    changeEmailLink: {
      color: theme.colors.primary,
    },
    footer: {
      justifyContent: "center",
    },
    backLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default VerifyEmailForm;
