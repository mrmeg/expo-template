import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { Card } from "./Card";
import { CaptionText, StyledText } from "./StyledText";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "../hooks/useTheme";
import { spacing } from "../constants/spacing";

export type StatChangeDirection = "up" | "down" | "neutral";

export interface StatCardChange {
  /** Signed change text, e.g. "+12.5%" or "-3 orders". */
  value: string;
  /** Visual direction — drives color and (for up/down) a trend icon. */
  direction: StatChangeDirection;
}

export interface StatCardProps {
  /** Small uppercase label describing the stat. */
  label: string;
  /** The headline stat value. */
  value: string | number;
  /** Optional unit suffix rendered smaller and muted next to the value. */
  unit?: string;
  /** Optional signed change line below the value. */
  change?: StatCardChange;
  /** Optional leading icon name (Feather), rendered beside the label. */
  icon?: IconName;
  /** Makes the card pressable with scale feedback (delegates to Card). */
  onPress?: () => void;
  /** Custom style override for the outer card. */
  style?: StyleProp<ViewStyle>;
}

// Only "up"/"down" get a directional trend icon — "neutral" is text-only.
const DIRECTION_ICON: Record<"up" | "down", IconName> = {
  up: "trending-up",
  down: "trending-down",
};

/**
 * StatCard
 *
 * Dashboard stat idiom: a tiny uppercase tracked label, a large
 * tabular-nums value (with an optional muted unit suffix), and an optional
 * signed change line (success/destructive/muted by direction). Builds on
 * `Card` for the container, default shadow, and press feedback.
 *
 * @example
 * ```tsx
 * <StatCard
 *   label="Revenue"
 *   value="48.2"
 *   unit="k"
 *   change={{ value: "+12.5%", direction: "up" }}
 * />
 * ```
 */
export function StatCard({ label, value, unit, change, icon, onPress, style }: StatCardProps) {
  const { theme } = useTheme();

  const changeColor = !change
    ? undefined
    : change.direction === "up"
      ? theme.colors.success
      : change.direction === "down"
        ? theme.colors.destructive
        : theme.colors.textDim;

  return (
    <Card onPress={onPress} style={style}>
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {/* Tracking matches the EyebrowText overline treatment (+0.08em @ 12px). */}
          <CaptionText
            selectable={false}
            style={{ color: theme.colors.textDim, textTransform: "uppercase", letterSpacing: 0.96 }}
          >
            {label}
          </CaptionText>
          {!!icon && <Icon name={icon} size={spacing.iconSm} color={theme.colors.mutedForeground} decorative />}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <StyledText
            selectable={false}
            size="xxl"
            fontWeight="bold"
            style={{ color: theme.colors.foreground, fontVariant: ["tabular-nums"] }}
          >
            {value}
          </StyledText>
          {!!unit && (
            <StyledText
              selectable={false}
              size="base"
              style={{ color: theme.colors.textDim, marginLeft: spacing.xxs, marginBottom: 2 }}
            >
              {unit}
            </StyledText>
          )}
        </View>

        {!!change && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
            {change.direction !== "neutral" && (
              <Icon
                name={DIRECTION_ICON[change.direction]}
                size={spacing.iconXs}
                color={changeColor}
                decorative
              />
            )}
            <StyledText selectable={false} size="sm" style={{ color: changeColor }}>
              {change.value}
            </StyledText>
          </View>
        )}
      </View>
    </Card>
  );
}
