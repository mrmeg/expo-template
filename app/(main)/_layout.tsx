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
      <Stack.Screen name="developer" options={{ title: "Developer Tools" }} />
      <Stack.Screen name="form-demo" options={{ title: "Form Validation" }} />
      <Stack.Screen name="auth-demo" options={{ title: "Auth Demo" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="detail-hero" options={{ headerShown: false }} />
    </Stack>
  );
}
