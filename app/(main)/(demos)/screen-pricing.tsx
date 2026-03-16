import React, { useState } from "react";
import { Alert, Platform } from "react-native";
import { SansSerifText } from "@/client/components/ui/StyledText";
import { useTheme } from "@/client/hooks/useTheme";
import { PricingScreen, type PricingPlan } from "@/client/screens/PricingScreen";

const MONTHLY_PLANS: PricingPlan[] = [
  {
    name: "Free",
    price: "$0",
    period: "month",
    features: [
      { label: "Up to 3 projects", included: true },
      { label: "Basic analytics", included: true },
      { label: "Community support", included: true },
      { label: "Custom domains", included: false },
      { label: "Priority support", included: false },
      { label: "Team collaboration", included: false },
    ],
    onSelect: () => {},
  },
  {
    name: "Pro",
    price: "$19",
    period: "month",
    badge: "Popular",
    highlighted: true,
    features: [
      { label: "Unlimited projects", included: true },
      { label: "Advanced analytics", included: true },
      { label: "Priority support", included: true },
      { label: "Custom domains", included: true },
      { label: "Team collaboration", included: true },
      { label: "White-label branding", included: false },
    ],
    onSelect: () => {},
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "month",
    features: [
      { label: "Unlimited projects", included: true },
      { label: "Advanced analytics", included: true },
      { label: "Dedicated support", included: true },
      { label: "Custom domains", included: true },
      { label: "Team collaboration", included: true },
      { label: "White-label branding", included: true },
    ],
    onSelect: () => {},
  },
];

const YEARLY_PLANS: PricingPlan[] = MONTHLY_PLANS.map((plan) => ({
  ...plan,
  price: plan.price === "$0" ? "$0" : plan.price === "$19" ? "$15" : "$39",
  period: "month",
  badge: plan.badge === "Popular" ? "Popular" : plan.price !== "$0" ? "Save 20%" : undefined,
}));

export default function ScreenPricingDemo() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState("monthly");

  const showAlert = (msg: string) => {
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert(msg);
    }
  };

  const plans = (period === "monthly" ? MONTHLY_PLANS : YEARLY_PLANS).map((plan) => ({
    ...plan,
    onSelect: () => showAlert(`Selected ${plan.name} (${period})`),
  }));

  return (
    <PricingScreen
      title="Choose your plan"
      subtitle="Start free, upgrade when you need more."
      plans={plans}
      periodToggle={{
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ],
        selected: period,
        onSelect: setPeriod,
      }}
      footer={
        <SansSerifText style={{ fontSize: 13, color: theme.colors.mutedForeground, textAlign: "center" }}>
          All plans include a 14-day free trial. No credit card required.
        </SansSerifText>
      }
    />
  );
}
