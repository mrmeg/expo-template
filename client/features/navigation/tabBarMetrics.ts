import { Platform } from "react-native";
import { useWindowInsets } from "@mrmeg/expo-ui/hooks";

/**
 * Height of the platform tab bar `NativeTabs` renders, above the bottom
 * safe-area inset: `UITabBar` on iOS, Material's `BottomNavigationView` on
 * Android. Neither exposes its frame to JS, so these are the platform values.
 * Web has no tab bar (the drawer shell) and reports 0.
 */
export const NATIVE_TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 0 });

/**
 * Distance from the bottom window edge to the top of the native tab bar —
 * the value `useNotificationOffset({ bottom })` wants so global toasts clear
 * the bar. Includes the bottom inset, like `useBottomTabBarHeight()` does for
 * a JS tab bar.
 */
export function useNativeTabBarOffset(): number {
  const insets = useWindowInsets();
  return NATIVE_TAB_BAR_HEIGHT + insets.bottom;
}
