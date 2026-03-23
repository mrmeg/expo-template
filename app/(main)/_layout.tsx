import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@/client/hooks/useTheme";
import { WebBackButton } from "@/client/features/navigation/WebBackButton";

const isWeb = Platform.OS === "web";
const webHeaderLeft = isWeb
  ? { headerLeft: () => <WebBackButton /> }
  : {};

export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: true, title: "Explore", headerBackTitle: " " }} />
      <Stack.Screen name="(demos)/showcase/index" options={{ title: "UI Components", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/developer" options={{ title: "Developer Tools", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/form-demo" options={{ title: "Form Validation", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/auth-demo" options={{ title: "Auth Demo", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(demos)/detail-hero" options={{ headerShown: false }} />
      <Stack.Screen name="(demos)/screen-settings" options={{ title: "Settings Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-profile" options={{ title: "Profile Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-list" options={{ title: "List Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-pricing" options={{ title: "Pricing Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
