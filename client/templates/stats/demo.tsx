import React from "react";
import { StatsScreen, type StatsMetric } from "./Screen";

const METRICS: StatsMetric[] = [
  { label: "Revenue", value: "48.2", unit: "k", change: { value: "+12.5%", direction: "up" } },
  { label: "Active Users", value: "9,842", change: { value: "+4.1%", direction: "up" } },
  { label: "Churn Rate", value: "2.3", unit: "%", change: { value: "-0.4%", direction: "down" } },
  { label: "Avg. Session", value: "6m 12s", change: { value: "+18s", direction: "up" } },
  { label: "Support Tickets", value: "128", change: { value: "+9", direction: "up" } },
  { label: "Uptime", value: "99.98", unit: "%", change: { value: "steady", direction: "neutral" } },
];

export default function ScreenStatsDemo() {
  return (
    <StatsScreen
      eyebrow="By the numbers"
      title="Trusted at scale"
      description="A snapshot of platform health across the last 30 days."
      stats={METRICS}
      footerNote="Updated daily at midnight UTC."
    />
  );
}
