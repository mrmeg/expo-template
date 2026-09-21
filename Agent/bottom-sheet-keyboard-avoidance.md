---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# `BottomSheet` keyboard avoidance: honour `avoidKeyboard` with a measured keyboard inset on the content column

## Goal

With a field focused inside a `BottomSheet`, `BottomSheet.Footer` and the tail of `BottomSheet.Body` stay above the keyboard, and `avoidKeyboard={false}` opts out. Today the package reads no keyboard height anywhere in the sheet and discards the prop, so where the native sheet does not shrink its hosted content the footer's submit button sits under the keyboard.

## Context

Verified on `dev` at a7bde1b (`@mrmeg/expo-ui` 0.26.0 source; CI green on the 0.26.0 release commit f59d2fa).

### Root cause (package)

- `BottomSheetContentProps.avoidKeyboard` is documented "Accepted for call-site ergonomics; ignored" (`packages/ui/src/components/BottomSheet.tsx:149`) and `BottomSheetContent` destructures it to `_avoidKeyboard` and never reads it (`:526`). The header comment (`:35-44`) and `packages/ui/README.md:568-572` promise "the platform owns keyboard avoidance".
- Nothing in the sheet reads a keyboard height: `BottomSheetFooter` pads `spacing.md + insets.bottom` (`:816-843`, `:833`), `BottomSheetBody` pads `spacing.md + (hasFooter ? 0 : insets.bottom)` (`:756-808`, `:790`), the `Content` column is `flex: 1` plus `maxHeight: detentHeight` off Android (`:612-630`). `useSheetInsets` (`:310-319`) is safe-area only.
- The platform does not own it. `@expo/ui`'s community sheet README lists `keyboardBehavior` / `keyboardBlurBehavior` as "Accepted, no effect" (`node_modules/@expo/ui/src/community/bottom-sheet/README.md:114-115`). On both platforms the RN content is hosted in a `RNHostView matchContents={false}` inside a `{ flexGrow: 1, height: 0 }` view (`BottomSheet.ios.tsx:229-247`, `BottomSheet.android.tsx:202-209`), so the column is exactly as tall as the host the native sheet measures. iOS: `RNHostView.swift:75-78` gives SwiftUI `.frame(maxWidth: .infinity, maxHeight: .infinity)` and reports the size to Yoga, so the column shrinks only if SwiftUI's keyboard safe area shrinks the sheet content. Android: `ModalBottomSheetView.kt:153-177` renders Material3 `ModalBottomSheet` (material3 `1.5.0-alpha17`, `node_modules/@expo/ui/android/build.gradle:43`) in its own dialog window with no IME handling of its own, so the column shrinks only if Material3 pads the sheet for the IME. Consumers' installed `@expo/ui` (57.0.4, 57.0.13, 57.0.14) have identical hosting code and the same material3 pin.

**Observed.**

