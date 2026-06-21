import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
import type { NavDestination } from "./navDestinations";

interface RailNavItemProps {
  destination: NavDestination;
  active: boolean;
  onPress: () => void;
}

/**
 * A single rail navigation row: icon + label.
 *
 * The label is laid out in the remaining row space and is clipped by the rail
 * panel's `overflow: "hidden"` — so it stays hidden at the collapsed width (72)
 * and reveals as the panel expands (toggle or hover). No knowledge of the rail's
 * expanded state is needed here; width drives visibility. The icon column is a
 * fixed size so it stays put while the label slides in.
 */
export function RailNavItem({ destination, active, onPress }: RailNavItemProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={destination.label}
      style={[
        styles.row,
        active && styles.rowActive,
        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined,
      ]}
    >
      <View style={styles.iconColumn}>
        <Icon
          name={destination.icon}
          size={22}
          color={active ? theme.colors.accent : theme.colors.mutedForeground}
        />
      </View>
      <SansSerifText
        numberOfLines={1}
        style={[styles.label, active && styles.labelActive]}
      >
        {destination.label}
      </SansSerifText>
    </Pressable>
  );
}

/** Fixed icon-column width so the icon stays centered within the collapsed rail. */
const ICON_COLUMN = 40;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: spacing.touchTarget,
      borderRadius: spacing.radiusMd,
      marginBottom: spacing.xs,
      // Clip the label as the rail collapses so it disappears cleanly rather
      // than peeking past the icon column.
      overflow: "hidden",
    },
    rowActive: {
      backgroundColor: theme.colors.muted,
    },
    iconColumn: {
      width: ICON_COLUMN,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      flex: 1,
      // Override RN's default `min-width: auto` so the flex item can shrink to
      // zero at the collapsed width instead of holding its intrinsic text width
      // (which would overflow past the icon column).
      minWidth: 0,
      marginLeft: spacing.xs,
      fontSize: 15,
      color: theme.colors.mutedForeground,
    },
    labelActive: {
      color: theme.colors.foreground,
      fontWeight: "600",
    },
  });
