---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/133
---

# iOS BottomSheet column matches the real detent height

## Goal
A `BottomSheet` at a percentage snap point no longer cuts off its last row on iOS (fieldnest quick actions on the Pro Max, 09-27). The kit's column cap is computed from the height SwiftUI actually gives the sheet.

## Context
- `packages/ui/src/components/BottomSheet.tsx` ~line 680: on iOS the content column gets `maxHeight: detentHeight` where a percentage snap is `parseFloat(snap) / 100 * winH` (`useWindowDimensions().height`) and a number is used as-is. The comment block above it explains why the cap exists (the RN-in-SwiftUI host does not clamp the column; `flex: 1` needs a definite height for `Body` to scroll).
- `@expo/ui/src/community/bottom-sheet/BottomSheet.ios.tsx` maps `"50%"` to SwiftUI `.fraction(0.5)`, a fraction of the sheet's *maximum* height, which UIKit sets to the window height minus the top safe-area inset minus a 10 pt gap (the `.large` detent's top edge). It also wraps the hosted column in a `View` with `paddingTop: 16` whenever the native grabber is shown (`handleComponent !== null`, i.e. the kit's `BottomSheet.Handle` is absent). Neither is accounted for, so on a Dynamic Island phone a 50 % sheet's column is `0.5 × (62 + 10) + 16 ≈ 52 pt` taller than the sheet and SwiftUI clips it: one row gone, on every such phone, not only the Pro Max.
- Insets: `useSheetInsets` (= `useWindowInsets`, falls back to `initialWindowMetrics`) already exists in the file for content padding.
- Tests: `packages/ui/src/components/__tests__/BottomSheet.test.tsx` → `columnStyle()` helpers near line 470 (`caps the column at a percentage detent of the window on iOS` expects `0.55 * window.height`; `caps the column at a fixed detent` expects `320`; Android has no `maxHeight`).

## Work
1. In `BottomSheet.tsx` add two documented constants: `IOS_SHEET_TOP_GAP = 10` (UIKit's gap between the top safe area and a `.large` sheet's top edge) and `IOS_HOST_HANDLE_PADDING = 16` (`@expo/ui`'s `paddingTop` under the native grabber).
2. Compute, iOS only: `available = winH - insets.top - IOS_SHEET_TOP_GAP`; `sheetHeight = typeof snap === "number" ? Math.min(snap, available) : parseFloat(snap) / 100 * available`; `detentHeight = sheetHeight - (hasInteractiveHandle ? 0 : IOS_HOST_HANDLE_PADDING)` (the kit's `Handle` passes `handleComponent={null}`, so no host padding then). Read `insets.top` from `useSheetInsets()`. Web keeps its own sizing (the cap is inert there); Android unchanged (no `maxHeight`). Update the explanatory comment.
3. `packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Fixed`: describe the clipped last row and the corrected cap.

## Validation
- RED first in `BottomSheet.test.tsx`: wrap `columnStyle` in `SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}` and expect `maxHeight === 0.55 * (window.height - 59 - 10) - 16` for `["55%"]`; `320 - 16` for `[320]`; a fixed detent larger than the available height clamps to `available - 16`; with `<BottomSheet.Handle />` in the content the `- 16` disappears; Android still has no `maxHeight`.
- `bun run pkg ui test -- --maxWorkers=2 BottomSheet`, `bun run pkg ui typecheck`, `bun run lint` (through heavy-slot).
- Device (fleet-sim-b, dev client, iOS 26): a `snapPoints={["50%"]}` sheet with enough `Item` rows to fill it (the showcase BottomSheet preview or a temporary demo) shows its last row and bottom padding fully; before/after screenshots into `/tmp/fleet/ui/expo-ui/sheet-detent/`. Pro Max if its lock is free.

## Out of scope
iPad form-sheet geometry; Android `ModalBottomSheet` sizing; measuring the sheet at runtime.

## Open questions
None.
