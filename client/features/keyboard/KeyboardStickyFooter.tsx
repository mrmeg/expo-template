/**
 * KeyboardStickyFooter (Native)
 *
 * Uses KeyboardStickyView from react-native-keyboard-controller to animate
 * the footer above the keyboard on iOS and Android.
 */

import { View, ViewProps, StyleSheet } from "react-native";
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

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom || spacing.lg,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
          style,
        ]}
        {...props}
      >
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
