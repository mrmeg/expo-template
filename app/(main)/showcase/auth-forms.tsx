import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/ToggleGroup";
import { SignInForm } from "@/client/components/auth/SignInForm";
import { SignUpForm } from "@/client/components/auth/SignUpForm";
import { VerifyEmailForm } from "@/client/components/auth/VerifyEmailForm";
import { ForgotPasswordForm } from "@/client/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/client/components/auth/ResetPasswordForm";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { globalUIStore } from "@/client/stores/globalUIStore";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import type { Theme } from "@/client/constants/colors";

export default function AuthFormsShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [authForm, setAuthForm] = useState<string>("signin");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Auth Forms">
            <SubSection label="Select Form">
              <ToggleGroup
                type="single"
                value={authForm}
                onValueChange={(val) => {
                  if (val) {
                    setAuthForm(val);
                    setForgotPasswordSuccess(false);
                    setResetPasswordSuccess(false);
                  }
                }}
              >
                <ToggleGroupItem value="signin">
                  <StyledText style={styles.labelText}>Sign In</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="signup">
                  <StyledText style={styles.labelText}>Sign Up</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="verify">
                  <StyledText style={styles.labelText}>Verify</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="forgot">
                  <StyledText style={styles.labelText}>Forgot</StyledText>
                </ToggleGroupItem>
                <ToggleGroupItem value="reset">
                  <StyledText style={styles.labelText}>Reset</StyledText>
                </ToggleGroupItem>
              </ToggleGroup>
            </SubSection>

            {authForm === "signin" && (
              <SignInForm
                embedded
                onSignIn={async ({ email, password }) => {
                  console.log("Sign in:", email, password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Success",
                    messages: ["Signed in successfully!"],
                    duration: 2000,
                  });
                }}
                onForgotPassword={() => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: ["Forgot password clicked"],
                    duration: 2000,
                  });
                }}
                onSignUp={() => setAuthForm("signup")}
                onSocialSignIn={(provider) => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: [`${provider} sign in clicked`],
                    duration: 2000,
                  });
                }}
              />
            )}

            {authForm === "signup" && (
              <SignUpForm
                embedded
                onSignUp={async ({ name, email, password }) => {
                  console.log("Sign up:", name, email, password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Success",
                    messages: ["Account created successfully!"],
                    duration: 2000,
                  });
                  setAuthForm("verify");
                }}
                onSignIn={() => setAuthForm("signin")}
                onSocialSignUp={(provider) => {
                  globalUIStore.getState().show({
                    type: "info",
                    messages: [`${provider} sign up clicked`],
                    duration: 2000,
                  });
                }}
              />
            )}

            {authForm === "verify" && (
              <VerifyEmailForm
                email="user@example.com"
                embedded
                onVerify={async (code) => {
                  console.log("Verify code:", code);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  globalUIStore.getState().show({
                    type: "success",
                    title: "Email Verified",
                    messages: ["Your email has been verified successfully!"],
                    duration: 2000,
                  });
                }}
                onResendCode={async () => {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  globalUIStore.getState().show({
                    type: "info",
                    messages: ["Verification code resent"],
                    duration: 2000,
                  });
                }}
                onBack={() => setAuthForm("signin")}
                onChangeEmail={() => setAuthForm("signup")}
              />
            )}

            {authForm === "forgot" && (
              <ForgotPasswordForm
                embedded
                onSubmit={async (email) => {
                  console.log("Forgot password:", email);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  setForgotPasswordSuccess(true);
                }}
                onBack={() => setAuthForm("signin")}
                success={forgotPasswordSuccess}
              />
            )}

            {authForm === "reset" && (
              <ResetPasswordForm
                embedded
                onSubmit={async (password) => {
                  console.log("Reset password:", password);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  setResetPasswordSuccess(true);
                }}
                onBack={() => setAuthForm("signin")}
                success={resetPasswordSuccess}
              />
            )}
          </Section>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    content: {
      flex: 1,
      padding: spacing.md,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
  });
