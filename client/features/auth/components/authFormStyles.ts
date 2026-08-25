import { StyleSheet } from "react-native";
import { withAlpha } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import type { Theme } from "@mrmeg/expo-ui/constants";

/**
 * Stylesheet keys shared by `AuthFormCard` and the five auth forms.
 *
 * The forms used to carry ~60-line stylesheets that were ~80% identical; the
 * shell keys (`keyboardAvoid` … `footer`) belong to `AuthFormCard` and the rest
 * are the body keys more than one form needs. A form keeps a local
 * `createThemedStyles` block only for styles nothing else uses.
 *
 * Registered at module scope on purpose — see `createThemedStyles` for why
 * lazily-created themed styles break the exported web document's <head>.
 *
 * This module is part of the lazy auth-components chunk: only the components in
 * this folder may import it, and only statically. See ./index.ts.
 */
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // --- AuthFormCard shell ---
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
    formWrapper: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    card: {
      width: "100%",
    },
    content: {
      gap: spacing.md,
    },
    errorContainer: {
      backgroundColor: withAlpha(theme.colors.destructive, 0.08),
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
    footer: {
      justifyContent: "center",
    },

    // --- Form bodies ---
    inputGroup: {
      width: "100%",
    },
    /** Tappable text: "Forgot password?", "Sign up", "Back to sign in". */
    linkText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    /** Body-sized secondary copy that sits next to a `linkText`. */
    mutedText: {
      color: theme.colors.textDim,
      fontSize: 14,
    },
    /** Small secondary copy: separator label, password requirements. */
    hintText: {
      color: theme.colors.textDim,
      fontSize: 13,
    },
    /** "or" divider above the social buttons (sign-in and sign-up). */
    separatorRow: {
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
    socialButtons: {
      gap: spacing.sm,
    },
  });

export const authFormStyles = createThemedStyles(createStyles);
