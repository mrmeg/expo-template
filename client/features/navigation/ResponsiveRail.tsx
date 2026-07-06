import { use, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Drawer } from "@mrmeg/expo-ui/components/Drawer";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { SansSerifBoldText } from "@mrmeg/expo-ui/components/StyledText";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { getAppName } from "@/client/lib/identity";
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
  const appName = getAppName();
  const appInitial = appName.charAt(0).toUpperCase() || "A";

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
        <Drawer.Header
          icon={
            <Drawer.ToggleCollapse asChild>
              <Pressable hitSlop={7} style={styles.logoSlot}>
                <View style={styles.logoMark}>
                  <SansSerifBoldText
                    selectable={false}
                    style={styles.logoMarkText}
                  >
                    {appInitial}
                  </SansSerifBoldText>
                </View>
              </Pressable>
            </Drawer.ToggleCollapse>
          }
          title={
            <SansSerifBoldText
              numberOfLines={1}
              selectable={false}
              style={styles.logoWord}
            >
              {appName}
            </SansSerifBoldText>
          }
          action={
            <Drawer.ToggleCollapse asChild>
              <Pressable hitSlop={8} style={styles.collapseButton}>
                <Icon
                  name="sidebar"
                  size={15}
                  color={theme.colors.mutedForeground}
                  decorative
                />
              </Pressable>
            </Drawer.ToggleCollapse>
          }
        />
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
    logoSlot: {
      width: ICON_COLUMN,
      height: spacing.touchTarget,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
    },
    logoMark: {
      width: 30,
      height: 30,
      borderRadius: spacing.radiusLg + 1,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    logoMarkText: {
      color: theme.colors.accentForeground,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: "900",
    },
    logoWord: {
      flexShrink: 1,
      color: theme.colors.foreground,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    collapseButton: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as const } : {}),
    },
    // Match the header's horizontal padding so the row icons share a vertical
    // centerline with the toggle icon (16 + 40 + 16 = 72 = collapsedWidth).
    body: {
      paddingHorizontal: spacing.md,
    },
  });
