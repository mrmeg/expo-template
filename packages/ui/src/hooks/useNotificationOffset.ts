import { useEffect, useId } from "react";
import { globalUIStore, type NotificationOffset } from "../state/globalUIStore";

/**
 * Keep global toasts clear of a bar this layout owns, for as long as it is
 * mounted. The offset is measured from the window edge and includes the
 * safe-area inset there, so a JS tab layout passes `useBottomTabBarHeight()`
 * as-is and a native tab layout passes the bar height plus the bottom inset;
 * `Notification` then sits 8 pt past the larger of the inset and the offset.
 * Pass `null` (or `undefined`) to register nothing — for instance while the
 * tab bar is hidden behind the keyboard. Several layouts may register at once;
 * the largest value per edge wins. A no-op during server rendering.
 *
 * ```tsx
 * // app/(tabs)/_layout.tsx with Expo Router's JS <Tabs>
 * function TabBarOffset() {
 *   useNotificationOffset({ bottom: useBottomTabBarHeight() });
 *   return null;
 * }
 * ```
 */
export function useNotificationOffset(offset: NotificationOffset | null | undefined): void {
  const key = useId();
  const top = offset?.top;
  const bottom = offset?.bottom;
  const active = offset != null && (top !== undefined || bottom !== undefined);

  useEffect(() => {
    if (!active) return;
    globalUIStore.getState().setNotificationOffset(key, { top, bottom });
    return () => {
      globalUIStore.getState().clearNotificationOffset(key);
    };
  }, [active, key, top, bottom]);
}
