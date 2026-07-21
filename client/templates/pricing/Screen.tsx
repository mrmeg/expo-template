import React, { useMemo, ReactNode } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { STAGGER_DELAY } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
import type { Theme } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingFeature {
  label: string;
  included: boolean;
}

/**
 * The action a plan's CTA represents. Billing-aware callers derive this
 * from the user's live subscription state; purely decorative callers can
 * omit it and fall back to the highlight-based default ("Get Started" /
 * "Select").
 */
export type PricingPlanActionState =
  | "upgrade"
  | "manage"
  | "current"
  | "downgrade-disabled";

export interface PricingPlan {
  name: string;
  price: string;
  period?: string;
  features: PricingFeature[];
  highlighted?: boolean;
  badge?: string;
  onSelect: () => void;
  /** Stable catalog id. Optional so decorative demos still work. */
  planId?: string;
  /** True when this plan matches the user's current billing summary. */
  isCurrent?: boolean;
  /** Overrides the default CTA label when supplied. */
  actionLabel?: string;
  /** Semantic role of the CTA — lets billing-aware screens pick copy. */
  actionState?: PricingPlanActionState;
  /** When set, the CTA renders as disabled with this reason shown below it. */
  disabledReason?: string;
  /** Shows a spinner on the CTA and blocks taps while true. */
  loading?: boolean;
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
  const styles = useMemo(() => createStyles(theme), [theme]);

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
            <SectionHeader align="center" title={title} description={subtitle} />
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
                  <SansSerifText size="sm" fontWeight="medium">
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
                    <SansSerifBoldText size="lg" style={styles.planName}>{plan.name}</SansSerifBoldText>
                    {plan.badge && (
                      <Badge variant={plan.highlighted ? "default" : "outline"}>
                        {plan.badge}
                      </Badge>
                    )}
                  </View>
                  <View style={styles.priceRow}>
                    <SansSerifBoldText size="display" style={styles.price}>{plan.price}</SansSerifBoldText>
                    {plan.period && (
                      <SansSerifText size="base" style={styles.period}>/{plan.period}</SansSerifText>
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
                        size="base"
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

                {/* CTA. Pass the label via `text` (Button's documented path for
                    plain labels) rather than as a raw string child — a bare string
                    child renders unwrapped inside the Button's <View>, which warns
                    on React Native Web. */}
                <Button
                  preset={plan.isCurrent ? "outline" : plan.highlighted ? "default" : "outline"}
                  fullWidth
                  disabled={plan.isCurrent || Boolean(plan.disabledReason) || plan.loading}
                  loading={plan.loading}
                  onPress={plan.onSelect}
                  text={
                    plan.actionLabel ??
                    (plan.isCurrent
                      ? "Current plan"
                      : plan.highlighted
                        ? "Get Started"
                        : "Select")
                  }
                />
                {plan.disabledReason && !plan.isCurrent && (
                  <SansSerifText size="sm" style={styles.disabledReason}>
                    {plan.disabledReason}
                  </SansSerifText>
                )}
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
    toggleContainer: {
      alignItems: "center",
      paddingVertical: spacing.md,
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
      color: theme.colors.foreground,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    price: {
      color: theme.colors.foreground,
    },
    period: {
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
      color: theme.colors.foreground,
    },
    featureDisabled: {
      color: theme.colors.mutedForeground,
    },
    disabledReason: {
      color: theme.colors.mutedForeground,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    footerContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      alignItems: "center",
    },
  });
