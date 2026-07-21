import React, { useMemo } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Button } from "@mrmeg/expo-ui/components/Button";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeroLayout = "centered" | "fullBleed";

export interface HeroAction {
  label: string;
  onPress: () => void;
}

export interface HeroScreenProps {
  /** Layout variant. @default "centered" */
  layout?: HeroLayout;
  /** Small uppercase label rendered above the title. */
  eyebrow?: string;
  /** Hero title, rendered at display size. */
  title: string;
  /** Supporting copy below the title. */
  description?: string;
  /** Primary CTA, rendered as the filled button. */
  primaryAction?: HeroAction;
  /** Secondary CTA, rendered as an outline button beside the primary one. */
  secondaryAction?: HeroAction;
  /**
   * Background/illustration image. Required for `layout="fullBleed"` (the
   * scrim needs something to sit on top of); optional for `layout="centered"`,
   * where it renders above the text block instead of behind it.
   */
  image?: ImageSource | string | number;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeroScreen
 *
 * Marketing/landing hero block, pitsi-ui block-anatomy style: eyebrow ->
 * display title -> width-constrained description -> primary/secondary CTA
 * row. `layout="centered"` stacks an optional image above the text on a
 * plain background; `layout="fullBleed"` renders the image edge-to-edge with
 * a flat scrim behind the text for readability.
 *
 * @example
 * ```tsx
 * <HeroScreen
 *   layout="centered"
 *   eyebrow="New"
 *   title="Ship your app faster"
 *   description="A production-ready Expo template with auth, theming, and a component library included."
 *   primaryAction={{ label: "Get Started", onPress: () => {} }}
 *   secondaryAction={{ label: "Learn More", onPress: () => {} }}
 * />
 * ```
 */
export function HeroScreen({
  layout = "centered",
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  image,
  style: styleOverride,
}: HeroScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, withAlpha } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const actions = (primaryAction || secondaryAction) && (
    <View style={styles.actions}>
      {primaryAction && (
        <Button size="lg" onPress={primaryAction.onPress} text={primaryAction.label} />
      )}
      {secondaryAction && (
        <Button preset="outline" size="lg" onPress={secondaryAction.onPress} text={secondaryAction.label} />
      )}
    </View>
  );

  if (layout === "fullBleed") {
    return (
      <View style={[styles.fullBleedContainer, styleOverride]}>
        {!!image && <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <View
          style={[
            styles.scrim,
            { backgroundColor: withAlpha(theme.colors.background, theme.dark ? 0.55 : 0.6) },
          ]}
        />
        <View
          style={[
            styles.fullBleedContent,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <SectionHeader align="center" eyebrow={eyebrow} title={title} description={description} />
          {actions}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.centeredContainer, styleOverride]}>
      {!!image && <Image source={image} style={styles.centeredImage} contentFit="cover" />}
      <SectionHeader align="center" eyebrow={eyebrow} title={title} description={description} />
      {actions}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Centered layout
    centeredContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
      gap: spacing.lg,
    },
    centeredImage: {
      width: "100%",
      height: 200,
      borderRadius: spacing.radiusLg,
      marginBottom: spacing.md,
    },

    // Full-bleed layout
    fullBleedContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
    },
    fullBleedContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },

    // Shared
    actions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
  });
