import { Stack } from "expo-router";
import { useTheme, useDimensions } from "@mrmeg/expo-ui/hooks";
import { MAIN_STACK_SCREENS } from "@/client/features/navigation/mainStackScreens";
import { tabTitleFromRoute, type TabsRouteLike } from "@/client/features/navigation/tabTitle";

export default function MainLayout() {
  const { theme } = useTheme();
  // The stack Header sizes its title container as `layout.width - <buttons>`,
  // and `layout` defaults to expo-router's frame — a MODULE-SCOPE constant
  // pinned to {width: 0, height: 0} on web (SafeAreaProviderCompat), which
  // ships a `max-width:-68px` title container. Passing `layout` explicitly
  // keeps it render-scoped: useDimensions starts from the default viewport and
  // tracks the real one after mount, so resize keeps working.
  const { width, height } = useDimensions();

  return (
    <Stack
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
      {MAIN_STACK_SCREENS.map(({ name, options }) => (
        <Stack.Screen
          key={name}
          name={name}
          // The tab bar draws no header, so this stack header is the tabs'
          // only title: it follows the focused tab instead of the table's
          // fixed "Explore". The table keeps a plain object for the web shell.
          options={
            name === "(tabs)"
              ? ({ route }: { route: TabsRouteLike }) => ({
                ...(options as object),
                title: tabTitleFromRoute(route),
              })
              : options
          }
        />
      ))}
    </Stack>
  );
}
