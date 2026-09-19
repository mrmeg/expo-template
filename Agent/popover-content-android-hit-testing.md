---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Popover content fills its overlay so Android hit-testing reaches native controls

## Goal

Native controls rendered inside `PopoverContent` (a React Native `Switch`, a `TextInput`, a `Slider`) respond to taps on Android, and popover content appears in the Android accessibility tree. `DropdownMenuContent`, `SelectContent`, and `TooltipContent` share the exact same wrapper structure and get the same fix in the same PR. Downstream, mindmap carries this as a bun patch (`~/Development/mindmap/patches/@mrmeg%2Fexpo-ui@0.24.0.patch`) and drops it once the fix ships in `@mrmeg/expo-ui` 0.26.0.

## Context

Verified on `dev` at `1e4529d` (`packages/ui` version 0.25.1; PR #93 `release/expo-ui-0.26.0` is open against `dev` and moves the Unreleased changelog under `## [0.26.0]`).

- **The tree.** `packages/ui/src/components/Popover.tsx` `PopoverContent` renders `PopoverPrimitive.Portal > FullWindowOverlay > PopoverPrimitive.Overlay (style: Platform.select({ native: StyleSheet.absoluteFill })) > AnimatedView type="fade" (no style) > TextColorContext > TextClassContext > PopoverPrimitive.Content`. On native, `@rn-primitives/popover` `Overlay` is a `Pressable` that closes on press, and `Content` gets `position: "absolute"` with screen-relative `top`/`left` from `useRelativePosition` (`node_modules/@rn-primitives/hooks/dist/index.js` lines 128 and 258). The `AnimatedView` between them has no style, so it lays out at zero height and width at the overlay's origin; the card is a child positioned entirely outside its parent's bounds.
- **Why Android breaks.** Android `ViewGroup.dispatchTouchEvent` only offers `ACTION_DOWN` to children whose bounds contain the touch point. Controls that consume touches natively (`Switch`, `TextInput`, `ScrollView`, `Slider`) therefore never receive the down event. `Pressable` children still work because React Native's JS responder system (`TouchTargetHelper`) walks children regardless of parent bounds when overflow is visible, which is why menu items and buttons inside these overlays never surfaced the bug. Android's accessibility traversal is bounds-based too, so the content subtree is reported as not visible to the user. iOS `hitTest` and web hit-testing are unaffected by parent bounds, which is why this is Android-only. Root-caused in mindmap (PR #34, 2026-09-18) with a `Switch` inside `PopoverContent`.
- **`AnimatedView`** (`packages/ui/src/components/AnimatedView.tsx`) accepts `ViewProps`, renders `<Animated.View style={[style, entranceStyle]} {...props}>`, so `style` and `pointerEvents` pass straight through. RN 0.88 accepts `pointerEvents` as a prop and as a style key; react-native-web 0.21 forwards the prop without a deprecation warning.
- **Same pattern elsewhere** (each `AnimatedView` sits directly under an absolute-fill native `Overlay` and directly above an absolutely positioned primitive `Content`):
  - `packages/ui/src/components/DropdownMenu.tsx` `DropdownMenuContent`: `<AnimatedView type="fade">` (line 181).
  - `packages/ui/src/components/Select.tsx` `SelectContent`: `<AnimatedView type="fade">` (line 208).
  - `packages/ui/src/components/Tooltip.tsx` `TooltipContent`: `<AnimatedView type="fade" enterDuration={150}>` (line 108).
- **Already correct, leave alone.** `Dialog.tsx` `DialogContent` and `AlertDialogContent` give their fade `AnimatedView` `style={StyleSheet.absoluteFill}` and center the card in a flex container, so the card is inside its parent's bounds. `BottomSheet.tsx` is a native sheet (SwiftUI `.sheet()` / Material `ModalBottomSheet`), no RN overlay. `Drawer.tsx` wraps its overlay content in `View style={StyleSheet.absoluteFill}` (lines 659-672).
- **Web.** The primitives' web `Overlay` is an unstyled `Pressable`; `Content` wraps Radix `Popover.Content`, which Radix portals and positions itself. An absolute-fill wrapper there is transparent and, with `pointerEvents="box-none"`, never a pointer target; Radix `DismissableLayer` reads `event.target`, which a box-none element never is. `Dialog` already ships an unconditional absolute-fill fade wrapper on web.
- **Tests.** Jest runs the `jest-expo` preset (iOS `Platform.OS`), setup in `test/setup.ts` (mocks `react-native-safe-area-context`, so `useSafeAreaInsets` in `DropdownMenuContent`/`SelectContent` works). Package tests live in `packages/ui/src/components/__tests__/`; `DropdownMenu.test.tsx` and `Select.test.tsx` mock their `@rn-primitives/*` module with plain `View`/`Pressable` components and mock `../../hooks/useTheme`; `Drawer.test.tsx` mocks `react-native-screens` `FullWindowOverlay` and `@rn-primitives/portal` as fragments so overlay content is queryable. There is no Popover or Tooltip test today. RNTL 14: host `.parent`, `toHaveStyle`, `toHaveProp` are available without extra setup.
- **Gates.** `bun run verify` runs `packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `gen:blocks:check`, `ui:icons:check`, `docs:llms:check`, `docs:versions:check`, then `bun x jest --ci`. The changelog is not an `llms-full.txt` source, so a changelog-only doc change needs no regeneration. `bun run ui:test` runs the package suite alone (`--runInBand`).
- **Changelog.** `packages/ui/CHANGELOG.md` has an `## [Unreleased]` section with `### Changed`, `### Removed`, `### Added`, `### Fixed`. PR #93 rewrites that heading to `## [0.26.0]`; adding to Unreleased on `dev` will conflict with #93's changelog hunk, which the release PR resolves by carrying the new bullet into its 0.26.0 `### Fixed` list (release-PR follow-up, not this spec).

## Work

1. **Popover.** In `packages/ui/src/components/Popover.tsx` `PopoverContent`, change `<AnimatedView type="fade" enterDuration={200}>` to `<AnimatedView type="fade" enterDuration={200} style={StyleSheet.absoluteFill} pointerEvents="box-none">`. The wrapper now spans the overlay, so the absolutely positioned card is inside its parent's bounds; `box-none` keeps the wrapper from swallowing the outside taps the `Overlay` `Pressable` needs for close-on-press.
2. **Same fix, same shape** in `DropdownMenu.tsx` (`DropdownMenuContent`), `Select.tsx` (`SelectContent`), and `Tooltip.tsx` (`TooltipContent`): add `style={StyleSheet.absoluteFill} pointerEvents="box-none"` to the fade `AnimatedView` directly under the primitive `Overlay`. Keep every other prop as is. `StyleSheet` is already imported in all four files.
3. **Comment.** Above the `AnimatedView` in `Popover.tsx` only, add a two-to-three-line comment stating why: the primitive `Content` is `position: absolute`; an unsized wrapper lays out zero-height, and Android only dispatches touches and accessibility to children inside their parent's bounds, so native controls (`Switch`) inside the popover ignored taps. In the other three files, a one-line comment pointing at the Popover comment is enough.
4. **Regression test.** New `packages/ui/src/components/__tests__/overlayContentBounds.test.tsx` that covers all four components in one file, mirroring `DropdownMenu.test.tsx`/`Select.test.tsx` mocks:
   - `jest.mock("../../hooks/useTheme", …)` returning `theme.colors` `{ popover, popoverForeground, border, text, muted, foreground, background, overlay, primary, accent, mutedForeground, input }`, `getShadowStyle: () => ({})`, `getContrastingColor: (_bg, fg) => fg`, `getFocusRingStyle: () => ({})`.
   - `jest.mock("react-native-screens", () => ({ FullWindowOverlay: ({ children }) => <>{children}</> }))`.
   - For each of `@rn-primitives/popover`, `@rn-primitives/dropdown-menu`, `@rn-primitives/select`, `@rn-primitives/tooltip`: mock `Root` (`View`), `Trigger` (`Pressable`), `Portal` (fragment), `Overlay` (`View` forwarding `style` and setting `testID="overlay"`), `Content` (`View` forwarding `style`, `testID`, children). The components read other members (`Group`, `Sub`, `RadioGroup`, `Value`, `Item`, …) only when those sub-components render, and reading a missing key off the mock object is `undefined`, not an error, so the mock stays at those five.
   - For each component render it open (`<Popover open>` … `<PopoverContent testID="content"><Switch testID="switch" value onValueChange={() => {}} /></PopoverContent>` with React Native's `Switch`, and the equivalents `DropdownMenu`/`DropdownMenuContent`, `Select`/`SelectContent`, `Tooltip`/`TooltipContent`) and assert:
     - `screen.getByTestId("overlay")` has style `{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }` (the precondition this test protects).
     - Walking `.parent` from `screen.getByTestId("content")` up to the overlay element and keeping only host nodes (`typeof node.type === "string"`; react-test-renderer's `.parent` also yields composite instances such as `AnimatedView`), every intermediate host `View` has `toHaveStyle({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 })` and `toHaveProp("pointerEvents", "box-none")`, and there is at least one. Put this in a helper `hostWrappersBetween(content, overlay)` so a future extra wrapper is also checked, not skipped.
     - `screen.getByTestId("switch")` is in the tree (jest-expo mocks the RN `Switch` host, so query by `testID`, not role), so the test documents the case that broke.
   - Header comment: name the Android bounds-based `ACTION_DOWN` dispatch and accessibility traversal as the reason, and mindmap's patch as the origin. This is a structural test; Jest has no layout engine, so it locks the wrapper geometry rather than simulating Android dispatch.
5. **Changelog.** `packages/ui/CHANGELOG.md`, under `## [Unreleased]` → `### Fixed`, add a bullet in the existing voice: **Popover, DropdownMenu, Select, and Tooltip content receives Android touches.** The fade wrapper between each overlay and its absolutely positioned content now fills the overlay (`pointerEvents="box-none"`), so the card is inside its parent's bounds. Android dispatches `ACTION_DOWN` and accessibility only to children inside parent bounds, so native controls (`Switch`, `TextInput`) inside a `PopoverContent` ignored taps and the content was missing from the accessibility tree. Tap-away still closes.
6. **Docs.** No README change: the components' public API is unchanged. Do not touch `Agent/` files in the PR branch.

## Validation

- `bun run ui:test` — the new test passes; nothing else changes.
- Non-test gates: `bun run packages:peer-check`, `typecheck`, `lint`, `check:features`, `gen:templates:check`, `gen:blocks:check`, `ui:icons:check`, `docs:llms:check`, `docs:versions:check` all green, then `bun x jest --ci --maxWorkers=2` (the same gates `bun run verify` runs; the worker cap is a host constraint).
- Sanity on the diff: exactly four component files gain `style={StyleSheet.absoluteFill} pointerEvents="box-none"` on a fade `AnimatedView`; `git diff --stat` shows those four, the test, and the changelog.
- Device check (human, after publish, recorded in the PR body as not run when no emulator is available): on an Android device or emulator, open a popover containing an RN `Switch`, tap the switch — it toggles; tap outside — the popover closes; TalkBack or `adb shell uiautomator dump` lists the popover content. iOS and web: popover, dropdown, select, tooltip open, position, and dismiss as before.

## Out of scope

- Bumping the package version or editing the `## [0.26.0]` heading: PR #93 owns the release; it carries this bullet into 0.26.0 after rebasing on `dev`.
- Publishing to npm.
- Removing mindmap's bun patch (mindmap's own commit after it bumps to 0.26.0).
- `Dialog`, `AlertDialog`, `BottomSheet`, `Drawer` (already correct or native).
- Changing `AnimatedView` defaults; an unsized fade wrapper is correct for inline use.

## Open questions

None.
