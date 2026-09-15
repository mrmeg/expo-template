import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

interface SubSectionProps {
  label?: string;
  children: React.ReactNode;
}

export function SubSection({ label, children }: SubSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.subSection}>
      {label && (
        <StyledText semantic="caption" style={[styles.subSectionLabel, { color: theme.colors.textDim }]}>
          {label}
        </StyledText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  subSection: {
    marginBottom: spacing.lg,
  },
  subSectionLabel: {
    marginBottom: spacing.xs,
  },
});
