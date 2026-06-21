import { useCallback, useState } from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { useDimensions } from "@mrmeg/expo-ui/hooks";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import { spacing } from "@mrmeg/expo-ui/constants";
import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";
import { ResponsiveTabBar } from "@/client/features/navigation/ResponsiveTabBar";
import { ResponsiveRail } from "@/client/features/navigation/ResponsiveRail";
import {
  RailNavStateContext,
  type RailNavState,
} from "@/client/features/navigation/RailNavStateContext";

/**
 * Responsive shell for the main app destinations.
 *
 * One `<Tabs>` navigator owns route state. On narrow screens (`<768`) it shows
 * the standard bottom tab bar; on wide screens (`>=768`) the bottom bar is
 * suppressed and a docked rail renders as an in-flow row sibling, pushing the
 * scene. The rail mirrors and drives the same navigator via `RailNavStateContext`,
 * which the custom tab bar populates. See `client/features/navigation/`.
 */
export default function TabLayout() {
  const { theme } = useTheme();
  const { isSmallScreen } = useDimensions();

  // Live navigator state bridged out of the tab bar so the sibling rail can read
  // the active route and navigate. Null until the tab bar first publishes.
  const [navState, setNavState] = useState<RailNavState | null>(null);
  const handleNavState = useCallback((next: RailNavState) => setNavState(next), []);

  return (
    <RailNavStateContext.Provider value={navState}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {!isSmallScreen && <ResponsiveRail />}
        <View style={{ flex: 1 }}>
          <Tabs
            tabBar={(props) => (
              <ResponsiveTabBar {...props} onNavState={handleNavState} />
            )}
            screenOptions={{
              headerShown: false,
              // Painted underneath each tab's scene. Without this the navigator's
              // scene container defaults to white and shows through during the
              // tab-switch transition (most visible in dark mode).
              sceneStyle: { backgroundColor: theme.colors.background },
              tabBarActiveTintColor: theme.colors.accent,
              tabBarInactiveTintColor: theme.colors.mutedForeground,
              tabBarStyle: {
                backgroundColor: theme.colors.card,
                borderTopColor: theme.colors.border,
                paddingTop: spacing.xs,
                ...(Platform.OS === "ios"
                  ? { height: 85 }
                  : { paddingBottom: spacing.sm }),
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: "500",
              },
            }}
          >
            {NAV_DESTINATIONS.map((destination) => (
              <Tabs.Screen
                key={destination.name}
                name={destination.name}
                options={{
                  title: destination.label,
                  tabBarIcon: ({ color, size }) => (
                    <Icon name={destination.icon} color={color as string} size={size} />
                  ),
                }}
              />
            ))}
          </Tabs>
        </View>
      </View>
    </RailNavStateContext.Provider>
  );
}
