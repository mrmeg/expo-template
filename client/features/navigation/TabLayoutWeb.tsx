import { Stack } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";

import { NAV_DESTINATIONS } from "@/client/features/navigation/navDestinations";

/**
 * Web `(tabs)` layout. The drawer shell (WebNavShell, mounted by the parent
 * `(main)` web layout) replaces tab-style navigation on web, so the group
 * renders a plain headerless stack instead of `NativeTabs` — otherwise the
 * CSS tab-bar fallback would sit inside the shell as a second, competing nav.
 * Native keeps `_layout.tsx` (the real tab bar) untouched.
 *
 * `title` still feeds the document title on web even with the header hidden.
 */
export default function TabLayoutWeb() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {NAV_DESTINATIONS.map((destination) => (
        <Stack.Screen
          key={destination.name}
          name={destination.name}
          options={{ title: destination.label }}
        />
      ))}
    </Stack>
  );
}
