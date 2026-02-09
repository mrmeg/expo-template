import React from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "@/client/lib/keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { Icon } from "@/client/components/ui/Icon";
import { Separator } from "@/client/components/ui/Separator";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";

import type { Theme } from "@/client/constants/colors";

export default function TypographyShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Typography">
            <SubSection label="Sans Serif">
              <StyledText style={styles.sansSerifText}>Sans Serif Text - Default body text</StyledText>
              <StyledText style={styles.sansSerifBoldText}>Sans Serif Bold - Emphasized text</StyledText>
            </SubSection>

            <SubSection label="Serif">
              <StyledText style={styles.serifText}>Serif Text - Elegant headings</StyledText>
              <StyledText style={styles.serifBoldText}>Serif Bold - Strong emphasis</StyledText>
            </SubSection>
          </Section>

          <Section title="Icons">
            <SubSection label="Basic Icons">
              <View style={styles.iconRow}>
                <Icon name="heart" size={24} />
                <Icon name="star" size={24} />
                <Icon name="settings" size={24} />
                <Icon name="home" size={24} />
                <Icon name="user" size={24} />
                <Icon name="mail" size={24} />
                <Icon name="bell" size={24} />
                <Icon name="search" size={24} />
                <Icon name="shopping-cart" size={24} />
              </View>
            </SubSection>

            <SubSection label="Icon Sizes">
              <View style={styles.iconRow}>
                <Icon name="heart" size={16} />
                <Icon name="heart" size={24} />
                <Icon name="heart" size={32} />
                <Icon name="heart" size={48} />
              </View>
            </SubSection>

            <SubSection label="Icon Colors">
              <View style={styles.iconRow}>
                <Icon name="heart" size={32} color={theme.colors.destructive} />
                <Icon name="star" size={32} color={theme.colors.warning} />
                <Icon name="check-circle" size={32} color={theme.colors.success} />
                <Icon name="info" size={32} color={theme.colors.primary} />
              </View>
            </SubSection>

            <SubSection label="Status Icons">
              <View style={styles.iconRow}>
                <Icon name="alert-circle" size={28} color={theme.colors.destructive} />
                <Icon name="check-circle" size={28} color={theme.colors.success} />
                <Icon name="alert-triangle" size={28} color={theme.colors.warning} />
                <Icon name="info" size={28} color={theme.colors.foreground} />
              </View>
            </SubSection>
          </Section>

          <Section title="Separator">
            <SubSection label="Horizontal (Default)">
              <View style={{ gap: spacing.sm }}>
                <StyledText style={styles.labelText}>Content above separator</StyledText>
                <Separator margin={spacing.sm} />
                <StyledText style={styles.labelText}>Content below separator</StyledText>
              </View>
            </SubSection>

            <SubSection label="Size Variants">
              <View style={{ gap: spacing.xs }}>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>sm</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="sm" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>md</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="md" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 40 }]}>lg</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator size="lg" margin={0} />
                  </View>
                </View>
              </View>
            </SubSection>

            <SubSection label="Visual Variants">
              <View style={{ gap: spacing.sm }}>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 70 }]}>default</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator variant="default" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 70 }]}>muted</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator variant="muted" margin={0} />
                  </View>
                </View>
                <View style={styles.separatorRow}>
                  <StyledText style={[styles.labelText, { width: 70 }]}>primary</StyledText>
                  <View style={{ flex: 1 }}>
                    <Separator variant="primary" margin={0} />
                  </View>
                </View>
              </View>
            </SubSection>

            <SubSection label="Vertical Orientation">
              <View style={{ flexDirection: "row", alignItems: "center", height: 60 }}>
                <StyledText style={styles.labelText}>Left</StyledText>
                <Separator orientation="vertical" margin={spacing.md} />
                <StyledText style={styles.labelText}>Center</StyledText>
                <Separator orientation="vertical" variant="primary" margin={spacing.md} />
                <StyledText style={styles.labelText}>Right</StyledText>
              </View>
            </SubSection>
          </Section>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
    },
    content: {
      flex: 1,
      padding: spacing.md,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    labelText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
    },
    sansSerifText: {
      fontFamily: fontFamilies.sansSerif.regular,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    sansSerifBoldText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    serifText: {
      fontFamily: fontFamilies.serif.regular,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    serifBoldText: {
      fontFamily: fontFamilies.serif.bold,
      color: theme.colors.foreground,
    },
    iconRow: {
      flexDirection: "row",
      gap: spacing.md,
      flexWrap: "wrap",
      alignItems: "center",
    },
    separatorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
  });
