import React, { useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon, type IconName } from "@/client/components/ui/Icon";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import type { Theme } from "@/client/constants/colors";

const HERO_HEIGHT = 250;
const OVERLAP = 30;

interface StatItem {
  icon: IconName;
  value: string;
  label: string;
}

const STATS: StatItem[] = [
  { icon: "star", value: "4.9", label: "Rating" },
  { icon: "download", value: "12K", label: "Downloads" },
  { icon: "users", value: "2.3K", label: "Active Users" },
];

export default function DetailHeroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme, insets.top);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Parallax header: translateY and opacity
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT / 2],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Sticky navbar: fades in as you scroll past hero
  const navBarOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT * 0.5, HERO_HEIGHT * 0.8],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Hero header (behind scroll) */}
      <Animated.View
        style={[
          styles.hero,
          {
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          },
        ]}
      >
        <View style={styles.heroContent}>
          <Icon name="box" size={56} color={theme.colors.accentForeground} />
          <SansSerifBoldText style={styles.heroTitle}>Expo Template</SansSerifBoldText>
          <SansSerifText style={styles.heroSubtitle}>
            Production-ready starter kit
          </SansSerifText>
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
          { useNativeDriver: true }
        )}
      >
        {/* Spacer for hero */}
        <View style={{ height: HERO_HEIGHT - OVERLAP }} />

        {/* Overlapping content card */}
        <View style={styles.contentCard}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            {STATS.map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Icon name={stat.icon} size={20} color={theme.colors.accent} />
                <SansSerifBoldText style={styles.statValue}>{stat.value}</SansSerifBoldText>
                <SansSerifText style={styles.statLabel}>{stat.label}</SansSerifText>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>About</SansSerifBoldText>
            <SansSerifText style={styles.bodyText}>
              A production-ready Expo template with authentication, themed UI components,
              internationalization, and a professional project structure. Built with
              TypeScript, Expo Router, and a carefully crafted design system.
            </SansSerifText>
            <SansSerifText style={styles.bodyText}>
              Includes 20+ reusable components, dark mode support, form validation,
              and navigation patterns — everything you need to ship faster.
            </SansSerifText>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <SansSerifBoldText style={styles.sectionTitle}>Features</SansSerifBoldText>
            {[
              "Expo Router file-based navigation",
              "Light & dark theme with system detection",
              "20+ themed UI components",
              "i18n with English & Spanish",
              "Zustand state management",
              "TypeScript throughout",
            ].map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Icon name="check" size={16} color={theme.colors.accent} />
                <SansSerifText style={styles.featureText}>{feature}</SansSerifText>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Button
              preset="default"
              fullWidth
              onPress={() => router.back()}
            >
              Get Started
            </Button>
            <Button
              preset="outline"
              fullWidth
              onPress={() => router.back()}
            >
              <SansSerifText style={{ color: theme.colors.foreground }}>
                Learn More
              </SansSerifText>
            </Button>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky header overlay */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.stickyHeader,
          { opacity: navBarOpacity },
        ]}
      >
        <View style={styles.stickyHeaderInner}>
          <Pressable
            onPress={() => router.back()}
            style={Platform.OS === "web" ? { cursor: "pointer" as any } : undefined}
          >
            <Icon name="arrow-left" size={24} color={theme.colors.foreground} />
          </Pressable>
          <SansSerifBoldText style={styles.stickyTitle}>Expo Template</SansSerifBoldText>
          <View style={{ width: 24 }} />
        </View>
      </Animated.View>

      {/* Back button (always visible at top) */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.backButtonContainer,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, HERO_HEIGHT * 0.5],
              outputRange: [1, 0],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            Platform.OS === "web" && { cursor: "pointer" as any },
          ]}
        >
          <Icon name="arrow-left" size={24} color={theme.colors.accentForeground} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: Theme, topInset: number) =>
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
      height: HERO_HEIGHT,
      backgroundColor: theme.colors.accent,
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
    bodyText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.mutedForeground,
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
