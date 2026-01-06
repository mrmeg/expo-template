import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
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
  embedded = false,
}: VerifyEmailFormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const defaultDescription = description || `We sent a verification code to ${email}. Enter the code below to verify your email address.`;

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const validateCode = (): boolean => {
    if (code.length !== codeLength) {
      setCodeError(`Please enter all ${codeLength} digits`);
      return false;
    }
    if (!/^\d+$/.test(code)) {
      setCodeError("Code must contain only numbers");
      return false;
    }
    setCodeError("");
    return true;
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, limit to codeLength
    const digits = value.replace(/[^0-9]/g, "").slice(0, codeLength);
    setCode(digits);

    if (codeError) {
      setCodeError("");
    }
  };

  const handleSubmit = async () => {
    if (validateCode()) {
      await onVerify?.(code);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await onResendCode?.();
    setCooldown(resendCooldown);
  };

  const formContent = (
    <Card style={styles.card}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{defaultDescription}</CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          {error && (
            <View style={styles.errorContainer}>
              <SansSerifText style={styles.errorText}>{error}</SansSerifText>
            </View>
          )}

          {/* Simple visible input */}
          <TextInput
            label="Verification Code"
            placeholder="Enter 6-digit code"
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={codeLength}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            editable={!loading}
            error={!!codeError}
            errorText={codeError}
          />

          <Button
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || code.length !== codeLength}
            fullWidth
          >
            <SansSerifBoldText>Verify Email</SansSerifBoldText>
          </Button>

          <View style={styles.resendContainer}>
            <SansSerifText style={styles.resendText}>
              Didn't receive the code?{" "}
            </SansSerifText>
            {cooldown > 0 ? (
              <SansSerifText style={styles.cooldownText}>
                Resend in {cooldown}s
              </SansSerifText>
            ) : (
              <Pressable onPress={handleResend} disabled={loading || resending}>
                <SansSerifBoldText style={styles.resendLink}>
                  {resending ? "Sending..." : "Resend code"}
                </SansSerifBoldText>
              </Pressable>
            )}
          </View>

          {onChangeEmail && (
            <Pressable onPress={onChangeEmail} disabled={loading} style={styles.changeEmail}>
              <SansSerifText style={styles.changeEmailText}>
                Wrong email? <SansSerifBoldText style={styles.changeEmailLink}>Change it</SansSerifBoldText>
              </SansSerifText>
            </Pressable>
          )}
        </CardContent>

        {onBack && (
          <CardFooter style={styles.footer}>
            <Pressable onPress={onBack} disabled={loading}>
              <SansSerifText style={styles.backLink}>
                ← Back to sign in
              </SansSerifText>
            </Pressable>
          </CardFooter>
        )}
    </Card>
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
      maxWidth: 400,
      alignSelf: "center",
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
