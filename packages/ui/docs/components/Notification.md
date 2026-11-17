---
components: [Notification]
use-for: "Global toast surface"
instead-of: "Screen-local toast state"
---

# Notification

Trigger through `notify` (or `globalUIStore` for subscriptions/tests) with root `UIProvider`; actions dismiss after press.

- Bottom toasts must clear the tab bar: the layout that owns a bar calls `useNotificationOffset({ bottom })` (`@mrmeg/expo-ui/hooks`) with the bar's distance from the window edge, inset included — `useBottomTabBarHeight()` for a JS `<Tabs>` layout, platform bar height + `useWindowInsets().bottom` for `NativeTabs` — and `null` while the bar is hidden. Never position a toast yourself.
- Use `notify` plus a root `UIProvider` for transient global feedback. (`globalUIStore` stays available for reactive subscriptions and tests. In a component, read it with zustand's `useStore(globalUIStore, selector)`, never `globalUIStore()`: the React Compiler only treats `use*` calls as hooks, caches the bare call, and the next render crashes with React error #311.)

## Notifications

`notify` (from `@mrmeg/expo-ui/state`, also on the root barrel) is the imperative
API for the `Notification` component.

Notifications auto-dismiss after 4s (`DEFAULT_NOTIFICATION_DURATION`) unless a
`duration` is passed; `duration: 0` keeps one up until dismissed. `position` is
`"top"` (default) or `"bottom"`.
`notify.loading` never auto-dismisses.

`globalUIStore` (the underlying zustand store) stays available for reactive
selectors and tests. Use `notify` for imperative triggers in app code.

## Anatomy

One compact row on the overlay surface (`popover` on a `border` hairline, the
app's card radius, `shadow-elevated`): a status icon, the title (`label`), an
optional message under it (`caption`, muted), an optional action (a `secondary`
`sm` Button).

- Write the title as the whole message: "Profile updated", not "Success". A
  notification with only `messages` shows the first one as its title; the
  generic "Success" / "Error" title appears only when there is neither.
- Status colors mark `error`, `success` and `warning` only; `info` and loading
  stay neutral.
- A notification that dismisses itself has no close button on iOS and Android:
  swipe it toward its edge (up for `top`, down for `bottom`). A persistent one
  (`duration: 0`, `notify.loading`) and every notification on web has one.
- An `error` is announced at once (`role="alert"`); the rest wait their turn
  (`role="status"`). VoiceOver reads each one as it appears.

## Minimal Examples

```tsx
import { notify } from "@mrmeg/expo-ui/state";

notify.success("Saved", { messages: ["Your changes were saved."] });
notify.error("Upload failed");
notify.warning("Connection slow");
notify.info("Copied to clipboard");

// Loading spinner — no auto-dismiss; stays until replaced or hidden
notify.loading("Uploading…");
notify.hide();

// Full control (same payload as globalUIStore show())
notify({ type: "success", title: "Saved", action: { label: "View", onPress: openSavedItem } });
notify({ type: "success", title: "Saved", duration: 3000, position: "bottom" });

// Loading → success/error around a promise
// (rethrows on rejection)
await notify.promise(saveProfile(), {
  loading: "Saving…",
  success: "Profile saved",          // or (value) => `Saved ${value.name}`
  error: "Could not save profile",   // or (err) => err.message
});
```
