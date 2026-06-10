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

export type GlobalUIState = {
  alert: GlobalNotificationAlert | null
}

export type GlobalUIActions = {
  show: (alert: Omit<GlobalNotificationAlert, "show">) => void
  hide: () => void
}

export const globalUIStore = create<GlobalUIState & GlobalUIActions>((set) => ({
  alert: null,
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
}));
