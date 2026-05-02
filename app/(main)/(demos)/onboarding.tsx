import React from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingFlow, type OnboardingPage } from "@/client/features/onboarding/OnboardingFlow";
import { useOnboardingStore } from "@/client/features/onboarding/onboardingStore";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import type { Theme } from "@mrmeg/expo-ui/constants";

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

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const setHasSeenOnboarding = useOnboardingStore((s) => s.setHasSeenOnboarding);

  const handleComplete = () => {
    setHasSeenOnboarding(true);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
