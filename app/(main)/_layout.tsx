import { Stack } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";

/**
 * Main app layout.
 */
export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: {
          fontWeight: "600",
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="showcase"
        options={{
          title: "UI Components",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="developer"
        options={{
          title: "Developer Tools",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="form-demo"
        options={{
          title: "Form Validation",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
