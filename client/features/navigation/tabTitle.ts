import { NAV_DESTINATIONS } from "./navDestinations";

/** The slice of a React Navigation route the header needs: the nested tab state. */
export interface TabsRouteLike {
  state?: { index?: number; routes?: { name: string }[] };
  params?: { screen?: unknown };
}

const DEFAULT_TAB = NAV_DESTINATIONS[0];

/**
 * The header title for the `(tabs)` stack screen: the focused tab's label.
 *
 * The native tab bar (`NativeTabs`) draws no header, so the parent stack's is
 * the only top chrome; a fixed title labelled Profile, Media and Settings
 * "Explore". The nested navigator's state names the focused tab once it has
 * mounted; before that a `params.screen` deep link may name it; otherwise the
 * first destination (Explore) is what the app opens on.
 */
export function tabTitleFromRoute(route: TabsRouteLike | undefined): string {
  const focused = focusedTabName(route);
  return NAV_DESTINATIONS.find((destination) => destination.name === focused)?.label ?? DEFAULT_TAB.label;
}

function focusedTabName(route: TabsRouteLike | undefined): string | undefined {
  const state = route?.state;
  if (state?.routes && state.routes.length > 0) {
    return state.routes[state.index ?? state.routes.length - 1]?.name;
  }
  const screen = route?.params?.screen;
  return typeof screen === "string" ? screen : undefined;
}
