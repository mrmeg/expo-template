import React, { useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Card } from "@mrmeg/expo-ui/components/Card";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Label } from "@mrmeg/expo-ui/components/Label";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignInFormSocialProvider {
  /** Stable key, also passed back to `onSocialPress`. */
  id: string;
  /** Button label, e.g. "Continue with Apple". */
  label: string;
}

export interface SignInFormBlockProps {
  /** Card heading. */
  title?: string;
  /** Supporting copy below the heading. */
  description?: string;
  /** Submit button label. */
  submitLabel?: string;
  /** Called with the current field values when the submit button is pressed. */
  onSubmit?: (values: { email: string; password: string }) => void;
  /** Social buttons below the separator — pass `[]` to hide the whole group. */
  socialProviders?: SignInFormSocialProvider[];
  /** Called with the provider id when a social button is pressed. */
  onSocialPress?: (providerId: string) => void;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_SOCIAL_PROVIDERS: SignInFormSocialProvider[] = [
  { id: "apple", label: "Continue with Apple" },
  { id: "google", label: "Continue with Google" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SignInFormBlock
 *
 * The credential-form *section*: a `Card` holding `Label` + `TextInput` pairs,
 * a submit `Button`, a `Separator` divider, and one outline button per social
 * provider. Deliberately presentational — it owns only the two field values
 * and hands them to `onSubmit`.
 *
 * For a production sign-in with validation, i18n, error states, and keyboard
 * handling, use `client/features/auth/components/SignInForm`; this block is
 * the layout you copy when you need the shape without the auth feature.
 *
 * @example
 * ```tsx
 * <SignInFormBlock
 *   title="Welcome back"
 *   onSubmit={({ email, password }) => signIn(email, password)}
 *   onSocialPress={(id) => startOAuth(id)}
 * />
 * ```
 */
export function SignInFormBlock({
  title = "Welcome back",
  description = "Sign in to continue to your workspace.",
  submitLabel = "Sign in",
  onSubmit,
  socialProviders = DEFAULT_SOCIAL_PROVIDERS,
  onSocialPress,
  style: styleOverride,
}: SignInFormBlockProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={[styles.container, styleOverride]}>
      <Card style={styles.card}>
        <View style={styles.body}>
          <View style={styles.heading}>
            <SansSerifBoldText size="lg" style={styles.title}>
              {title}
            </SansSerifBoldText>
            {!!description && (
              <SansSerifText size="sm" style={styles.description}>
                {description}
              </SansSerifText>
            )}
          </View>

          <View style={styles.field}>
            <Label nativeID="block-sign-in-email">Email</Label>
            <TextInput
              nativeID="block-sign-in-email"
              testID="block-sign-in-email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Label nativeID="block-sign-in-password">Password</Label>
            <TextInput
              nativeID="block-sign-in-password"
              testID="block-sign-in-password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showSecureEntryToggle
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          <Button fullWidth onPress={() => onSubmit?.({ email, password })} text={submitLabel} />

          {socialProviders.length > 0 && (
            <>
              <Separator margin={spacing.xs} />
              <View style={styles.social}>
                {socialProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    preset="outline"
                    fullWidth
                    onPress={() => onSocialPress?.(provider.id)}
                    text={provider.label}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Module scope, not render time: theme-dependent styles created during render
// miss the SSR head snapshot and paint unstyled. See docs/ssr-hydration.md §7.
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    body: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    heading: {
      alignItems: "center",
      gap: spacing.xxs,
    },
    title: {
      textAlign: "center",
    },
    description: {
      color: theme.colors.mutedForeground,
      textAlign: "center",
    },
    field: {
      gap: spacing.xs,
    },
    social: {
      gap: spacing.sm,
    },
  });

const themedStyles = createThemedStyles(createStyles);
