import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";

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
      <StyledText
        variant="serif"
        size="xl"
        style={[styles.sectionTitle, { color: theme.colors.foreground }]}
      >
        {title}
      </StyledText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: spacing.cardPadding,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
  },
});
