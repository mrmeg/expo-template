import { create } from "zustand";

/**
 * globalUIStore
 *
 * Global UI state store for alerts, modals, and transient UI elements.
 * Primarily used to trigger and dismiss the `Notification` component globally.
 *
 * Methods:
 * - show({ type, title, messages, duration, loading }): displays a notification
 * - hide(): hides the current notification
 *
 * Recommended: wrap in hooks or utility functions for cleaner usage across components.
 */


type State = {
  alert: {
    show: boolean
    type: "error" | "success" | "info" | "warning"
    messages: string[]
    title?: string
    duration?: number
    loading?: boolean
  } | null
}

type Actions = {
  show: (alert: Omit<NonNullable<State["alert"]>, "show">) => void
  hide: () => void
}

export const globalUIStore = create<State & Actions>((set) => ({
  alert: null,
  show: (alert) => set({
    alert: { ...alert, show: true }
  }),
  hide: () => set({ alert: null }),
}));
