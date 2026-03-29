import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/client/hooks/useTheme";
import { useStaggeredEntrance, STAGGER_DELAY } from "@/client/hooks/useStaggeredEntrance";
import { spacing } from "@/client/constants/spacing";
import { SansSerifText, SansSerifBoldText } from "@/client/components/ui/StyledText";
import { Button } from "@/client/components/ui/Button";
import { Icon } from "@/client/components/ui/Icon";
import type { Theme } from "@/client/constants/colors";
import type { UseFormReturn } from "react-hook-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormStep {
  title: string;
  description?: string;
  /** Field names for per-step validation with trigger() */
  fields: string[];
  content: (form: UseFormReturn<any>) => React.ReactNode;
}

export interface FormScreenProps {
  steps: FormStep[];
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void | Promise<void>;
  showReview?: boolean;
  renderReview?: (data: any) => React.ReactNode;
  submitLabel?: string;
  header?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentStep,
  theme,
}: {
  steps: FormStep[];
  currentStep: number;
  theme: Theme;
}) {
  const styles = createStyles(theme);

  return (
    <View style={styles.stepRow}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={index}>
            {/* Connector line (before each step except the first) */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]}
              />
            )}

            {/* Step circle */}
            <View
              style={[
                styles.stepCircle,
                isCurrent && styles.stepCircleCurrent,
                isCompleted && styles.stepCircleCompleted,
              ]}
            >
              {isCompleted ? (
                <Icon name="check" size={14} color={theme.colors.accentForeground} />
              ) : (
                <SansSerifText
                  style={[
                    styles.stepNumber,
                    isCurrent && styles.stepNumberCurrent,
                  ]}
                >
                  {String(index + 1)}
                </SansSerifText>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormScreen({
  steps,
  form,
  onSubmit,
  showReview = false,
  renderReview,
  submitLabel = "Submit",
  header,
  style: styleOverride,
}: FormScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = steps.length;
  const isReviewStep = showReview && currentStep === totalSteps;
  const isLastFormStep = currentStep === totalSteps - 1;
  const isLastStep = isReviewStep || (!showReview && isLastFormStep);
  const step = isReviewStep ? null : steps[currentStep];

  // Staggered entrance animations
  const indicatorEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: 0 });
  const titleEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY });
  const contentEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 2 });
  const navEntrance = useStaggeredEntrance({ type: "fadeSlideUp", delay: STAGGER_DELAY * 3 });

  const handleNext = async () => {
    if (isReviewStep) {
      // Final submit from review step
      setIsSubmitting(true);
      try {
        await onSubmit(form.getValues());
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!step) return;

    // Validate current step fields
    const valid = await form.trigger(step.fields as any);
    if (!valid) return;

    if (isLastFormStep && !showReview) {
      // Final submit without review
      setIsSubmitting(true);
      try {
        await onSubmit(form.getValues());
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Determine the next/submit button label
  const nextButtonLabel = isLastStep ? submitLabel : "Next";

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }, styleOverride]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        {/* Step indicator */}
        <Animated.View style={indicatorEntrance}>
          <StepIndicator steps={steps} currentStep={currentStep} theme={theme} />
        </Animated.View>

        {/* Step title + description */}
        <Animated.View style={[styles.titleContainer, titleEntrance]}>
          <SansSerifBoldText style={styles.title}>
            {isReviewStep ? "Review" : step?.title}
          </SansSerifBoldText>
          {!isReviewStep && step?.description && (
            <SansSerifText style={styles.description}>
              {step.description}
            </SansSerifText>
          )}
        </Animated.View>

        {/* Step content */}
        <Animated.View style={[styles.contentContainer, contentEntrance]}>
          {isReviewStep && renderReview
            ? renderReview(form.getValues())
            : step?.content(form)}
        </Animated.View>
      </ScrollView>

      {/* Bottom navigation */}
      <Animated.View style={[styles.nav, navEntrance]}>
        {currentStep > 0 ? (
          <Button
            preset="outline"
            onPress={handleBack}
            disabled={isSubmitting}
            style={styles.navButton}
          >
            Back
          </Button>
        ) : (
          <View style={styles.navButton} />
        )}

        <Button
          preset="default"
          onPress={handleNext}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.navButton}
        >
          {nextButtonLabel}
        </Button>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STEP_CIRCLE_SIZE = 32;

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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },

    // Step indicator
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    stepCircle: {
      width: STEP_CIRCLE_SIZE,
      height: STEP_CIRCLE_SIZE,
      borderRadius: STEP_CIRCLE_SIZE / 2,
      backgroundColor: theme.colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    stepCircleCurrent: {
      backgroundColor: theme.colors.primary,
    },
    stepCircleCompleted: {
      backgroundColor: theme.colors.accent,
    },
    stepNumber: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.mutedForeground,
    },
    stepNumberCurrent: {
      color: theme.colors.primaryForeground,
    },
    connector: {
      height: 2,
      flex: 1,
      maxWidth: 48,
      backgroundColor: theme.colors.muted,
      marginHorizontal: spacing.xs,
    },
    connectorCompleted: {
      backgroundColor: theme.colors.accent,
    },

    // Title + description
    titleContainer: {
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.3,
      color: theme.colors.foreground,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.mutedForeground,
      marginTop: spacing.xs,
    },

    // Content
    contentContainer: {
      flex: 1,
    },

    // Navigation
    nav: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      gap: spacing.sm,
    },
    navButton: {
      flex: 1,
    },
  });
