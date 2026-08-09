import { Stack } from "expo-router";
import { useTheme, useDimensions } from "@mrmeg/expo-ui/hooks";

import {
  MAIN_STACK_SCREENS,
  WEB_SHELL_ALWAYS_HEADERLESS,
  WEB_SHELL_RAIL_HEADERLESS,
  type MainStackScreen,
} from "@/client/features/navigation/mainStackScreens";
import { WebNavShell, WEB_NAV_RAIL_WIDTH } from "@/client/features/navigation/WebNavShell";

/**
 * Web `(main)` layout: the same stack as `MainLayout.tsx` (same shared screen
 * list, same header/`layout` fixes — see the comments there), wrapped in the
 * drawer navigation shell. Metro's platform resolution picks this file on web
 * via `app/(main)/_layout.web.tsx`; native never bundles it.
 *
 * Header policy on web (see `mainStackScreens.tsx`):
 * - `(tabs)` is headerless at every width — the rail or the shell top bar is
 *   its chrome.
 * - The three gallery indexes are headerless only beside the rail; below the
 *   breakpoint their header still carries the title + back affordance.
 * - Deeper screens keep their headers everywhere.
 */
export default function WebMainLayout() {
  const { theme } = useTheme();
  const { width, height, isLargeScreen } = useDimensions();

  // The stack renders inside the shell's content pane, which is the viewport
  // minus the rail — feed the header's title-width math the pane, not the
  // window (see MainLayout.tsx for why `layout` is passed at all).
  const paneWidth = isLargeScreen ? width - WEB_NAV_RAIL_WIDTH : width;

  const optionsFor = ({ name, options }: MainStackScreen) => {
    const headerless =
      WEB_SHELL_ALWAYS_HEADERLESS.has(name) ||
      (isLargeScreen && WEB_SHELL_RAIL_HEADERLESS.has(name));
    return headerless ? { ...options, headerShown: false } : options;
  };

  return (
    <WebNavShell>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.foreground,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
          headerBackTitle: "",
          ...({ layout: { width: paneWidth, height } } as object),
        }}
      >
        {MAIN_STACK_SCREENS.map((screen) => (
          <Stack.Screen key={screen.name} name={screen.name} options={optionsFor(screen)} />
        ))}
      </Stack>
    </WebNavShell>
  );
}
