import { Stack } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";

export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: true, title: "Explore", headerBackTitle: " " }} />
      <Stack.Screen name="showcase/index" options={{ title: "UI Components" }} />
      <Stack.Screen name="showcase/buttons" options={{ title: "Buttons" }} />
      <Stack.Screen name="showcase/forms" options={{ title: "Form Controls" }} />
      <Stack.Screen name="showcase/navigation" options={{ title: "Navigation & Menus" }} />
      <Stack.Screen name="showcase/feedback" options={{ title: "Feedback" }} />
      <Stack.Screen name="showcase/typography" options={{ title: "Typography & Icons" }} />
      <Stack.Screen name="showcase/auth-forms" options={{ title: "Auth Forms" }} />
      <Stack.Screen name="developer" options={{ title: "Developer Tools" }} />
      <Stack.Screen name="form-demo" options={{ title: "Form Validation" }} />
      <Stack.Screen name="auth-demo" options={{ title: "Auth Demo" }} />
    </Stack>
  );
}
