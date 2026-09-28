import { useCallback } from "react";
import { useFocusEffect, useNavigation } from "expo-router";

import { NAV_DESTINATIONS, type NavDestinationName } from "./navDestinations";

const DEFAULT_TAB = NAV_DESTINATIONS[0];

/** The header title for a tab: its `NAV_DESTINATIONS` label, Explore for anything unknown. */
export function tabTitleFor(name: string | undefined): string {
  return NAV_DESTINATIONS.find((destination) => destination.name === name)?.label ?? DEFAULT_TAB.label;
}

/**
 * Sets the parent stack's header title to this tab's label whenever the tab is
 * focused. The native tab bar (`NativeTabs`) draws no header, so the stack's
 * `(tabs)` screen header is the only top chrome; its table entry starts at
 * "Explore" (the tab the app opens on) and the nested navigator's state does
 * not reach the stack's `options` callback, so each tab screen sets the title
 * itself. Web hides that header (`WEB_SHELL_ALWAYS_HEADERLESS`), where this is
 * harmless.
 */
export function useTabHeaderTitle(name: NavDestinationName): void {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: tabTitleFor(name) });
    }, [navigation, name]),
  );
}
