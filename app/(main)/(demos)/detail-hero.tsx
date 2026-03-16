import React from "react";
import { useRouter } from "expo-router";
import { SansSerifText } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { spacing } from "@/client/constants/spacing";
import { DetailHeroScreen } from "@/client/screens/DetailHeroScreen";

export default function DetailHeroDemo() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <DetailHeroScreen
      title="Expo Template"
      subtitle="Production-ready starter kit"
      heroIcon="box"
      onBack={() => router.back()}
      stats={[
        { icon: "star", value: "4.9", label: "Rating" },
        { icon: "download", value: "12K", label: "Downloads" },
        { icon: "users", value: "2.3K", label: "Active Users" },
      ]}
      sections={[
        {
          title: "About",
          content: (
            <>
              <SansSerifText style={{ fontSize: 14, lineHeight: 22, color: theme.colors.mutedForeground, marginBottom: spacing.sm }}>
                A production-ready Expo template with authentication, themed UI components,
                internationalization, and a professional project structure. Built with
                TypeScript, Expo Router, and a carefully crafted design system.
              </SansSerifText>
              <SansSerifText style={{ fontSize: 14, lineHeight: 22, color: theme.colors.mutedForeground }}>
                Includes 20+ reusable components, dark mode support, form validation,
                and navigation patterns — everything you need to ship faster.
              </SansSerifText>
            </>
          ),
        },
      ]}
      features={[
        "Expo Router file-based navigation",
        "Light & dark theme with system detection",
        "20+ themed UI components",
        "i18n with English & Spanish",
        "Zustand state management",
        "TypeScript throughout",
      ]}
      primaryAction={{ label: "Get Started", onPress: () => router.back() }}
      secondaryAction={{ label: "Learn More", onPress: () => router.back() }}
    />
  );
}
