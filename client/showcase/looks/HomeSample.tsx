import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@mrmeg/expo-ui/components/Avatar";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { StatCard } from "@mrmeg/expo-ui/components/StatCard";
import { StyledText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";

import { useLookDisplay, type SampleScreen } from "./context";
import {
  ActionButton,
  MockTabBar,
  SampleFrame,
  ScreenHeader,
  SectionLabel,
  StatTile,
  ListPanel,
  useCardBlur,
} from "./parts";

const RANGES = ["Day", "Week", "Month"] as const;
type Range = (typeof RANGES)[number];

const STATS: Record<Range, { users: string; usersChange: string; churn: string; churnChange: string }> = {
  Day: { users: "612", usersChange: "+2.1%", churn: "0.3", churnChange: "-0.1%" },
  Week: { users: "2,481", usersChange: "+8.2%", churn: "1.9", churnChange: "-0.4%" },
  Month: { users: "9,874", usersChange: "+12.4%", churn: "4.2", churnChange: "-0.9%" },
};

const UPCOMING = [
  { title: "Design review", detail: "Tomorrow · 10:00", icon: "calendar" },
  { title: "Standup", detail: "Daily · 09:30", icon: "bell" },
  { title: "Weekly report", detail: "Updated 2h ago", icon: "image" },
] as const;

/** The Home sample: header, range control, two metrics, an upcoming list, a primary action, a tab bar. */
export function HomeSample({ framed, onNavigate }: { framed: boolean; onNavigate?: (screen: SampleScreen) => void }) {
  const { theme } = useTheme();
  const display = useLookDisplay();
  const cardBlur = useCardBlur();
  const [range, setRange] = useState<Range>("Week");
  const stats = STATS[range];
  const useTile = !!display.figure;

  return (
    <SampleFrame screen="home" framed={framed}>
      <View style={framed ? styles.fill : undefined}>
        <ScreenHeader
          n={1}
          eyebrow="This week"
          title="Overview"
          trailing={
            <View style={styles.trailing}>
              <Button preset="ghost" size="sm" accessibilityLabel="Notifications" onPress={() => {}}>
                <Icon name="bell" size={20} color="foreground" decorative />
              </Button>
              <Avatar name="Ada Lovelace" size={32} />
            </View>
          }
        />

        <View style={styles.body}>
          <View style={styles.gutter}>
            <SegmentedControl
              values={[...RANGES]}
              value={range}
              onValueChange={(value) => setRange(value as Range)}
              tintColor={display.segmentTint === "primary" ? theme.colors.primary : undefined}
            />
          </View>

          <View style={[styles.gutter, styles.stats]}>
            <View style={styles.stat}>
              {useTile ? (
                <StatTile label="Active users" value={stats.users} change={{ value: stats.usersChange, direction: "up" }} />
              ) : (
                <StatCard
                  label="Active users"
                  value={stats.users}
                  change={{ value: stats.usersChange, direction: "up" }}
                  style={cardBlur}
                />
              )}
            </View>
            <View style={styles.stat}>
              {useTile ? (
                <StatTile label="Churn" value={stats.churn} unit="%" change={{ value: stats.churnChange.replace("-", "−"), direction: "down" }} />
              ) : (
                <StatCard
                  label="Churn"
                  value={stats.churn}
                  unit="%"
                  change={{ value: stats.churnChange.replace("-", "−"), direction: "down" }}
                  style={cardBlur}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={[styles.gutter, styles.sectionHeader]}>
              <SectionLabel n={2}>Upcoming</SectionLabel>
              <Button preset="link" size="sm" accessibilityLabel="See all upcoming" onPress={() => {}}>
                <StyledText selectable={false} size="base" fontWeight="medium" style={{ color: theme.colors.link }}>
                  See all
                </StyledText>
              </Button>
            </View>
            <ListPanel>
              <ItemGroup>
                {UPCOMING.map((row) => (
                  <Item key={row.title} onPress={() => {}} accessibilityLabel={`${row.title}, ${row.detail}`}>
                    <ItemMedia icon={row.icon} size={36} iconSize={18} iconColor="foreground" />
                    <ItemContent>
                      <ItemTitle>{row.title}</ItemTitle>
                      <ItemDescription>{row.detail}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Icon name="chevron-right" size={spacing.iconSm} color="textDim" decorative />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </ListPanel>
          </View>

          <View style={styles.gutter}>
            <ActionButton text="New entry" fullWidth onPress={() => {}} />
          </View>
        </View>

        {framed ? <View style={styles.spacer} /> : <View style={styles.tabGap} />}
        <MockTabBar active="home" onNavigate={onNavigate} />
      </View>
    </SampleFrame>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  trailing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  body: { gap: spacing.lg, paddingTop: spacing.md },
  gutter: { paddingHorizontal: spacing.screenPadding },
  stats: { flexDirection: "row", gap: spacing.smd },
  stat: { flex: 1 },
  section: { gap: spacing.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spacer: { flex: 1 },
  tabGap: { height: spacing.lg },
});
