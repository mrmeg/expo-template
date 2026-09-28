import React from "react";
import { StyleSheet, View } from "react-native";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * One showcase section: a divider, a serif title, then the demos.
 *
 * Flat on purpose. The showcase screen already pads the page, so a bordered,
 * padded panel here would inset every demo a second time and render the Card
 * demos as cards inside a card.
 */
export function Section({ title, children }: SectionProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <Separator margin={0} />
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
    marginBottom: spacing.sectionSpacing,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
});
