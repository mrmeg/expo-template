import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme, useDimensions } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { BodyText, SansSerifBoldText, SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Card } from "@mrmeg/expo-ui/components/Card";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Testimonial {
  quote: string;
  name: string;
  role?: string;
  /** 1-5 star rating. Omit to hide the star row. */
  rating?: number;
}

export interface TestimonialsScreenProps {
  eyebrow?: string;
  title: string;
  description?: string;
  testimonials: Testimonial[];
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TestimonialsScreen
 *
 * `SectionHeader` followed by a horizontally scrollable, snap-to-card row of
 * testimonials: quote, an initials avatar + name/role, and an optional star
 * rating.
 *
 * @example
 * ```tsx
 * <TestimonialsScreen
 *   eyebrow="Testimonials"
 *   title="Loved by teams everywhere"
 *   testimonials={[
 *     { quote: "This cut our setup time from days to hours.", name: "Jamie Lee", role: "CTO, Acme", rating: 5 },
 *   ]}
 * />
 * ```
 */
export function TestimonialsScreen({
  eyebrow,
  title,
  description,
  testimonials,
  style: styleOverride,
}: TestimonialsScreenProps) {
  const { theme } = useTheme();
  const { width: windowWidth } = useDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardWidth = Math.round(windowWidth * 0.8);

  return (
    <View style={[styles.container, styleOverride]}>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} style={styles.header} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
      >
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name + testimonial.quote} style={[styles.card, { width: cardWidth }]}>
            {!!testimonial.rating && (
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={spacing.iconSm}
                    color={i < testimonial.rating! ? theme.colors.warning : theme.colors.border}
                    decorative
                  />
                ))}
              </View>
            )}

            <BodyText style={styles.quote}>&ldquo;{testimonial.quote}&rdquo;</BodyText>

            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <SansSerifBoldText size="sm" style={styles.avatarText}>
                  {getInitials(testimonial.name)}
                </SansSerifBoldText>
              </View>
              <View style={styles.authorInfo}>
                <SansSerifBoldText size="base">{testimonial.name}</SansSerifBoldText>
                {!!testimonial.role && (
                  <SansSerifText size="sm" style={styles.role}>{testimonial.role}</SansSerifText>
                )}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 40;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingVertical: spacing.xl,
    },
    header: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    card: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    starsRow: {
      flexDirection: "row",
      gap: spacing.xxs,
    },
    quote: {
      color: theme.colors.foreground,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: spacing.radiusFull,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: theme.colors.accentForeground,
    },
    authorInfo: {
      flex: 1,
    },
    role: {
      color: theme.colors.textDim,
    },
  });
