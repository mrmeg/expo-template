import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";

/**
 * Wide-screen page header, rendered inside the content column beside the
 * full-height rail (see `(tabs)/_layout.tsx`).
 *
 * On wide screens the `(tabs)` stack header is suppressed (see `MainLayout.tsx`)
 * so the rail can span the full window height; this restores the page title
 * over the content area only. Its row height + bottom divider are matched to the
 * rail's `Drawer.Header`, so the two dividers line up into one continuous band
 * across the top.
 */
export function ContentHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
      </View>
    </View>
  );
}

// Matches the rail's Drawer.Header content height (paddingVertical md ×2 + the
// touchTarget-sized toggle) so this header's bottom border aligns with the rail's.
const HEADER_ROW_HEIGHT = spacing.touchTarget + spacing.md * 2;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    row: {
      height: HEADER_ROW_HEIGHT,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    title: {
      fontSize: 24,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
  });
