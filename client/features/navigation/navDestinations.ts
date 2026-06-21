import type { IconName } from "@mrmeg/expo-ui/components/Icon";

/**
 * Shared primary navigation destinations.
 *
 * Single source of truth for the app's top-level routes, consumed by both the
 * bottom tab bar (narrow screens) and the rail drawer (wide screens). Keeping
 * the list here — rather than inline in `(tabs)/_layout.tsx` — means the rail
 * and the tabs never drift apart.
 *
 * `name` is the Expo Router / React Navigation route key inside the `(tabs)`
 * group, so it works directly as `<Tabs.Screen name>`, for `navigation.navigate(name)`,
 * and for the active-route comparison (`state.routes[state.index].name`) — no
 * path translation needed.
 *
 * Deliberately separate from the screen-template registry
 * (`client/showcase/registry.ts`): these are app destinations, not browseable
 * templates.
 */

export type NavDestinationName = "index" | "media" | "profile" | "settings";

export interface NavDestination {
  /** Route key inside the `(tabs)` navigator. */
  name: NavDestinationName;
  /** Display label — matches the current `Tabs.Screen` title. */
  label: string;
  /** Feather icon name from `@mrmeg/expo-ui/components/Icon`. */
  icon: IconName;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { name: "index", label: "Explore", icon: "compass" },
  { name: "media", label: "Media", icon: "image" },
  { name: "profile", label: "Profile", icon: "user" },
  { name: "settings", label: "Settings", icon: "settings" },
] as const;
