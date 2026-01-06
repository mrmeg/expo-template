import React, { useState } from "react";
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
  title = "Welcome back",
  description = "Sign in to your account to continue",
  embedded = false,
}: SignInFormProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    if (value.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    if (isEmailValid && isPasswordValid) {
      await onSignIn?.({ email, password });
    }
  };

  const getSocialLabel = (provider: string): string => {
    switch (provider) {
    case "google":
      return "Continue with Google";
    case "apple":
      return "Continue with Apple";
    case "github":
      return "Continue with GitHub";
    default:
      return `Continue with ${provider}`;
    }
  };

  const formContent = (
    <Card style={styles.card}>
      <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent style={styles.content}>
          {error && (
            <View style={styles.errorContainer}>
              <SansSerifText style={styles.errorText}>{error}</SansSerifText>
            </View>
          )}

          <View style={styles.inputGroup}>
            <TextInput
              label="Email"
              placeholder="name@example.com"
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
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) validatePassword(text);
              }}
              onBlur={() => validatePassword(password)}
              error={!!passwordError}
              errorText={passwordError}
              secureTextEntry
              showSecureEntryToggle
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
              required
            />
          </View>

          {onForgotPassword && (
            <Pressable
              onPress={onForgotPassword}
              disabled={loading}
              style={styles.forgotPassword}
            >
              <SansSerifText style={styles.forgotPasswordText}>
                Forgot password?
              </SansSerifText>
            </Pressable>
          )}

          <Button
            preset="default"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          >
            <SansSerifBoldText>Sign In</SansSerifBoldText>
          </Button>

          {socialProviders.length > 0 && (
            <>
              <View style={styles.separatorContainer}>
                <View style={styles.separatorLine} />
                <SansSerifText style={styles.separatorText}>or</SansSerifText>
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
              Don't have an account?{" "}
            </SansSerifText>
            <Pressable onPress={onSignUp} disabled={loading}>
              <SansSerifBoldText style={styles.signUpLink}>
                Sign up
              </SansSerifBoldText>
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
