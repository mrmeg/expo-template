import React, { ReactNode } from "react";
import {
  View,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import { Separator } from "@/client/components/ui/Separator";
import type { Theme } from "@/client/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WelcomeAction {
  label: string;
  onPress: () => void;
}

export interface WelcomeSocialProvider {
  label: string;
  icon: IconName;
  onPress: () => void;
}

export interface WelcomeScreenProps {
  title: string;
  subtitle?: string;
  logo?: ReactNode;
  logoIcon?: IconName;
  primaryAction: WelcomeAction;
  secondaryAction?: WelcomeAction;
  socialProviders?: WelcomeSocialProvider[];
  footerText?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WelcomeScreen({
  title,
  subtitle,
  logo,
  logoIcon,
  primaryAction,
  secondaryAction,
  socialProviders,
  footerText,
  style: styleOverride,
}: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, styleOverride]}>
      {/* Top spacer */}
      <View style={styles.spacer} />

      {/* Logo + Title */}
      <View style={styles.hero}>
        {logo || (
          logoIcon && (
            <View style={styles.logoContainer}>
              <Icon name={logoIcon} size={48} color={theme.colors.accentForeground} />
            </View>
          )
        )}

        <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
        {subtitle && (
          <SansSerifText style={styles.subtitle}>{subtitle}</SansSerifText>
        )}
      </View>

      {/* Bottom actions */}
      <View style={styles.actions}>
        {/* Social providers */}
        {socialProviders && socialProviders.length > 0 && (
          <>
            <View style={styles.socialContainer}>
              {socialProviders.map((provider) => (
                <Button
                  key={provider.label}
                  preset="outline"
                  fullWidth
                  onPress={provider.onPress}
                >
                  <Icon
                    name={provider.icon}
                    size={18}
                    color={theme.colors.foreground}
                    style={{ marginRight: spacing.sm }}
                  />
                  <SansSerifText style={{ color: theme.colors.foreground, fontWeight: "500" }}>
                    {provider.label}
                  </SansSerifText>
                </Button>
              ))}
            </View>

            <View style={styles.separatorRow}>
              <Separator style={styles.separatorLine} margin={0} />
              <SansSerifText style={styles.separatorText}>or</SansSerifText>
              <Separator style={styles.separatorLine} margin={0} />
            </View>
          </>
        )}

        {/* Primary CTA */}
        <Button
          preset="default"
          size="lg"
          fullWidth
          onPress={primaryAction.onPress}
        >
          {primaryAction.label}
        </Button>

        {/* Secondary CTA */}
        {secondaryAction && (
          <Button
            preset="ghost"
            fullWidth
            onPress={secondaryAction.onPress}
          >
            <SansSerifText style={{ color: theme.colors.foreground, fontWeight: "500" }}>
              {secondaryAction.label}
            </SansSerifText>
          </Button>
        )}

        {/* Footer text */}
        {footerText && (
          <SansSerifText style={styles.footerText}>{footerText}</SansSerifText>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
    },
    spacer: {
      flex: 1,
    },
    hero: {
      alignItems: "center",
      flex: 2,
      justifyContent: "center",
    },
    logoContainer: {
      width: 80,
      height: 80,
      borderRadius: spacing.radiusXl,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: -0.75,
      color: theme.colors.foreground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    actions: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    socialContainer: {
      gap: spacing.sm,
    },
    separatorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    separatorLine: {
      flex: 1,
      height: 1,
    },
    separatorText: {
      fontSize: 13,
      color: theme.colors.mutedForeground,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
      marginTop: spacing.sm,
    },
  });
