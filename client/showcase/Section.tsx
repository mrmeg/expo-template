import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  const { theme, getShadowStyle } = useTheme();
  const shadowStyle = getShadowStyle("soft");

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        shadowStyle,
      ]}
    >
      <StyledText style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
        {title}
      </StyledText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: spacing.lg,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.serif.bold,
    marginBottom: spacing.lg,
  },
});
