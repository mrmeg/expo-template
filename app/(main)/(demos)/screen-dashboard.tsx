import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import {
  DashboardScreen,
  type MetricCard,
  type DashboardSection,
  type ActivityItem,
  type DashboardDateRange,
} from "@/client/screens/DashboardScreen";
import type { Theme } from "@mrmeg/expo-ui/constants";

const METRICS: MetricCard[] = [
  { label: "Revenue", value: "$12,450", trend: "up", trendValue: "+12%", icon: "dollar-sign" },
  { label: "Users", value: "1,234", trend: "up", trendValue: "+8%", icon: "users" },
  { label: "Orders", value: "89", trend: "down", trendValue: "-3%", icon: "shopping-cart" },
  { label: "Conversion", value: "4.2%", trend: "flat", trendValue: "0%", icon: "percent" },
];

const ACTIVITY_FEED: ActivityItem[] = [
  {
    id: "a1",
    icon: "user-plus",
    title: "New user registered",
    description: "emma.wilson@example.com signed up",
    timestamp: "2m ago",
  },
  {
    id: "a2",
    icon: "shopping-cart",
    title: "Order #1042 placed",
    description: "3 items totaling $89.99",
    timestamp: "18m ago",
  },
  {
    id: "a3",
    icon: "credit-card",
    title: "Payment received",
    description: "$249.00 from Acme Corp",
    timestamp: "1h ago",
  },
  {
    id: "a4",
    icon: "alert-triangle",
    title: "Inventory low",
    description: "Widget Pro has 3 units remaining",
    timestamp: "2h ago",
  },
  {
    id: "a5",
    icon: "star",
    title: "New 5-star review",
    description: '"Great product, fast shipping!" - J. Chen',
    timestamp: "4h ago",
  },
];

const DATE_RANGE_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function PlaceholderCard({ text, theme }: { text: string; theme: Theme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.placeholderCard}>
      <SansSerifText style={styles.placeholderText}>{text}</SansSerifText>
    </View>
  );
}

export default function ScreenDashboardDemo() {
  const { theme } = useTheme();
  const [selectedRange, setSelectedRange] = useState("7d");

  const dateRange: DashboardDateRange = {
    options: DATE_RANGE_OPTIONS,
    selected: selectedRange,
    onSelect: setSelectedRange,
  };

  const sections: DashboardSection[] = [
    {
      title: "Top Products",
      viewAllLabel: "View all",
      onViewAll: () => {},
      content: (
        <PlaceholderCard
          text="Product performance breakdown will appear here. Connect your data source to populate this section."
          theme={theme}
        />
      ),
    },
    {
      title: "Customer Insights",
      viewAllLabel: "Details",
      onViewAll: () => {},
      content: (
        <PlaceholderCard
          text="Customer demographics and behavior analytics. Integrate your analytics provider to see real data."
          theme={theme}
        />
      ),
    },
  ];

  return (
    <DashboardScreen
      title="Dashboard"
      metrics={METRICS}
      dateRange={dateRange}
      sections={sections}
      activityFeed={ACTIVITY_FEED}
      activityTitle="Recent Activity"
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    placeholderCard: {
      backgroundColor: theme.colors.card,
      borderRadius: spacing.radiusLg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: spacing.lg,
      minHeight: 80,
      justifyContent: "center",
    },
    placeholderText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedForeground,
    },
  });
