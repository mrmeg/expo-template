---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Bottom toasts clear the tab bar (`useNotificationOffset`)

## Goal
A `notify(..., { position: "bottom" })` toast rendered by the root `Notification` sits above the app's tab bar instead of covering its labels (camera-app report, 09-27). Additive kit API: a screen or layout registers extra distance from a window edge while it is mounted; `Notification` keeps the larger of the safe-area inset and the registered offset. The template's native tab layout registers its tab bar.

## Context
- `packages/ui/src/components/Notification.tsx` positions the container at `Math.max(insets.bottom, spacing.smd) + spacing.sm` (and the same for `top`), with `insets` from `useWindowInsets()`. It is mounted once in the root layout by `UIProvider` (`notification: true`), above every navigator, so an absolutely positioned bottom toast paints over a tab bar.
- The kit knows nothing about tab bars: camera-app uses Expo Router's JS `Tabs` (tab bar height from `useBottomTabBarHeight()` in `@react-navigation/bottom-tabs`, which includes the bottom safe-area inset); this template uses `NativeTabs` (`app/(main)/(tabs)/_layout.native.tsx`), which exposes no height hook.
- `packages/ui/src/state/globalUIStore.ts` holds `{ alert, show, hide }`; `Notification` reads it with `useStore(globalUIStore)`. Tests: `packages/ui/src/components/__tests__/Notification.test.tsx` (`Notification placement` block uses `SafeAreaInsetsContext.Provider value={ISLAND}` with `bottom: 34`).
- Consumers pin 0.27.1: additive only, defaults unchanged (no registrant → today's positions).

## Work
1. `packages/ui/src/state/globalUIStore.ts`: add `NotificationOffset = { top?: number; bottom?: number }`, state `notificationOffsets: Record<string, NotificationOffset>` (default `{}`), actions `setNotificationOffset(key, offset)` and `clearNotificationOffset(key)`, and an exported selector `selectNotificationOffset(state): { top: number; bottom: number }` returning the per-edge maximum over registrants (0 when none). Document: an offset is measured from the window edge and includes any safe-area inset (as `useBottomTabBarHeight()` does); the toast sits `spacing.sm` past `max(inset, offset, spacing.smd)`.
2. `packages/ui/src/hooks/useNotificationOffset.ts` (export from `hooks/index.ts`): `useNotificationOffset(offset: NotificationOffset | null | undefined)` registers under a `useId()` key in an effect and clears on unmount or when `offset` becomes null; re-registers when the numbers change. No-op on the server.
3. `Notification.tsx`: read `selectNotificationOffset` through `useStore(globalUIStore, selectNotificationOffset)`; `bottomPosition = Math.max(insets.bottom, spacing.smd, offset.bottom) + spacing.sm`, `topPosition` likewise with `offset.top`.
4. Template: `client/features/navigation/tabBarMetrics.ts` exporting `useNativeTabBarOffset(): number` = platform tab bar height (iOS `UITabBar` 49, Android `BottomNavigationView` 56; verify the iOS value against the simulator AX tree during the device check and correct the constant if the iOS 26 floating bar differs) + `useWindowInsets().bottom`. In `app/(main)/(tabs)/_layout.native.tsx` call `useNotificationOffset(keyboardVisible ? null : { bottom: tabBarOffset })` (the tab bar is hidden while the keyboard is up).
5. Docs: `packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Added` entry for `useNotificationOffset` / `selectNotificationOffset` with the JS-`Tabs` example (`useNotificationOffset({ bottom: useBottomTabBarHeight() })` inside the tab layout) and the NativeTabs note; one paragraph in `packages/ui/README.md` next to the `notify` usage (~line 1083) and in `packages/ui/LLM_USAGE.md` (~line 194); `bun run docs:llms`.

## Validation
- RED first in `Notification.test.tsx` (`Notification placement`): a registered `{ bottom: 83 }` under `ISLAND` gives `bottom === 83 + spacing.sm`; `{ top: 100 }` gives `top === 100 + spacing.sm`; the larger of two registrants wins; unmounting the registering component restores `34 + spacing.sm`; a smaller offset than the inset changes nothing.
- Template test (add to `client/features/navigation/__tests__/`): the native tab layout registers a bottom offset equal to the platform tab bar height + inset and clears it when `useKeyboardVisible()` is true.
- `bun run pkg ui test -- --maxWorkers=2`, `bun run pkg ui typecheck`, `bun run typecheck`, `bun run lint`, `bun run gen --check`, `bun run docs:llms` (through heavy-slot).
- Device (fleet-sim-b or the Pro Max, dev client): `notify.info("Copied", { position: "bottom" })` from the Explore tab clears the tab bar; screenshot before/after into `/tmp/fleet/ui/expo-ui/toast-offset/`.

## Out of scope
Per-call offsets on `notify` options; measuring the native tab bar at runtime; changing the top toast's relation to navigator headers.

## Open questions
None.
