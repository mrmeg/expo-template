import React from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@mrmeg/expo-ui/components/Card";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { authFormStyles } from "./authFormStyles";

/**
 * The card shell every auth form renders: optional logo, `Card` +
 * `CardHeader` (title/description), an error banner above the fields, the
 * fields themselves, and an optional footer row.
 *
 * Also owns the "embedded vs standalone" wrapper. Standalone (a form owning the
 * screen) gets the `KeyboardAvoidingView` + centering `ScrollView`; `embedded`
 * (rendered inside a parent scroll view, which is how `AuthScreen`, the
 * `auth-demo` route and the showcase gallery use the forms) gets a plain
 * full-width `View` so there is no nested scroll container.
 *
 * The API is the intersection of what the five forms' shells needed, so success
 * screens (forgot/reset password) reuse it too: they pass their own title and no
 * error/footer.
 *
 * This module is part of the lazy auth-components chunk: only the components in
 * this folder may import it, and only statically. See ./index.ts.
 */
export interface AuthFormCardProps {
  /** Card heading. Forms resolve their own i18n fallback before passing it. */
  title: React.ReactNode;
  /** Sub-heading under the title. Omitted entirely when nullish. */
  description?: React.ReactNode;
  /** Error banner text rendered above `children`. Blank/undefined hides it. */
  error?: string;
  /** Logo element rendered centered above the card. */
  logo?: React.ReactNode;
  /** Set to true when the form is embedded in a parent scroll view. */
  embedded?: boolean;
  /** Footer row (links back to other views). Omitted entirely when nullish. */
  footer?: React.ReactNode;
  /** The form's fields and submit button. */
  children: React.ReactNode;
}

export function AuthFormCard({
  title,
  description,
  error,
  logo,
  embedded = false,
  footer,
  children,
}: AuthFormCardProps) {
  const { theme } = useTheme();
  const styles = authFormStyles(theme);

  const card = (
    <View style={styles.formWrapper}>
      {logo && <View style={styles.logoContainer}>{logo}</View>}
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {!!description && <CardDescription>{description}</CardDescription>}
        </CardHeader>

        <CardContent style={styles.content}>
          {!!error && (
            <View style={styles.errorContainer}>
              <SansSerifText style={styles.errorText}>{error}</SansSerifText>
            </View>
          )}

          {children}
        </CardContent>

        {!!footer && <CardFooter style={styles.footer}>{footer}</CardFooter>}
      </Card>
    </View>
  );

  if (embedded) {
    return <View style={styles.embeddedContainer}>{card}</View>;
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
        {card}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AuthFormCard;
