---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/108
---

# BottomSheet: `onDismissed` fires once the sheet has fully dismissed

## Goal

`BottomSheet` gets an `onDismissed?: () => void` root prop that fires exactly once per close, after the native sheet is gone on iOS, Android and web, so a consumer can present the next modal (an RN `Modal`-backed `Dialog`, a native stack modal) from the callback without UIKit's "already presenting" rejection. Documented per platform; no version bump.

## Context

fieldnest #42: the FAB closes a `BottomSheet` and opens a `Dialog` (RN `Modal` on iOS since 0.27.1). Setting `open={false}` and opening the dialog in the same handler fails on iOS because the sheet's `UISheetPresentationController` is still dismissing when the `Modal` asks the same presenter to present; RN does not retry, so fieldnest waits 500 ms. Nothing in the package tells a consumer when the sheet is gone.

Verified in code (`@expo/ui` 58.0.2):

- `packages/ui/src/components/BottomSheet.tsx`: root props are `open`, `onOpenChange`, `defaultOpen`, `snapPoints`, `closeOnBackdropPress`. `BottomSheetContent` renders `NativeBottomSheet` with `index={open ? snapIndex : -1}`, `onChange={handleChange}` (dispatches `onOpenChange(false)` on `-1`) and `onClose={() => { if (open) onOpenChange(false); }}`. Neither callback reaches the consumer.
- iOS, `node_modules/@expo/ui/src/community/bottom-sheet/BottomSheet.ios.tsx:120-127,176-178,231`: `onClose`, `onDismiss` and `onChange(-1)` all fire from `fireCloseCallbacks`, which is wired only to the native `onDismiss` event; `closedRef` makes it fire once per close. `ios/BottomSheetView.swift:107-109` raises that event from SwiftUI `.sheet(isPresented:onDismiss:)`, which runs after the dismissal transition finishes (the upstream comment states this is so the callback can present another modal). A prop-driven close (`index=-1` → `setIsPresented(false)`) reaches the same event. So on iOS `@expo/ui`'s `onClose` is already a native dismiss-complete signal.
- Android, `BottomSheet.android.tsx:110-118,122-125,178-181`: a prop-driven close sets `isOpen=false` and calls `fireCloseCallbacks()` synchronously in the effect; the render then returns `null`, which removes the Compose `ModalBottomSheet` and its dialog window with no exit animation. A user dismiss (swipe, back, scrim) reaches `onDismissRequest` only after Material3 has animated the sheet to `Hidden`, then `handleDismiss` fires the same callbacks. Either way there is nothing left animating when `onClose` arrives.
- Web, `BottomSheet.tsx:76-86`: `index=-1` fires the callbacks synchronously, then `src/web/BottomSheetDialog.tsx:349-368` plays `SHEET_OUT` (`ENTER_MS` = 300 ms) and calls `dialog.close()` on `animationend` (fallback timer at 400 ms; immediate under `prefers-reduced-motion`). The sheet is an HTML `<dialog>` (`data-expo-ui-bottom-sheet`) and the hosted RN children are its descendants and stay mounted through the exit (`mounted` never resets), so `column.closest("dialog")` from the content column's DOM node yields the element and its standard `close` event marks completion. No JS callback for the animation end is exposed.
- Tests: `packages/ui/src/components/__tests__/BottomSheet.test.tsx` mocks `@expo/ui/community/bottom-sheet` with a `View` that drops `onClose`/`onChange`; the mock needs to expose them (e.g. store the latest props on a module-level ref) so a test can fire the native close.

Constraints: no version bump, `main` untouched, CHANGELOG entry under `## [Unreleased]` (`### Added`). No `Agent/` files in the PR diff. No `react-native-reanimated`/`worklets` imports (`check:forbidden-imports`). Editing `packages/ui/LLM_USAGE.md` requires `bun run docs:llms` and committing `llms-full.txt`.

## Work

1. RED tests first in `BottomSheet.test.tsx`: (a) controlled sheet with `onDismissed`: flipping `open` to `false` alone does not call it; firing the mocked native `onClose` calls it once; a second native `onClose`/`onChange(-1)` for the same close does not call it again; (b) uncontrolled sheet closed via `BottomSheet.Close` → native `onClose` → `onDismissed` once and `onOpenChange` semantics unchanged; (c) web (`Platform.OS = "web"` via the file's `withPlatform` helper): native `onClose` with no `<dialog>` ancestor falls back to firing on the same tick — the DOM path is documented, not unit-tested (jest-expo has no DOM here); (d) the latest `onDismissed` prop is used (ref, not a stale closure).
2. `BottomSheet.tsx`: add `onDismissed?: () => void` to `BottomSheetProps` (JSDoc: fires after the sheet is fully dismissed, once per close, how it is detected per platform, and the intended use — present the next modal here instead of a timer). Root keeps it in a ref and exposes a stable `notifyDismissed()` on the context. `BottomSheetContent` calls it from the native `onClose` handler on iOS and Android (keep the existing `if (open) onOpenChange(false)`); on web, from `onClose`, find `closest("dialog")` from the content column's ref: if found and `dialog.open`, add a one-shot `close` listener that calls `notifyDismissed()` (removed on unmount, not fired then); otherwise call it immediately. Do not fire from `handleChange(-1)` (same close, second callback).
3. Docs: `packages/ui/README.md` BottomSheet bullet (near the `@expo/ui` paragraph at ~586) and `LLM_USAGE.md` BottomSheet paragraph: `onDismissed` exists; iOS uses `@expo/ui`'s native `onDismiss` event from SwiftUI `.sheet(onDismiss:)`, which fires after the dismissal transition; Android uses `@expo/ui`'s close callback (post hide-animation for swipe/back/scrim; a prop-driven close removes the Compose sheet with no exit animation); web derives it from the HTML `<dialog>` `close` event that `@expo/ui` raises when its exit animation ends. Open the next modal from `onDismissed`, not `onOpenChange(false)`. CHANGELOG `## [Unreleased]` `### Added` entry naming fieldnest #42. Run `bun run docs:llms` and commit `llms-full.txt`.
4. Note in the PR body: Android prop-driven close is unanimated today (pre-existing; `@expo/ui`'s imperative `close()` awaits `hide()` and would animate — separate follow-up, not this PR).

## Validation

- `bun run ui:typecheck`, `bun run ui:test` (new tests red before step 2, green after), `bun run ui:build`, `bun run packages:peer-check`, root `bun run typecheck`, `bun run lint`, `bun run docs:llms:check`, `bun run docs:versions:check`.
- Device (optional, one pool iPhone simulator): showcase `BottomSheet` — close the sheet, log `onDismissed`, and open a `Dialog` from it; the dialog presents. Skip if the unit tests prove the wiring; the timing itself is `@expo/ui`'s native event.

## Out of scope

- Animated prop-driven close on Android (switching to `@expo/ui`'s imperative `close()`).
- An `onPresented`/open-complete callback.
- Changing `onOpenChange` timing.
- Releasing 0.27.2; fieldnest's timer removal (after 0.27.2 ships).

## Open questions

None.
