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
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
