import { create } from "zustand";

/**
 * globalUIStore
 *
 * Global UI state store for alerts, modals, and transient UI elements.
 * Primarily used to trigger and dismiss the `Notification` component globally.
 *
 * Methods:
 * - show({ type, title, messages, duration, loading, action }): displays a notification
 * - hide(): hides the current notification
 * - setNotificationOffset(key, { top, bottom }) / clearNotificationOffset(key):
 *   keep toasts clear of a tab bar or floating header (use `useNotificationOffset`)
 *
 * Notifications auto-dismiss after `DEFAULT_NOTIFICATION_DURATION` unless a
 * `duration` is given. Pass `duration: 0` to keep one up until dismissed;
 * loading notifications never auto-dismiss.
 *
 * Prefer the `notify` helpers (see ./notify) for triggering notifications from
 * app code; use this store directly for reactive subscription (selectors) and tests.
 */

export type GlobalNotificationType = "error" | "success" | "info" | "warning";

/** Auto-dismiss delay applied when `show()` is called without a `duration`. */
export const DEFAULT_NOTIFICATION_DURATION = 4000;

export type GlobalNotificationPosition = "top" | "bottom";

export type GlobalNotificationAction = {
  label: string
  onPress: () => void
}

export type GlobalNotificationAlert = {
  show: boolean
  type: GlobalNotificationType
  title?: string
  messages?: string[]
  /** Auto-dismiss delay in ms. Defaults to `DEFAULT_NOTIFICATION_DURATION`; 0 = stays until dismissed. */
  duration?: number
  loading?: boolean
  /** Where to display the notification */
  position?: GlobalNotificationPosition
  action?: GlobalNotificationAction
}

/**
 * Extra distance a toast keeps from a window edge, measured from that edge and
 * including any safe-area inset there — the number `useBottomTabBarHeight()`
 * returns for a JS tab bar, or a native tab bar's height plus the bottom
 * inset. `Notification` sits `spacing.sm` past the largest of the inset, the
 * registered offsets and its 12 pt floor, so a bottom toast clears a tab bar
 * and a top one clears a floating header. Register with
 * `useNotificationOffset()` (`@mrmeg/expo-ui/hooks`) from the layout that
 * owns the bar; the offset lasts while that layout is mounted.
 */
export type NotificationOffset = {
  top?: number
  bottom?: number
}

export type GlobalUIState = {
  alert: GlobalNotificationAlert | null
  /** Registered offsets by registrant key; see {@link NotificationOffset}. */
  notificationOffsets: Record<string, NotificationOffset>
}

export type GlobalUIActions = {
  show: (alert: Omit<GlobalNotificationAlert, "show">) => void
  hide: () => void
  /** Register (or update) the offset for one registrant. */
  setNotificationOffset: (key: string, offset: NotificationOffset) => void
  /** Remove one registrant's offset. */
  clearNotificationOffset: (key: string) => void
}

/**
 * The effective offset per edge: the largest registered value, 0 with none.
 * Read it with `useStore(globalUIStore, selectNotificationOffset)`.
 */
export const selectNotificationOffset = (
  state: Pick<GlobalUIState, "notificationOffsets">
): Required<NotificationOffset> => {
  let top = 0;
  let bottom = 0;
  for (const offset of Object.values(state.notificationOffsets)) {
    if (offset.top !== undefined && offset.top > top) top = offset.top;
    if (offset.bottom !== undefined && offset.bottom > bottom) bottom = offset.bottom;
  }
  return { top, bottom };
};

export const globalUIStore = create<GlobalUIState & GlobalUIActions>((set) => ({
  alert: null,
  notificationOffsets: {},
  show: (alert) => set({
    alert: {
      ...alert,
      // Loading notifications stay up until replaced or hidden (e.g. by
      // notify.promise); everything else falls back to the default timeout.
      duration: alert.duration ?? (alert.loading ? undefined : DEFAULT_NOTIFICATION_DURATION),
      show: true,
    },
  }),
  hide: () => set({ alert: null }),
  setNotificationOffset: (key, offset) =>
    set((state) => ({ notificationOffsets: { ...state.notificationOffsets, [key]: offset } })),
  clearNotificationOffset: (key) =>
    set((state) => {
      if (!(key in state.notificationOffsets)) return state;
      const { [key]: _removed, ...rest } = state.notificationOffsets;
      return { notificationOffsets: rest };
    }),
}));
