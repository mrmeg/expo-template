/**
 * Shared return screen for hosted Stripe flows.
 *
 * Invoked when the browser redirects back to `/billing/return?status=...`
 * after Checkout or Billing Portal. Its only job is to:
 *
 *   1. Invalidate the billing summary query so it refetches from the
 *      authoritative server state.
 *   2. Show a brief status message while the UI settles.
 *   3. Route the user back to the pricing screen (cancel/portal) or the
 *      profile tab (success).
 *
 * The query param is a UX hint, not proof of payment — the webhook is
 * the source of truth, and this screen never mutates state based on it.
 */

import { useMemo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";

import { SansSerifText, SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import { billingSummaryQueryKey } from "@/client/features/billing";

export default function BillingReturnScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const userId = useAuthStore((s) => s.user?.userId ?? null);

  const normalizedStatus = normalizeStatus(status);

  useEffect(() => {
    queryClient.invalidateQueries({
      queryKey: billingSummaryQueryKey(userId),
    });
  }, [queryClient, userId]);

  const copy = statusToCopy(normalizedStatus);

  const handleDone = () => {
    if (normalizedStatus === "success") {
      router.replace("/(main)/(tabs)/profile");
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon
          name={copy.icon}
          size={40}
          color={copy.iconColor(theme)}
        />
      </View>
      <SansSerifBoldText style={styles.title}>{copy.title}</SansSerifBoldText>
      <SansSerifText style={styles.subtitle}>{copy.subtitle}</SansSerifText>
      <Button preset="default" onPress={handleDone} style={styles.cta}>
        {copy.cta}
      </Button>
    </View>
  );
}

type NormalizedStatus = "success" | "cancel" | "portal" | "unknown";

function normalizeStatus(raw: string | string[] | undefined): NormalizedStatus {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "success" || value === "cancel" || value === "portal") return value;
  return "unknown";
}

function statusToCopy(status: NormalizedStatus) {
  switch (status) {
  case "success":
    return {
      icon: "check-circle" as const,
      iconColor: (theme: Theme) => theme.colors.success,
      title: "Processing your subscription",
      subtitle:
          "We're confirming your payment. Your plan will update as soon as Stripe sends us the final receipt.",
      cta: "Go to account",
    };
  case "cancel":
    return {
      icon: "x-circle" as const,
      iconColor: (theme: Theme) => theme.colors.mutedForeground,
      title: "Checkout canceled",
      subtitle: "No charge was made. You can choose a different plan at any time.",
      cta: "Back to pricing",
    };
  case "portal":
    return {
      icon: "arrow-left" as const,
      iconColor: (theme: Theme) => theme.colors.foreground,
      title: "Back in the app",
      subtitle:
          "Any changes you made are being applied. Your plan will refresh automatically.",
      cta: "Continue",
    };
  case "unknown":
  default:
    return {
      icon: "info" as const,
      iconColor: (theme: Theme) => theme.colors.mutedForeground,
      title: "You're back",
      subtitle: "Your billing information is being refreshed.",
      cta: "Continue",
    };
  }
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    iconWrap: {
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 22,
      color: theme.colors.foreground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedForeground,
      textAlign: "center",
      maxWidth: 320,
      lineHeight: 20,
    },
    cta: {
      marginTop: spacing.lg,
      minWidth: 200,
    },
  });
