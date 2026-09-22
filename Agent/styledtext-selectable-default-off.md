---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/98
---

# `StyledText` defaults `selectable` to `false` on Android

## Goal

On Android, `StyledText` (and every alias built on it) renders non-selectable unless the caller opts in with `selectable`, so a tap on ordinary label text can no longer take native focus from a focused `TextInput` and hide the keyboard. iOS and web keep the current default (`true`). Downstream apps stop needing `selectable={false}` on every label that sits near a field.

## Context

Verified on `dev` at 3f72dc4 (`@mrmeg/expo-ui` 0.27.0 source, unpublished).

- `packages/ui/src/components/StyledText.tsx:171` resolves `selectable ?? contextSelectable ?? true` and passes it as both the `selectable` prop and `userSelect: "auto" | "none"` style (`:222`, `:232`). `TextSelectabilityContext` (`StyledText.context.ts:7`) is how package controls (Button, Tabs, Badge, …) turn labels off.
- RN Android implements `selectable` with `TextView.setTextIsSelectable(true)`, which makes the view focusable-in-touch-mode. Tapping any selectable `Text` while an input is focused moves view focus to the label and closes the IME. RN's own default for `Text.selectable` is `false` on every platform; the package's `true` default is what exposes it.
- Confirmed downstream tonight: tractor-tools-direct PR #19 (`app/(main)/match.tsx:225`, `client/features/hay-calculator/components/HayCalculatorForm.tsx:135`) and mindmap PR #38 (`client/components/graph/NodeEditModal.tsx:351`, `client/components/groups/GroupBrowserPanel.tsx:233,285,312`) added `selectable={false}` to option chips because tapping a chip label hid the keyboard. `packages/ui/CHANGELOG.md:146-150` already documents the hazard as a consumer note instead of fixing the default.
- Docs state the default and the intent: `packages/ui/README.md:316-322` ("defaults to `true`"; "Preserve selection for ordinary readable text"), `packages/ui/LLM_USAGE.md:266-274`, `docs/e2e.md:161` ("ordinary content and input text remain selectable" on the Android e2e run).
- Tests asserting the default: `packages/ui/src/components/__tests__/StyledText.i18n.test.tsx:50-56` (default `true`, under jest-expo's default `Platform.OS === "ios"`), `:58-68` (context `false` wins).
- Platform under jest: `TextInput.android.test.tsx:135-147` flips `Platform.OS = "android"` in `beforeEach` and restores it in `afterEach`; that works only for values read at render time, not module load (see the header of `StyledText.web.test.tsx`). Read `Platform.OS` inside the component, not in a module constant.

**Decision (night mode).** Android-only. The docs want readable text to stay selectable, and iOS/web have no focus-theft path (iOS `selectable` only enables long-press selection; web `userSelect: none` would block copying body text). An explicit `selectable` prop wins on every platform; `TextSelectabilityContext` still wins over the platform default.

## Work

1. `packages/ui/src/components/StyledText.tsx`
   - Import `Platform` from `react-native` (the file already imports `StyleSheet`, `Text as RNText`).
   - Replace `:171` with
     `const platformDefaultSelectable = Platform.OS !== "android";`
     `const resolvedSelectable = selectable ?? contextSelectable ?? platformDefaultSelectable;`
   - Update the feature comment at `:141-142`: selection is on by default on iOS and web and off by default on Android, where a selectable `Text` is focusable-in-touch-mode and steals focus from an input; pass `selectable` to opt in (long-press copy for chat bubbles, codes, addresses) and `selectable={false}` for control chrome on every platform.
   - `TextProps` is `RNTextProps & { … }` (`:83`), so `selectable` is inherited and has no local JSDoc; the feature comment is the only in-file doc. Do not add a prop override.
2. Tests
   - `StyledText.i18n.test.tsx`: rename `:50` to "keeps standalone text selectable by default on iOS" (unchanged assertion).
   - New `packages/ui/src/components/__tests__/StyledText.android.test.tsx`, same `useTheme` mock as `StyledText.test.tsx:29-40` and the `Platform.OS` flip pattern from `TextInput.android.test.tsx:135-147`. Cases: default renders `props.selectable === false` and flattened style `userSelect: "none"`; `selectable` (explicit `true`) renders `true` / `"auto"`; `selectable={false}` renders `false`; `TextSelectabilityContext.Provider value={true}` renders `true` (context beats the platform default); `TextSelectabilityContext.Provider value={false}` plus explicit `selectable` renders `true` (prop beats context). One case in the same file with `Platform.OS = "web"` set in the test body: default stays `true` (render-time read; `constants/fonts.ts` is not under test here).
3. Docs
   - `packages/ui/README.md:316-322`: `selectable` "defaults to `true` on iOS and web and to `false` on Android (0.27.0), where selectable text is focusable and takes focus and the IME from an input. Opt in per element with `selectable` for copyable content. Package controls disable it everywhere for labels and interactive chrome." Drop the "For app-owned `Pressable` labels …" paragraph's Android hazard sentence; keep the advice to set `selectable={false}` on control chrome so iOS/web do not show a selection cursor on labels.
   - `packages/ui/LLM_USAGE.md:266-274`: same default statement in the props line; rewrite the `Set selectable={false} …` paragraph to: control chrome `selectable={false}` on every platform; Android ordinary text is non-selectable by default; use `selectable` for copyable content. Then `bun run docs:llms` and commit `llms-full.txt`.
   - `docs/e2e.md:161`: append "(that run predates 0.27.0; on Android `StyledText` is now non-selectable by default and only opted-in text selects)".
   - `packages/ui/CHANGELOG.md`, under the existing `## [0.27.0]` heading, `### Changed`: "**`StyledText` is non-selectable by default on Android.** … explicit `selectable` opts in; iOS/web default unchanged; `TextSelectabilityContext` unchanged. Consumers can drop `selectable={false}` added only to keep the keyboard up on Android (tractor-tools-direct #19, mindmap #38); keeping it is harmless." Do not bump the version.
4. Template call sites: none required. `client/features/auth/components/*.tsx` (11 sites) and `client/showcase/ThemeToggle.tsx:14,21` set `selectable={false}` on control labels, which remains the documented convention.

## Validation

- `cd packages/ui && bun run typecheck && bun run test && bun run build` (test: 52 suites after the new file; 588 + new cases).
- Root: `bun run lint`, `bun run docs:llms:check`, `bun run docs:versions:check`.
- `bunx jest packages/ui/src/components/__tests__/StyledText` green (all five StyledText files).
- Manual (no device tonight; list in the PR): Android emulator, template `app/(main)/(demos)/form-demo.tsx` — focus a field, tap a body `StyledText`: keyboard stays up; long-press it: no selection handles. Same tap on iOS: keyboard stays up and long-press still selects.

### Downstream follow-ups (after Matt publishes 0.27.0)

Call sites whose `selectable={false}` exists only as the Android keyboard workaround and may be removed with their explanatory comments (the accompanying tests assert `props.selectable === false` under jest-expo iOS and must be deleted or reworded if the prop goes):

- tractor-tools-direct: `app/(main)/match.tsx:225`, `client/features/hay-calculator/components/HayCalculatorForm.tsx:135` (+ tests in `app/(main)/__tests__/match.test.tsx`, `client/features/hay-calculator/__tests__/HayCalculatorForm.test.tsx`).
- mindmap: `client/components/graph/NodeEditModal.tsx:351`, `client/components/groups/GroupBrowserPanel.tsx:233,285,312` (+ `__tests__/NodeEditModal.test.tsx`, `__tests__/GroupBrowserPanel.test.tsx`).
- Other consumers (doglog 87 sites/30 files, simplesell 36/14, camera-app 11/5, fieldnest 7/2, terlo 3, neurospicyos 1, downrangedays 0) use the prop on control chrome by convention; nothing to change. Every consumer gains the fix for untouched labels on bump.

## Out of scope

- Changing the iOS or web default; `TextSelectabilityContext` semantics.
- Package controls' explicit `selectable={false}` (still wanted for iOS/web cursor behavior).
- Version bump or publish.

## Open questions

None.
