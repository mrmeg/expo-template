import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useTheme, useDimensions } from "@mrmeg/expo-ui/hooks";
import { WebBackButton } from "@/client/features/navigation/WebBackButton";

const isWeb = Platform.OS === "web";
const webHeaderLeft = isWeb
  ? { headerLeft: () => <WebBackButton /> }
  : {};

export default function MainLayout() {
  const { theme } = useTheme();
  // The stack Header sizes its title container as `layout.width - <buttons>`,
  // and `layout` defaults to expo-router's frame — a MODULE-SCOPE constant
  // pinned to {width: 0, height: 0} on web (SafeAreaProviderCompat), which is
  // why SSR shipped `max-width:-68px`. Seeding that module constant per request
  // would leak one request's width into another's layout, so we pass `layout`
  // explicitly instead: render-scoped, and identical on the server and the
  // browser's first render because useDimensions reads the shared cookie/UA
  // signal (see client/features/app/ssrViewportMetrics.ts). After mount it
  // tracks the real viewport, so resize keeps working.
  const { width, height } = useDimensions();

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        // Painted underneath each stack screen. Without this the screen
        // container defaults to white and flashes through on push/pop and
        // during the first frame of a freshly-mounted screen.
        contentStyle: { backgroundColor: theme.colors.background },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        headerBackTitle: "",
        // `layout` is a real Header prop (see the `layout?: Layout` field in
        // expo-router's elements/Header.d.ts) that NativeStackView forwards
        // from `options` via its `...rest` spread, but it isn't declared on
        // NativeStackNavigationOptions — hence the cast. On web it only feeds
        // the title max-width math: getDefaultHeaderHeight ignores width off
        // iOS, so header height is unchanged.
        ...({ layout: { width, height } } as object),
      }}
    >
      {/* The `(tabs)` group uses a native tab bar (see (tabs)/_layout.tsx), so the
          stack header is the only top chrome and shows at every width. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: true, title: "Explore", headerBackTitle: " " }} />
      <Stack.Screen name="(demos)/showcase/index" options={{ title: "UI Components", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/themed-showcase" options={{ title: "Themed Showcase", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/developer" options={{ title: "Developer Tools", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/server-alpha" options={{ title: "Server Alpha", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/server-alpha/[example]" options={{ title: "Server Pattern", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/form-demo" options={{ title: "Form Validation", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/auth-demo" options={{ title: "Auth Demo", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(demos)/detail-hero" options={{ headerShown: false }} />
      <Stack.Screen name="(demos)/screen-settings" options={{ title: "Settings Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-profile" options={{ title: "Profile Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-list" options={{ title: "List Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-pricing" options={{ title: "Pricing Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-welcome" options={{ headerShown: false }} />
      <Stack.Screen name="(demos)/screen-card-grid" options={{ title: "Card Grid Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-chat" options={{ title: "Chat Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-dashboard" options={{ title: "Dashboard Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-form" options={{ title: "Form Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-notifications" options={{ title: "Notifications Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-search" options={{ title: "Search Results Screen", ...webHeaderLeft }} />
      <Stack.Screen name="(demos)/screen-error" options={{ title: "Error Screen", ...webHeaderLeft }} />
    </Stack>
  );
}
