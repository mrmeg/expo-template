import { globalUIStore } from "./globalUIStore";
import type {
  GlobalNotificationAlert,
  GlobalNotificationType,
} from "./globalUIStore";

/**
 * notify
 *
 * Imperative notification API backed by `globalUIStore`. This is the
 * recommended way to trigger the `Notification` component from app code.
 *
 * Notifications auto-dismiss after `DEFAULT_NOTIFICATION_DURATION` (4s) by
 * default. Pass `duration: 0` to keep one up until dismissed; `notify.loading`
 * is always persistent.
 *
 * Usage:
 * ```ts
 * notify.success("Saved", { messages: ["Your changes have been saved."] });
 * notify.error("Upload failed");
 * notify.loading("Uploading…");
 * notify.hide();
 *
 * // Full control (same payload as globalUIStore show())
 * notify({ type: "info", title: "Copied", duration: 2000, position: "bottom" });
 *
 * // Loading → success/error around a promise
 * await notify.promise(saveProfile(), {
 *   loading: "Saving…",
 *   success: "Profile saved",
 *   error: "Could not save profile",
 * });
 * ```
 */

export type NotifyOptions = Omit<GlobalNotificationAlert, "show" | "type" | "title">;

export type NotifyPromiseMessages<T> = {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((error: unknown) => string)
}

const show = (alert: Omit<GlobalNotificationAlert, "show">) =>
  globalUIStore.getState().show(alert);

const showType = (type: GlobalNotificationType) =>
  (title: string, options?: NotifyOptions) => show({ type, title, ...options });

export const notify = Object.assign(show, {
  success: showType("success"),
  error: showType("error"),
  info: showType("info"),
  warning: showType("warning"),
  /** Persistent spinner notification; stays visible until replaced or hidden. */
  loading: (title: string, options?: NotifyOptions) =>
    show({ type: "info", title, loading: true, ...options }),
  /**
   * Shows a loading notification while the promise is pending, then a
   * success or error notification. Rethrows on rejection and returns the
   * resolved value so it can wrap existing async flows transparently.
   */
  promise: async <T>(promise: Promise<T>, messages: NotifyPromiseMessages<T>): Promise<T> => {
    notify.loading(messages.loading);
    try {
      const value = await promise;
      const title = typeof messages.success === "function" ? messages.success(value) : messages.success;
      notify.success(title);
      return value;
    } catch (error) {
      const title = typeof messages.error === "function" ? messages.error(error) : messages.error;
      notify.error(title);
      throw error;
    }
  },
  hide: () => globalUIStore.getState().hide(),
});