- tractor (PR #15, `@expo/ui` 57.0.4, `@mrmeg/expo-ui` 0.24.0): Android AVD `Pixel_10` — Review and Lead sheet footers pushed under the IME, submit unreachable (note o). iOS simulator — `LeadModal` footer overlaps the Call/Text row with the keyboard up (iOS drift list).
- doglog (`Agent/bottom-sheet-keyboard-overlay-press-in.md`, `@expo/ui` 57.0.14, physical Pixel 6a and iOS simulator): the `AddFoodSheet` footer button was reachable with the keyboard up on both platforms (the tap hit it and dismissed the keyboard). So native avoidance can happen; the package must never add a second inset on top of it.
- fieldnest's `keyboard-inset-clips-form-content-and-hides-submit.md` and `keyboard-sticky-footer-jumps-over-form.md` are **not** sheet defects and are not fixed here: `client/components/app-ui/KeyboardSafeScreenView.tsx` composes keyboard-controller's `KeyboardAwareScrollView` + `KeyboardStickyView` underneath `UIProvider`'s default root `KeyboardAvoidingView` (`client/features/app/RootLayout.tsx:109-110`; `packages/ui/src/components/UIProvider.tsx:48` defaults `keyboardAvoiding` to true on native), so the footer is offset twice. Their measurements match double avoidance (Android footer 2130 → 427 px ≈ 2× IME height; iOS 0.906 → 0.180 of the screen ≈ 2× keyboard). Consumer fix: `UIProvider keyboardAvoiding={false}` (README `:127` already says not to nest avoidance). Record this in their specs; no package change.

**Keyboard-height sources inside the sheet window (why the design below).**

- keyboard-controller (`useKeyboardState`, `KeyboardEvents`, `useReanimatedKeyboardAnimation`) observes the main window; its Android `ModalAttachedWatcher.kt:9,38` extends only to RN `ReactModalHostView` dialogs, not Compose dialogs. This is why `BottomSheet.tsx:541-552` already takes keyboard presence from the focus registry.
- RN core `Keyboard`: iOS events are process-wide `UIKeyboard*Notification`s (`node_modules/react-native/React/CoreModules/RCTKeyboardObserver.mm:36,92,130`) carrying `endCoordinates.screenY`, so they arrive for a keyboard raised in the sheet's window. Android events come from the main `ReactRootView`'s `ime()` insets (`ReactRootView.java:934-966`); `RNHostView.kt:99-108` wraps the hosted view in a `TouchDispatchingRootViewGroup`, not a `ReactRootView`, so **no Android keyboard event is observable from JS inside the sheet**.
- Compose `imePadding()` exists (`node_modules/@expo/ui/build/jetpack-compose/modifiers/index.d.ts:73-76`) but the community wrapper forwards no `modifiers` to `ModalBottomSheet` or `RNHostView` (`BottomSheet.android.tsx:190-209`), so the package has no Android lever short of forking that wrapper.

**Decision (night mode).** The package supplements the platform with a measured overlap inset on iOS — the same computation RN's `KeyboardAvoidingView` uses (`node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:86-105`) — which is a no-op whenever SwiftUI already shrank the host; documents Android as Material3-owned with the acceptance check and fallback below; leaves `dismissKeyboardOnDrag` ignored. `measureInWindow` inside the sheet returns coordinates in the sheet's own `UIWindow`, which is full-screen (iPhone and iPad alike), so it is comparable with `endCoordinates.screenY`.

## Work

1. New `packages/ui/src/components/sheetKeyboardInset.ts` (imports only `react-native`):
   - `export function keyboardOverlap(columnBottom: number, keyboardTop: number, absorbedInset: number): number` → `Math.max(0, columnBottom - keyboardTop - absorbedInset)`. `absorbedInset` is the home-indicator inset `Footer`/`Body` already pad, so their existing padding counts toward clearance instead of stacking above the keyboard.
   - `export function useSheetKeyboardInset({ enabled, absorbedInset }): { columnRef, onLayout, paddingBottom }`. Active only when `enabled && Platform.OS === "ios"`; otherwise `paddingBottom` is 0, `onLayout` is a no-op and nothing is subscribed. When active: `Keyboard.addListener("keyboardDidChangeFrame", e)` stores `keyboardTop = e.endCoordinates.screenY`; `Keyboard.addListener("keyboardDidHide")` clears it; after either event and in `onLayout` (the column re-laid out, e.g. SwiftUI shrank the host) call `columnRef.current?.measureInWindow((x, y, w, h) => set(keyboardOverlap(y + h, keyboardTop, absorbedInset)))`, or set 0 when no keyboard frame is known. Remove both subscriptions on unmount and drop late measurements.
2. `BottomSheetContent` (`BottomSheet.tsx:523-560`, `:612-630`): rename `_avoidKeyboard` → `avoidKeyboard = true`; call `useSheetKeyboardInset({ enabled: avoidKeyboard, absorbedInset: useSheetInsets().bottom })`; put `ref={columnRef}` and `onLayout={onLayout}` on the column `View` and append `{ paddingBottom }` **after** `styleOverride` in its style array. `dismissKeyboardOnDrag` stays destructured-and-ignored.
3. Prop and header docs: `BottomSheetContentProps.avoidKeyboard` (`:149`) — "Default `true`. iOS: pads the content column by the measured part of the keyboard that overlaps it, so `Footer` and the tail of `Body` stay above the keyboard; no-op when the native sheet already shrinks its content. Android: Material3's `ModalBottomSheet` owns it. Web: none." Rewrite the "platform owns keyboard avoidance" line in the header comment (`:38-44`), `packages/ui/README.md:568-572`, `packages/ui/LLM_USAGE.md:86` and `packages/ui/llms.txt:29` to match. Run `bun run docs:llms` and commit `llms-full.txt`.
4. `packages/ui/CHANGELOG.md` `## [Unreleased]`: `### Changed` — `BottomSheet.Content avoidKeyboard` now has effect on iOS (default true; pass `false` to opt out); `### Fixed` — sheet footers and body tails no longer sit under the iOS keyboard where the SwiftUI host is not shrunk; note that Android avoidance is Material3's and that no JS keyboard signal exists inside the Compose dialog window. No version bump; no publish.
5. Tests:
   - New `packages/ui/src/components/__tests__/sheetKeyboardInset.test.tsx`. Pure cases: `keyboardOverlap(800, 500, 34) === 266`, `keyboardOverlap(800, 900, 34) === 0`, `keyboardOverlap(800, 780, 34) === 0`. Hook cases through a harness `View` that spreads `ref`/`onLayout`/`{ paddingBottom }`: capture listeners with `jest.spyOn(Keyboard, "addListener")` (RN's jest preset mocks `NativeModules.KeyboardObserver`, `node_modules/@react-native/jest-preset/jest/mocks/NativeModules.js:78`, so `Keyboard` constructs under jest-expo's iOS platform); drive measurement through the RN `View` mock's shared `measureInWindow: jest.fn()` (`node_modules/@react-native/jest-preset/jest/MockNativeMethods.js:13`, applied by `jest/mocks/View.js`) with `mockImplementation((cb) => cb(0, 300, 390, 500))`. Assert: `keyboardDidChangeFrame` with `screenY: 600` → `paddingBottom` 166 with `absorbedInset` 34; re-measure to a shorter column on `fireEvent(view, "layout")` (host shrank) → 0; `keyboardDidHide` → 0; `enabled: false` and `Platform.OS === "android"` (flip as `withPlatform` does in `BottomSheet.test.tsx:29-37`) → `addListener` never called; unmount removes both subscriptions.
   - `BottomSheet.test.tsx`: `Content` default on iOS subscribes to `keyboardDidChangeFrame` and `keyboardDidHide` and its flattened column style carries the emitted overlap; `avoidKeyboard={false}` subscribes to nothing; on Android the column style has no `paddingBottom`. Existing "column height" and "keyboard dismiss boundary" cases must still pass.

## Validation

- `bun run typecheck`, `bun run lint`, `bun run docs:llms:check` clean.
- `bunx jest packages/ui/src/components/__tests__/sheetKeyboardInset.test.tsx packages/ui/src/components/__tests__/BottomSheet.test.tsx` green.
- `cd packages/ui && bun run test` (package suite plus `check:forbidden-imports`; the new module must not import `react-native-keyboard-controller`).

### Device verification (consumer repro, after the release is bumped in)

- tractor, iOS simulator: `LeadModal` — focus `lead-email`: `lead-submit` and Cancel sit fully above the keyboard; the Call/Text row scrolls inside the body and is no longer overlapped. `ReviewForm` `review-submit`, `CatalogFilterSheet` `filter-apply` likewise. Behavior 7 of `Agent/expo-ui-0.24-keyboard-device-verification.md` can be exercised from the footer.
- doglog, iOS simulator, `AddFoodSheet`: footer still reachable **and not lifted twice** — the gap between the footer and the keyboard stays at `spacing.md`, not a keyboard height. This is the no-double-inset check.
- Android acceptance (Material3-owned): tractor AVD `Pixel_10`, `@expo/ui` first brought to the SDK 57 latest with `npx expo install @expo/ui` (tractor's lockfile is on 57.0.4; doglog's 57.0.14 is where the footer was observed reachable): with `lead-email` focused, `lead-submit` is above the IME. If it is not, the remaining lever is upstream — ask `expo/expo` to apply `imePadding()` (or forward `modifiers`) in `@expo/ui/community/bottom-sheet`'s Android wrapper — and record that request as the `blocked-by` of tractor's `sheet-and-auth-form-keyboard-avoidance.md`. Forking the community wrapper into this package was considered and rejected: it would re-own snap, dismiss and touch plumbing for one modifier.

### Release (human step, Matt)

Minor release (0.27.0; `avoidKeyboard` gains effect). Bump `packages/ui/package.json`, move `[Unreleased]` under the new heading, publish. Consumers bump; tractor re-checks the sheet half of `Agent/sheet-and-auth-form-keyboard-avoidance.md` (its auth-form half already moved to other specs). doglog needs nothing but the regression check above. fieldnest's two drafts are consumer-side (see Context).

## Merge plan

Depends on `Agent/bottom-sheet-body-keyboard-should-persist-taps.md` (same file, tests, README and changelog section). Land that first and rebase this branch on it.

## Out of scope

- Android IME avoidance in package code (no JS signal inside the Compose dialog window; see Context) beyond the acceptance check and upstream request.
- `dismissKeyboardOnDrag` semantics; drag-to-dismiss inside sheets.
- fieldnest's app-level double avoidance (`UIProvider keyboardAvoiding`), and tractor's auth-form footers (non-sheet).
- Animating the inset with the keyboard (RN `LayoutAnimation`); the inset lands after `keyboardDidChangeFrame`.

## Open questions

None.
