import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  OnboardingFlow,
  type OnboardingPage,
} from "@/client/features/onboarding/OnboardingFlow";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";
import { useTheme } from "@/client/hooks/useTheme";
import type { Theme } from "@/client/constants/colors";

const PAGES: OnboardingPage[] = [
  {
    icon: "compass",
    title: "Explore Templates",
    description:
      "Start with a solid foundation. This template includes navigation, theming, and authentication — all ready to go.",
  },
  {
    icon: "layers",
    title: "Built-In Components",
    description:
      "Buttons, forms, modals, and more. Every component follows a consistent design system and supports light & dark mode.",
  },
  {
    icon: "zap",
    title: "Ship Faster",
    description:
      "Stop rebuilding the basics. Focus on what makes your app unique and get to market faster.",
  },
];

/**
 * First-launch onboarding rendered inline above the main Stack by
 * `app/_layout.tsx`. Owning this at the shell means the user never flashes
 * into the main tabs before the onboarding decision is known.
 *
 * The demo route at `app/(main)/(demos)/onboarding.tsx` continues to use the
 * same OnboardingFlow primitive for showcase purposes.
 */
export function OnboardingGate() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const setHasSeenOnboarding = useOnboardingStore((s) => s.setHasSeenOnboarding);

  const handleComplete = () => setHasSeenOnboarding(true);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OnboardingFlow
        pages={PAGES}
        onComplete={handleComplete}
        onSkip={handleComplete}
        doneLabel="Get Started"
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
