import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { StyledText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import { Section, SubSection, ThemeToggle } from "@/client/components/showcase";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { fontFamilies } from "@/client/constants/fonts";
import { Heart, ArrowRight } from "lucide-react-native";
import type { Theme } from "@/client/constants/colors";

export default function ButtonsShowcaseScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemeToggle />
          </View>

          <Section title="Button Presets">
            <SubSection label="Default">
              <Button preset="default" onPress={() => console.log("Default pressed")}>
                <StyledText style={styles.buttonText}>Default Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Secondary">
              <Button preset="secondary" onPress={() => console.log("Secondary pressed")}>
                <StyledText style={styles.buttonText}>Secondary Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Outline">
              <Button preset="outline" onPress={() => console.log("Outline pressed")}>
                <StyledText style={styles.outlineButtonText}>Outline Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Ghost">
              <Button preset="ghost" onPress={() => console.log("Ghost pressed")}>
                <StyledText style={styles.ghostButtonText}>Ghost Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Link">
              <Button preset="link" onPress={() => console.log("Link pressed")}>
                <StyledText style={styles.linkButtonText}>Link Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Destructive">
              <Button preset="destructive" onPress={() => console.log("Destructive pressed")}>
                <StyledText style={styles.buttonText}>Destructive Button</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Button States">
            <SubSection label="Disabled">
              <Button preset="default" disabled onPress={() => {}}>
                <StyledText style={styles.buttonText}>Disabled Button</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Loading">
              <Button
                preset="default"
                loading={loading}
                onPress={handleLoadingDemo}
              >
                <StyledText style={styles.buttonText}>
                  {loading ? "Loading..." : "Click to Load"}
                </StyledText>
              </Button>
            </SubSection>

            <SubSection label="Full Width">
              <Button preset="default" fullWidth onPress={() => {}}>
                <StyledText style={styles.buttonText}>Full Width Button</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="Button Sizes">
            <SubSection label="Small">
              <Button preset="default" size="sm" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Small</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Default">
              <Button preset="default" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Default</StyledText>
              </Button>
            </SubSection>

            <SubSection label="Large">
              <Button preset="default" size="lg" onPress={() => {}}>
                <StyledText style={styles.buttonText}>Large</StyledText>
              </Button>
            </SubSection>
          </Section>

          <Section title="With Icons">
            <SubSection label="Left Icon">
              <Button preset="default" onPress={() => {}}>
                <Icon as={Heart} size={16} color={theme.colors.primaryForeground} />
                <StyledText style={[styles.buttonText, { marginLeft: spacing.xs }]}>
                  With Left Icon
                </StyledText>
              </Button>
            </SubSection>

            <SubSection label="Right Icon">
              <Button preset="outline" onPress={() => {}}>
                <StyledText style={[styles.outlineButtonText, { marginRight: spacing.xs }]}>
                  Continue
                </StyledText>
                <Icon as={ArrowRight} size={16} color={theme.colors.primary} />
              </Button>
            </SubSection>

            <SubSection label="Icon Only">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button preset="default" onPress={() => {}}>
                  <Icon as={Heart} size={18} color={theme.colors.primaryForeground} />
                </Button>
                <Button preset="outline" onPress={() => {}}>
                  <Icon as={Heart} size={18} color={theme.colors.primary} />
                </Button>
                <Button preset="ghost" onPress={() => {}}>
                  <Icon as={Heart} size={18} color={theme.colors.foreground} />
                </Button>
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
      marginTop: spacing.md,
    },
    buttonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primaryForeground,
    },
    outlineButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
    },
    ghostButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.foreground,
    },
    linkButtonText: {
      fontFamily: fontFamilies.sansSerif.bold,
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
  });
