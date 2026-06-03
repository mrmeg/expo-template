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
 * Recommended: wrap in hooks or utility functions for cleaner usage across components.
 */

export type GlobalNotificationType = "error" | "success" | "info" | "warning";

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
    alert: { ...alert, show: true }
  }),
  hide: () => set({ alert: null }),
}));
