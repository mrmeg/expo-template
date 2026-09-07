/**
 * KeyboardStickyFooter (Web)
 *
 * Web has no software keyboard to stick to, so this is the same footer surface
 * without `KeyboardStickyView`. Keeping the native variant's import of
 * `react-native-keyboard-controller` out of the web graph also keeps
 * `react-native-reanimated` (which that package pulls in) out of the web bundle.
 */
import { View, ViewProps, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";

interface KeyboardStickyFooterProps extends ViewProps {
  children: React.ReactNode;
}

export function KeyboardStickyFooter({ children, style, ...props }: KeyboardStickyFooterProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
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
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: spacing.cardPadding,
    borderTopWidth: 1,
  },
});
