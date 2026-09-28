---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# BottomSheet: Android footer and body no longer pad the navigation-bar inset a second time

## Goal

On Android the Material `ModalBottomSheet` that `@expo/ui` hosts the sheet in already keeps the hosted React column above the navigation bar (Material3 `contentWindowInsets` defaults to the system bars). The kit's `BottomSheet.Footer` and footer-less `Body` add `insets.bottom` again, so the footer floats one inset too high and the body loses that height. Same defect class as the iOS fix in #133; apply the same rule on Android.

## Context (measured 09-28 04:27 on the Pixel 6a, dev b3c0fa8, edge-to-edge, gesture navigation)

- Display 1080×2400 @420 dpi (2.625 px/dp); `navigationBars` inset frame `[0,2337][1080,2400]` = 63 px = 24 dp.
- Profile → Edit profile sheet: the hosted column (`ViewFactoryHolder`) frame ends at y 0.974 = 2337 px, exactly the navigation bar's top, so the host insets the column. The Save button (footer) bottom sits at y 0.93 = 2232 px: 105 px = 40 dp above the column's bottom = `spacing.md` (16) + `insets.bottom` (24), the Footer's `paddingBottom` formula, on top of the host's own 24 dp. Visible gap under Save: 64 dp; intended: 40 dp (16 dp above the navigation bar). Screenshot `/tmp/fleet/ui/expo-ui/android-w6/edit-profile-sheet-light.png`.
- `packages/ui/src/components/BottomSheet.tsx` `useSheetInsets()` (≈415): `Platform.OS === "ios" ? { ...insets, bottom: 0 } : insets`; consumers at ≈978 (`Body`: `spacing.md + (hasFooter ? 0 : insets.bottom)`) and ≈1029 (`Footer`: `spacing.md + insets.bottom`). Its doc comment says "Android's Material host still gets the bottom inset from us", which the measurement contradicts.
- Tests: `packages/ui/src/components/__tests__/BottomSheet.test.tsx` "BottomSheet safe-area padding inside the sheet" (≈902): the Android case asserts `spacing.md + INSETS.bottom`.

## Work

1. `useSheetInsets()`: return `{ ...insets, bottom: 0 }` on iOS **and Android**; web keeps the window inset (the web sheet is the kit's own overlay inside the React tree). Rewrite the doc comment: both native hosts lay the column out inside the safe area (SwiftUI 34 pt above the home indicator; Material3 `ModalBottomSheet` `contentWindowInsets` = system bars, so the column ends at the navigation bar's top); `top` still sizes the iOS detent cap.
2. Tests, RED first, in the same describe: the Android footer case flips to `spacing.md`; add "Android: a footer-less body pads only its own spacing"; add a web case (`withPlatform("web")`) asserting the footer still pads `spacing.md + INSETS.bottom`, so the web behaviour is pinned.
3. `packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Fixed`: "Android `BottomSheet.Footer` and a footer-less `Body` no longer pad the navigation-bar inset a second time (Material's host already keeps the column above it); footers sit 16 dp above the navigation bar, bodies gain the inset. Apps that hand-padded an Android sheet footer can drop it." One `### Fixed` section.
4. README `BottomSheet` notes if they mention Android footer insets (grep `Material host`).

## Validation

- `bunx jest --config jest.config.js packages/ui/src/components/__tests__/BottomSheet --watchman=false --maxWorkers=2` RED (Android case) then GREEN; `bun run pkg ui typecheck`.
- Pixel 6a (dev client, Metro fast refresh): Edit profile sheet Save button bottom moves from y 0.93 to ≈0.956 (2295 px = column bottom 2337 − 16 dp), i.e. 16 dp above the navigation bar; screenshot under `/tmp/fleet/ui/expo-ui/android-w6/`. iOS unchanged (helper already returned 0 there).
- CI green on the PR.

## Out of scope

- Keyboard avoidance (Material3 owns it on Android, unchanged).
- Web sheet insets.

## Open questions

None.
