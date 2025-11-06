import React from "react";
import { View, ViewStyle, StyleSheet, Platform } from "react-native";
import { useDimensions } from "@/hooks/useDimensions";
import { useTheme } from "@/hooks/useTheme";

interface MaxWidthContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
  noPadding?: boolean;
}

export function MaxWidthContainer({
  children,
  maxWidth = 2400,
  style,
}: MaxWidthContainerProps) {
  const { width } = useDimensions();
  const { theme, withAlpha } = useTheme();
  const styles = createStyles(theme, withAlpha);

  // Only apply max-width on web and large screens
  const shouldApplyMaxWidth = Platform.OS === "web" && width > maxWidth;

  return (
    <View style={[
      styles.container,
      shouldApplyMaxWidth && {
        maxWidth,
        alignSelf: "center",
        width: "100%",
      },
      style
    ]}>
      {children}
    </View>
  );
}

const createStyles = (theme: any, withAlpha: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
});
