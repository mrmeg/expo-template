import React, { useState } from "react";
import { router } from "expo-router";

import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { PricingScreen, type PricingPlan } from "@/client/screens/PricingScreen";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { globalUIStore } from "@mrmeg/expo-ui/state";
import { isAuthEnabled } from "@/client/features/app";
import Config from "@/client/config";
import {
  FREE_PLAN_ID,
  derivePricingPlan,
  useBillingActions,
  useBillingSummary,
  type BillingActionResult,
  type BillingInterval,
  type BillingProblem,
  type PlanDefinition,
  type PlanDisplay,
} from "@/client/features/billing";

/**
 * Local demo catalog. Adopters replace this with their own catalog
 * (typically the same `PlanDefinition[]` the server reads). The `free`
 * tier intentionally has no Stripe price ids — it is the fallback
 * state, not a plan users "purchase".
 */
const DEMO_CATALOG: readonly PlanDefinition[] = [
  {
    id: "free",
    label: "Free",
    stripePriceIdMonth: null,
    stripePriceIdYear: null,
    features: ["Up to 3 projects", "Basic analytics", "Community support"],
  },
  {
    id: "pro",
    label: "Pro",
    stripePriceIdMonth: "price_demo_pro_month",
    stripePriceIdYear: "price_demo_pro_year",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "Custom domains",
      "Team collaboration",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    stripePriceIdMonth: "price_demo_enterprise_month",
    stripePriceIdYear: "price_demo_enterprise_year",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Dedicated support",
      "Custom domains",
      "Team collaboration",
      "White-label branding",
    ],
  },
];

const PLAN_DISPLAY: Record<string, Record<BillingInterval, PlanDisplay>> = {
  free: {
    month: { price: "$0" },
    year: { price: "$0" },
  },
  pro: {
    month: { price: "$19", highlighted: true, badge: "Popular" },
    year: { price: "$15", highlighted: true, badge: "Save 20%" },
  },
  enterprise: {
    month: { price: "$49" },
    year: { price: "$39", badge: "Save 20%" },
  },
};

export default function ScreenPricingDemo() {
  const { theme } = useTheme();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const authState = useAuthStore((s) => s.state);
  const isAuthenticated = authState === "authenticated";

  const billingQuery = useBillingSummary();
  const summary = billingQuery.data;
  const actions = useBillingActions();

  const billingDisabled = !Config.billingEnabled;

  async function handleAction(
    planId: string,
    action: "upgrade" | "manage",
  ): Promise<void> {
    if (!isAuthEnabled) {
      globalUIStore.getState().show({
        type: "info",
        messages: ["Sign-in is not configured in this environment."],
        duration: 3000,
      });
      return;
    }
    if (!isAuthenticated) {
      globalUIStore.getState().show({
        type: "info",
        messages: ["Sign in to choose a plan."],
        duration: 2500,
      });
      router.push("/(main)/(tabs)/profile");
      return;
    }

    setPendingPlanId(planId);
    try {
      const result: BillingActionResult =
        action === "manage"
          ? await actions.startPortal()
          : await actions.startCheckout({ planId, interval });
      announceResult(result);
    } finally {
      setPendingPlanId(null);
    }
  }

  const plans: PricingPlan[] = DEMO_CATALOG.map((plan) => {
    const display = PLAN_DISPLAY[plan.id]?.[interval] ?? { price: "—" };
    const envDisabledReason =
      billingDisabled && plan.id !== FREE_PLAN_ID
        ? "Billing is not enabled in this environment."
        : undefined;

    const derived = derivePricingPlan({
      plan,
      summary,
      interval,
      display,
      loading: pendingPlanId === plan.id,
      disabledReason: envDisabledReason,
      isAuthenticated,
      onSelect: () => {
        if (derived.isCurrent) return;
        if (derived.actionState === "upgrade" && plan.id === FREE_PLAN_ID) {
          globalUIStore.getState().show({
            type: "info",
            messages: ["You're already on the free plan."],
            duration: 2500,
          });
          return;
        }
        const action =
          derived.actionState === "manage" ||
          derived.actionState === "downgrade-disabled"
            ? "manage"
            : "upgrade";
        void handleAction(plan.id, action);
      },
    });

    return {
      planId: derived.planId,
      name: derived.name,
      price: derived.price,
      period: derived.period,
      features: derived.features,
      highlighted: derived.highlighted,
      badge: derived.badge,
      isCurrent: derived.isCurrent,
      actionLabel: derived.actionLabel,
      actionState: derived.actionState,
      loading: derived.loading,
      disabledReason: derived.disabledReason,
      onSelect: derived.onSelect,
    };
  });

  return (
    <PricingScreen
      title="Choose your plan"
      subtitle={
        billingDisabled
          ? "Billing is disabled in this environment — CTAs are preview-only."
          : "Start free, upgrade when you need more."
      }
      plans={plans}
      periodToggle={{
        options: [
          { value: "month", label: "Monthly" },
          { value: "year", label: "Yearly" },
        ],
        selected: interval,
        onSelect: (value) => setInterval(value === "year" ? "year" : "month"),
      }}
      footer={
        <SansSerifText
          style={{
            fontSize: 13,
            color: theme.colors.mutedForeground,
            textAlign: "center",
          }}
        >
          Subscriptions are processed by Stripe. You can cancel any time from
          your account.
        </SansSerifText>
      }
    />
  );
}

function announceResult(result: BillingActionResult): void {
  if (result.status === "failed" && result.problem) {
    globalUIStore.getState().show({
      type: "error",
      messages: messagesForProblem(result.problem),
      duration: 4000,
    });
    return;
  }
  if (result.status === "cancel") {
    globalUIStore.getState().show({
      type: "info",
      messages: ["Checkout canceled — no charge was made."],
      duration: 2500,
    });
  }
}

function messagesForProblem(problem: BillingProblem): string[] {
  switch (problem.kind) {
  case "unauthorized":
    return ["Sign in to continue."];
  case "billing-disabled":
    return ["Billing isn't enabled in this environment."];
  case "no-customer":
    return ["We couldn't find a Stripe customer for your account yet."];
  case "configuration-missing":
    return [
      "This plan isn't configured for the selected interval.",
      problem.message,
    ].filter((message): message is string => Boolean(message));
  case "unknown-plan":
    return ["This plan isn't available right now."];
  case "billing-conflict":
    return [
      "Your account is linked to multiple Stripe customers — contact support.",
    ];
  case "bad-request":
    return [problem.message || "We couldn't process that request."];
  case "network-error":
    return ["Connection interrupted — please try again."];
  case "server-error":
  default:
    return [problem.message || "Something went wrong. Please try again."];
  }
}
