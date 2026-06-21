import { useEffect } from "react";
import { useDimensions } from "@mrmeg/expo-ui/hooks";
import {
  BottomTabBar,
  type BottomTabBarProps,
} from "expo-router/build/react-navigation/bottom-tabs";
import type { RailNavState } from "./RailNavStateContext";

interface ResponsiveTabBarProps extends BottomTabBarProps {
  /**
   * Publishes the live navigator `state` / `navigation` up to `TabLayout` so the
   * rail (a sibling outside the navigator) can mirror and drive route state.
   */
  onNavState: (navState: RailNavState) => void;
}

/**
 * Width-aware tab bar.
 *
 * - Narrow (`<768`): renders the standard themed `BottomTabBar`.
 * - Wide (`>=768`): renders nothing — the rail handles navigation — and the
 *   scene fills the full height with no reserved bottom bar.
 *
 * Regardless of width it bridges the navigator's `state` / `navigation` out via
 * `onNavState`, because it's the one place inside the navigator that receives
 * them as render props. See {@link RailNavStateContext}.
 */
export function ResponsiveTabBar({ onNavState, ...props }: ResponsiveTabBarProps) {
  const { isSmallScreen } = useDimensions();
  const { state, navigation } = props;

  // Republish whenever the active route changes so the rail's highlight tracks
  // the navigator. Keyed on `state` (a new object per navigation) — `navigation`
  // is stable.
  useEffect(() => {
    onNavState({ state, navigation });
  }, [state, navigation, onNavState]);

  if (!isSmallScreen) {
    return null;
  }

  return <BottomTabBar {...props} />;
}
