import type { ComponentProps } from "react";
import type Feather from "@expo/vector-icons/Feather";
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

/**
 * Icon names that exist in both families. The rail draws destinations with
 * `Icon` (Lucide SVG); the native tab bar draws them with
 * `NativeTabs.Trigger.VectorIcon`, which needs an icon *font*, so it stays on
 * `@expo/vector-icons/Feather`. Lucide is a superset of Feather in the same
 * style, so any name in this intersection renders identically on both.
 */
export type NavIconName = Extract<IconName, ComponentProps<typeof Feather>["name"]>;

export interface NavDestination {
  /** Route key inside the `(tabs)` navigator. */
  name: NavDestinationName;
  /** Display label — matches the current `Tabs.Screen` title. */
  label: string;
  /**
   * Icon name from `@mrmeg/expo-ui/components/Icon` (Lucide). The native tab
   * bar draws the same name through `@expo/vector-icons/Feather`
   * (`NativeTabs.Trigger.VectorIcon` needs a font family), so a destination
   * icon must exist in both sets; the intersection makes a name that only one
   * of them knows a type error here instead of a blank tab glyph.
   */
  icon: NavIconName;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { name: "index", label: "Explore", icon: "compass" },
  { name: "media", label: "Media", icon: "image" },
  { name: "profile", label: "Profile", icon: "user" },
  { name: "settings", label: "Settings", icon: "settings" },
] as const;
