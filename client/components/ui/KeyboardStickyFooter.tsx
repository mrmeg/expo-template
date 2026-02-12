/**
 * KeyboardStickyFooter
 *
 * A footer wrapper that sticks above the keyboard on mobile devices.
 * Uses react-native-keyboard-controller's KeyboardStickyView for reliable
 * keyboard-aware behavior on both iOS and Android.
 */

import { Platform, View, ViewProps, StyleSheet } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";

interface KeyboardStickyFooterProps extends ViewProps {
  children: React.ReactNode;
}

export function KeyboardStickyFooter({ children, style, ...props }: KeyboardStickyFooterProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const footerStyle = [
    styles.footer,
    {
      paddingBottom: insets.bottom || spacing.lg,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    style,
  ];

  // Web doesn't support KeyboardStickyView
  if (Platform.OS === "web") {
    return (
      <View style={footerStyle} {...props}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View style={footerStyle} {...props}>
        {children}
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
