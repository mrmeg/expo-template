import { createContext } from "react";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";

/**
 * Bridge that carries the live `(tabs)` navigator state out to the rail.
 *
 * The rail renders as a row sibling of the `<Tabs>` navigator, so it sits
 * *outside* the navigator's own React context and can't read `state` /
 * `navigation` directly. The custom tab bar (`ResponsiveTabBar`) does receive
 * them — they're part of `BottomTabBarProps` — so it publishes them here for the
 * rail to consume. This keeps the `<Tabs>` navigator the single source of route
 * state: the rail only reflects the active destination and drives navigation
 * through the same `navigation` object the bottom bar uses.
 *
 * Types are sliced from `BottomTabBarProps` (re-exported by expo-router's bundled
 * bottom-tabs) so we don't depend on `@react-navigation/*` being installed as a
 * top-level package.
 */
export type RailNavState = Pick<BottomTabBarProps, "state" | "navigation">;

export const RailNavStateContext = createContext<RailNavState | null>(null);
