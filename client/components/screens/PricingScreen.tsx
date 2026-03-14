import React, { ReactNode } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@/client/components/ui/AnimatedView";
import { useTheme } from "@/client/hooks/useTheme";
import { STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Badge } from "@/client/components/ui/Badge";
import { Icon } from "@/client/components/ui/Icon";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/ToggleGroup";
import type { Theme } from "@/client/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingFeature {
  label: string;
  included: boolean;
}

export interface PricingPlan {
  name: string;
  price: string;
  period?: string;
  features: PricingFeature[];
  highlighted?: boolean;
  badge?: string;
  onSelect: () => void;
}

export interface PricingPeriodToggle {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

export interface PricingScreenProps {
  title?: string;
  subtitle?: string;
  plans: PricingPlan[];
  periodToggle?: PricingPeriodToggle;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PricingScreen({
  title = "Choose your plan",
  subtitle,
  plans,
  periodToggle,
  footer,
  style: styleOverride,
}: PricingScreenProps) {
  const { theme, getShadowStyle } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <AnimatedView type="fadeSlideUp" delay={0}>
          <View style={styles.header}>
            <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
            {subtitle && (
              <SansSerifText style={styles.subtitle}>{subtitle}</SansSerifText>
            )}
          </View>
        </AnimatedView>

        {/* Period Toggle */}
        {periodToggle && (
          <View style={styles.toggleContainer}>
            <ToggleGroup
              type="single"
              value={periodToggle.selected}
              onValueChange={(value) => {
                if (value) periodToggle.onSelect(value);
              }}
              variant="outline"
            >
              {periodToggle.options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  <SansSerifText style={styles.toggleLabel}>
                    {option.label}
                  </SansSerifText>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </View>
        )}

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan, index) => (
            <AnimatedView
              key={plan.name}
              type="fadeSlideUp"
              delay={STAGGER_DELAY * (3 + index)}
            >
            <View
              style={[
                styles.planCard,
                getShadowStyle("subtle"),
                plan.highlighted && styles.planHighlighted,
              ]}
            >
              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <SansSerifBoldText style={styles.planName}>{plan.name}</SansSerifBoldText>
                  {plan.badge && (
                    <Badge variant={plan.highlighted ? "default" : "outline"}>
                      {plan.badge}
                    </Badge>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <SansSerifBoldText style={styles.price}>{plan.price}</SansSerifBoldText>
                  {plan.period && (
                    <SansSerifText style={styles.period}>/{plan.period}</SansSerifText>
                  )}
                </View>
              </View>

              {/* Features */}
              <View style={styles.featuresList}>
                {plan.features.map((feature) => (
                  <View key={feature.label} style={styles.featureRow}>
                    <Icon
                      name={feature.included ? "check" : "x"}
                      size={16}
                      color={
                        feature.included
                          ? theme.colors.accent
                          : theme.colors.mutedForeground
                      }
                    />
                    <SansSerifText
                      style={[
                        styles.featureLabel,
                        !feature.included && styles.featureDisabled,
                      ]}
                    >
                      {feature.label}
                    </SansSerifText>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <Button
                preset={plan.highlighted ? "default" : "outline"}
                fullWidth
                onPress={plan.onSelect}
              >
                {plan.highlighted ? "Get Started" : "Select"}
              </Button>
            </View>
            </AnimatedView>
          ))}
        </View>

        {/* Footer */}
        {footer && <View style={styles.footerContainer}>{footer}</View>}
      </ScrollView>
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
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    header: {
      alignItems: "center",
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.5,
      color: theme.colors.foreground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.xs,
      lineHeight: 22,
    },
    toggleContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: "500",
    },
    plansContainer: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    planCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.lg,
    },
    planHighlighted: {
      borderColor: theme.colors.accent,
      borderWidth: 2,
    },
    planHeader: {
      marginBottom: spacing.md,
    },
    planNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    planName: {
      fontSize: 18,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    price: {
      fontSize: 36,
      lineHeight: 44,
      letterSpacing: -0.75,
      color: theme.colors.foreground,
    },
    period: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      marginLeft: spacing.xxs,
    },
    featuresList: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    featureLabel: {
      fontSize: 14,
      color: theme.colors.foreground,
      lineHeight: 20,
    },
    featureDisabled: {
      color: theme.colors.mutedForeground,
    },
    footerContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      alignItems: "center",
    },
  });
