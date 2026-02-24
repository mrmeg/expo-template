import React, { useState } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
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
  const styles = createStyles(theme);

  const resolvedTitle = title ?? t("auth.forgotPasswordTitle");
  const resolvedDescription = description ?? t("auth.forgotPasswordDescription");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError(t("errors.emailRequired"));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError(t("errors.invalidEmail"));
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async () => {
    if (validateEmail(email)) {
      await onSubmit?.(email);
    }
  };

  const wrapContent = (content: React.ReactNode) => {
    if (embedded) {
      return <View style={styles.embeddedContainer}>{content}</View>;
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
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  if (success) {
    return wrapContent(
      <View style={styles.formWrapper}>
        {logo && <View style={styles.logoContainer}>{logo}</View>}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>{t("auth.checkYourEmail")}</CardTitle>
            <CardDescription>
              {t("auth.resetLinkSentDescription", { email })}
            </CardDescription>
          </CardHeader>

          <CardContent style={styles.content}>
            <View style={styles.successContainer}>
              <SansSerifText style={styles.successText}>
                {t("auth.didntReceiveEmail")}
              </SansSerifText>
            </View>

            <Button
              preset="outline"
              onPress={() => {
                setEmail("");
                onBack?.();
              }}
              fullWidth
            >
              <SansSerifBoldText>{t("auth.backToSignIn")}</SansSerifBoldText>
            </Button>
          </CardContent>
        </Card>
      </View>
    );
  }

  return wrapContent(
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
            <TextInput
              label={t("auth.email")}
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) validateEmail(text);
              }}
              onBlur={() => validateEmail(email)}
              error={!!emailError}
              errorText={emailError}
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
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            <SansSerifBoldText>{t("auth.sendResetLink")}</SansSerifBoldText>
          </Button>
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
    successContainer: {
      backgroundColor: theme.colors.success + "15",
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
    footer: {
      justifyContent: "center",
    },
    backLink: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  });

export default ForgotPasswordForm;
