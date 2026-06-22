import { use, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Drawer } from "@mrmeg/expo-ui/components/Drawer";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { NAV_DESTINATIONS } from "./navDestinations";
import { RailNavItem } from "./RailNavItem";
import { RailNavStateContext } from "./RailNavStateContext";

/**
 * Wide-screen primary navigation: a collapsible rail docked on the left.
 *
 * Renders as a row sibling of the `<Tabs>` navigator (see `(tabs)/_layout.tsx`)
 * and reflects/drives the same navigator state via {@link RailNavStateContext}.
 * It does not own route state — `navigation.navigate(name)` targets the existing
 * navigator, and the active highlight reads `state.routes[state.index].name`.
 *
 * On web the rail peeks open on hover (`expandOnHover`); on native there's no
 * pointer, so `Drawer.ToggleCollapse` in the header provides an explicit toggle.
 */
export function ResponsiveRail() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navState = use(RailNavStateContext);

  // First wide frame before the tab bar publishes navigator state: render the
  // rail with no active highlight and inert rows rather than crash.
  const activeName = navState
    ? navState.state.routes[navState.state.index]?.name
    : undefined;

  return (
    <Drawer
      variant="rail"
      side="left"
      collapsedWidth={72}
      expandedWidth={240}
      expandOnHover
    >
      {/* Full-height rail: it owns the top inset (the stack header is suppressed
          on wide screens, see MainLayout), so Drawer.Content keeps its default
          insets.top and the rail spans the whole window height. */}
      <Drawer.Content style={styles.content}>
        <Drawer.Header style={styles.header}>
          <Drawer.ToggleCollapse>
            <View style={styles.brand}>
              <Icon name="menu" size={22} color={theme.colors.foreground} />
            </View>
          </Drawer.ToggleCollapse>
        </Drawer.Header>
        <Drawer.Body style={styles.body}>
          {NAV_DESTINATIONS.map((destination) => (
            <RailNavItem
              key={destination.name}
              destination={destination}
              active={destination.name === activeName}
              onPress={() => navState?.navigation.navigate(destination.name)}
            />
          ))}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

const ICON_COLUMN = 40;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      backgroundColor: theme.colors.card,
    },
    header: {
      paddingHorizontal: spacing.md,
    },
    // Match RailNavItem's icon column so the toggle icon lines up with the rows.
    brand: {
      width: ICON_COLUMN,
      height: spacing.touchTarget,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null),
    },
    // Match the header's horizontal padding so the row icons share a vertical
    // centerline with the toggle icon (16 + 40 + 16 = 72 = collapsedWidth).
    body: {
      paddingHorizontal: spacing.md,
    },
  });
