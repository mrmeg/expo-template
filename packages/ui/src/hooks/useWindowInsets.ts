import { use } from "react";
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
  type EdgeInsets,
} from "react-native-safe-area-context";

/**
 * The window's safe-area insets, wherever the component renders.
 *
 * `useSafeAreaInsets()` throws outside a `SafeAreaProvider` and reads zeros
 * inside content the system presents outside the provider's view — an iOS
 * `Modal`, a native bottom sheet, a `UIProvider` mounted above the app's
 * provider. This reads the provider's context when it is there and falls back
 * to `initialWindowMetrics` (the window the app launched in), edge by edge, so
 * overlays, toasts and `Screen` clear the Dynamic Island and home indicator in
 * every one of those cases. Zeros on web and in tests without a provider.
 */
export function useWindowInsets(): EdgeInsets {
  const context = use(SafeAreaInsetsContext);
  const fallback = initialWindowMetrics?.insets;
  return {
    top: context?.top || fallback?.top || 0,
    bottom: context?.bottom || fallback?.bottom || 0,
    left: context?.left || fallback?.left || 0,
    right: context?.right || fallback?.right || 0,
  };
}
