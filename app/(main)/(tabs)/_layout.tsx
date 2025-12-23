import { Tabs } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";
import { Icon } from "@/client/components/ui/Icon";
import { Home, User, Settings } from "lucide-react-native";
import { Platform } from "react-native";
import { spacing } from "@/client/constants/spacing";

/**
 * Tab navigator for main app screens.
 */
export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.foreground,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingTop: spacing.xs,
          ...(Platform.OS === "ios" && { height: 85 }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Icon as={Home} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Icon as={User} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Icon as={Settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
