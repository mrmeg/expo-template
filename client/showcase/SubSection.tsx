import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { fontFamilies } from "@mrmeg/expo-ui/constants";

interface SubSectionProps {
  label?: string;
  children: React.ReactNode;
}

export function SubSection({ label, children }: SubSectionProps) {
  return (
    <View style={styles.subSection}>
      {label && (
        <StyledText style={styles.subSectionLabel}>
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
    fontSize: 12,
    fontFamily: fontFamilies.sansSerif.regular,
    opacity: 0.7,
    marginBottom: spacing.xs,
  },
});
