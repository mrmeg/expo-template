import React, { useMemo, ReactNode, useRef } from "react";
import {
  View,
  Animated,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { shouldUseNativeDriver } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetailHeroStat {
  icon: IconName;
  value: string;
  label: string;
}

export interface DetailHeroSection {
  title: string;
  content: ReactNode;
}

export interface DetailHeroAction {
  label: string;
  onPress: () => void;
}

export interface DetailHeroScreenProps {
  title: string;
  subtitle?: string;
  heroIcon?: IconName;
  heroContent?: ReactNode;
  heroHeight?: number;
  heroBackgroundColor?: string;
  stats?: DetailHeroStat[];
  sections?: DetailHeroSection[];
  features?: string[];
  primaryAction?: DetailHeroAction;
  secondaryAction?: DetailHeroAction;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OVERLAP = 30;

export function DetailHeroScreen({
  title,
  subtitle,
  heroIcon,
  heroContent,
  heroHeight = 250,
  heroBackgroundColor,
  stats,
  sections,
  features,
  primaryAction,
  secondaryAction,
  onBack,
  style: styleOverride,
}: DetailHeroScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, insets.top, heroHeight), [theme, insets.top, heroHeight]);
  const heroBg = heroBackgroundColor || theme.colors.accent;

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, -heroHeight / 2],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const navBarOpacity = scrollY.interpolate({
    inputRange: [heroHeight * 0.5, heroHeight * 0.8],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const backButtonOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.5],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, styleOverride]}>
      {/* Hero header */}
      <Animated.View
        style={[
          styles.hero,
          {
            backgroundColor: heroBg,
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          },
        ]}
      >
        <View style={styles.heroContent}>
          {heroContent || (
            <>
              {heroIcon && (
                <Icon name={heroIcon} size={56} color={theme.colors.accentForeground} />
              )}
              <SansSerifBoldText style={styles.heroTitle}>{title}</SansSerifBoldText>
              {subtitle && (
                <SansSerifText style={styles.heroSubtitle}>{subtitle}</SansSerifText>
              )}
            </>
          )}
        </View>
      </Animated.View>

      {/* Scrollable content */}
      <Animated.ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: shouldUseNativeDriver }
        )}
      >
        <View style={{ height: heroHeight - OVERLAP }} />

        <View style={styles.contentCard}>
          {/* Stats row */}
          {stats && stats.length > 0 && (
            <>
              <View style={styles.statsRow}>
                {stats.map((stat) => (
                  <View key={stat.label} style={styles.statItem}>
                    <Icon name={stat.icon} size={20} color={theme.colors.accent} />
                    <SansSerifBoldText style={styles.statValue}>{stat.value}</SansSerifBoldText>
                    <SansSerifText style={styles.statLabel}>{stat.label}</SansSerifText>
                  </View>
                ))}
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Sections */}
          {sections?.map((section) => (
            <View key={section.title} style={styles.section}>
              <SansSerifBoldText style={styles.sectionTitle}>{section.title}</SansSerifBoldText>
              {section.content}
            </View>
          ))}

          {/* Features checklist */}
          {features && features.length > 0 && (
            <View style={styles.section}>
              <SansSerifBoldText style={styles.sectionTitle}>Features</SansSerifBoldText>
              {features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Icon name="check" size={16} color={theme.colors.accent} />
                  <SansSerifText style={styles.featureText}>{feature}</SansSerifText>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          {(primaryAction || secondaryAction) && (
            <View style={styles.actionsRow}>
              {primaryAction && (
                <Button preset="default" fullWidth onPress={primaryAction.onPress}>
                  {primaryAction.label}
                </Button>
              )}
              {secondaryAction && (
                <Button preset="outline" fullWidth onPress={secondaryAction.onPress}>
                  <SansSerifText style={{ color: theme.colors.foreground }}>
                    {secondaryAction.label}
                  </SansSerifText>
                </Button>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Sticky header overlay */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.stickyHeader, { opacity: navBarOpacity }]}
      >
        <View style={styles.stickyHeaderInner}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
            >
              <Icon name="arrow-left" size={24} color={theme.colors.foreground} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <SansSerifBoldText style={styles.stickyTitle}>{title}</SansSerifBoldText>
          <View style={{ width: 24 }} />
        </View>
      </Animated.View>

      {/* Floating back button */}
      {onBack && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.backButtonContainer, { opacity: backButtonOpacity }]}
        >
          <Pressable
            onPress={onBack}
            style={[
              styles.backButton,
              Platform.OS === "web" && { cursor: "pointer" as any },
            ]}
          >
            <Icon name="arrow-left" size={24} color={theme.colors.accentForeground} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme, topInset: number, heroHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    hero: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: heroHeight,
      zIndex: 0,
    },
    heroContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: topInset,
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      color: theme.colors.accentForeground,
      marginTop: spacing.sm,
    },
    heroSubtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.accentForeground,
      opacity: 0.8,
      marginTop: spacing.xxs,
    },
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    contentCard: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: spacing.radius2xl,
      borderTopRightRadius: spacing.radius2xl,
      minHeight: Dimensions.get("window").height,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: spacing.md,
    },
    statItem: {
      alignItems: "center",
      gap: spacing.xxs,
    },
    statValue: {
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.mutedForeground,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: spacing.md,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
      marginBottom: spacing.sm,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    featureText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.foreground,
    },
    actionsRow: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingTop: topInset,
      zIndex: 10,
    },
    stickyHeaderInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      height: 48,
    },
    stickyTitle: {
      fontSize: 16,
      color: theme.colors.foreground,
    },
    backButtonContainer: {
      position: "absolute",
      top: topInset + spacing.sm,
      left: spacing.md,
      zIndex: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
  });
