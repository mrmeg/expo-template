import { Stack } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";

/**
 * Showcase section layout - stack navigator for component category pages.
 */
export default function ShowcaseLayout() {
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
        name="index"
        options={{
          title: "UI Components",
        }}
      />
      <Stack.Screen
        name="buttons"
        options={{
          title: "Buttons",
        }}
      />
      <Stack.Screen
        name="forms"
        options={{
          title: "Form Controls",
        }}
      />
      <Stack.Screen
        name="navigation"
        options={{
          title: "Navigation & Menus",
        }}
      />
      <Stack.Screen
        name="feedback"
        options={{
          title: "Feedback",
        }}
      />
      <Stack.Screen
        name="typography"
        options={{
          title: "Typography & Icons",
        }}
      />
      <Stack.Screen
        name="auth-forms"
        options={{
          title: "Auth Forms",
        }}
      />
    </Stack>
  );
}
