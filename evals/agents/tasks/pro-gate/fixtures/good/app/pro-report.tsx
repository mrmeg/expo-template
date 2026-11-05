import { PaywallGate, useEntitlement } from "@mrmeg/expo-purchases";
import { EmptyState, Screen, SectionHeader, StyledText } from "@mrmeg/expo-ui/components";

function Upsell() {
  const { presentPaywall } = useEntitlement();

  return (
    <EmptyState
      icon="info"
      title="Pro report"
      description="Upgrade to Pro to see your report."
      actionLabel="See plans"
      onAction={() => void presentPaywall()}
    />
  );
}

export default function ProReportScreen() {
  return (
    <PaywallGate feature="pro-report" fallback={<Upsell />}>
      <Screen edges={["bottom"]} scroll>
        <SectionHeader title="Pro report" description="Everything Pro unlocks." />
        <StyledText>Your report is ready.</StyledText>
      </Screen>
    </PaywallGate>
  );
}
