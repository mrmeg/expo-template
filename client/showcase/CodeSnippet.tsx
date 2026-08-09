/**
 * Copyable code block for the component detail screen.
 *
 * Mockup 05 frame 3 shows a syntax-tinted snippet in the detail sheet; there's
 * no tokenizer in the app, so this renders monospaced plain text on the muted
 * surface and puts the value in a copy button instead. The snippet is what an
 * adopter actually needs — an import line plus a usage example — so it's a
 * single string, copied verbatim.
 */

import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { MonoText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import type { Theme } from "@mrmeg/expo-ui/constants";

import { useClipboard } from "@/client/hooks/useClipboard";
import { blurActiveElementOnWeb } from "@/client/features/navigation/blurActiveElementOnWeb";

interface CodeSnippetProps {
  /** Small label above the block, e.g. "Import" or "Usage". */
  label: string;
  /** The exact text copied to the clipboard. */
  code: string;
  testID?: string;
}

export function CodeSnippet({ label, code, testID }: CodeSnippetProps) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const { copy, copied } = useClipboard();

  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={styles.header}>
        <SansSerifText style={styles.label}>{label}</SansSerifText>
        <Pressable
          onPress={() => copy(code)}
          onPressIn={blurActiveElementOnWeb}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${label.toLowerCase()}`}
          testID={testID ? `${testID}-copy` : undefined}
          style={[styles.copy, Platform.OS === "web" ? { cursor: "pointer" as never } : null]}
        >
          <Icon
            name={copied ? "check" : "copy"}
            size={13}
            color={copied ? theme.colors.success : theme.colors.mutedForeground}
          />
          <SansSerifText style={styles.copyText}>
            {copied ? "Copied" : "Copy"}
          </SansSerifText>
        </Pressable>
      </View>
      <View style={styles.block}>
        <MonoText size="sm" style={styles.code} selectable>
          {code}
        </MonoText>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    label: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.colors.mutedForeground,
    },
    copy: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.xs,
    },
    copyText: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    block: {
      backgroundColor: theme.colors.muted,
      borderRadius: spacing.radiusSm,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      padding: spacing.sm + 2,
    },
    code: {
      color: theme.colors.foreground,
      lineHeight: 20,
    },
  });

const themedStyles = createThemedStyles(createStyles);
