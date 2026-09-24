---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Press feedback and haptics (provider-level setting)

## Goal

One consistent pressed/disabled look across the kit's pressables and a single
provider-level haptics setting, so apps stop wiring `expo-haptics` per button.
Additive API; the default preserves today's behavior except where noted.

## Context

- `packages/ui/src/lib/haptics.ts`: `hapticLight/Medium/Success` (no-op on web,
  lazy `require("expo-haptics")`, peer dep already declared).
- `hooks/useScalePress.ts`: scale spring + optional haptic on press-in; under
  reduce motion it still jumps to the pressed scale.
- Today: `Switch.tsx:99-103` and `Checkbox.tsx:124` fire `hapticLight` on
  toggle, `SegmentedControl.tsx` on index change; `Button.tsx:290`,
  `Toggle.tsx:173`, `ToggleGroup`, `Card`, `Item` never fire.
- Pressed styles differ: Button `opacity: 0.9` (+ `muted` bg for outline/ghost),
  scale 0.97; Card scale only; Item has its own. Disabled opacity is 0.6
  (Button, TextInput, Label, DropdownMenu content) or 0.5 (Select, RadioGroup,
  Checkbox, DropdownMenu items).
- Web dev console shows `Unknown event handler property onPressIn/onPressOut`
  on the showcase: some `pressHandlers` land on a DOM element (candidates:
  `Popover.tsx:30`, `DropdownMenu.tsx:50/248/294/360`, `Accordion.tsx:267`,
  `Collapsible.tsx:74`, `BottomSheet.tsx:448` — trigger `asChild` paths).
- `UIProvider.tsx` is the provider; stores live in `state/` and are re-exported
  from `state/index.ts`. The template mounts `<UIProvider keyboardAvoiding={false}>`
  in `client/features/app/RootLayout.tsx:164`.

## Work

1. `constants/interaction.ts` (export from `constants/index.ts`):
   `interaction = { pressedOpacity: 0.85, disabledOpacity: 0.5, pressedScale: 0.97, controlPressedScale: 0.92 }`.
2. `state/feedbackStore.ts`: zustand store `{ haptics: HapticsSetting; setHaptics }`
   with `type HapticsSetting = "off" | "selection" | "all"`, default `"selection"`.
   Export `useFeedbackStore`, `setHaptics` from `state/index.ts`.
   `lib/haptics.ts` gains `hapticSelection()` (fires when setting ≠ "off") and
   `hapticPress()` (fires only when "all"); existing exports unchanged.
3. `UIProvider` prop `haptics?: HapticsSetting` (documented default
   `"selection"`): writes the store on mount and when it changes.
4. Wire controls: Switch/Checkbox/SegmentedControl → `hapticSelection()`
   (replaces direct `hapticLight`); Toggle and ToggleGroup gain
   `hapticSelection()` on user-initiated change (list under Changed); Button
   `haptic?: boolean` prop (undefined → `hapticPress()` on press-in; true/false
   forces); Card and Item pressables use `hapticPress()`.
5. Pressed/disabled consistency: Button pressed uses `interaction.pressedOpacity`
   (filled presets) and keeps `muted` bg for outline/ghost; Card and Item pressed
   use the same opacity; every `disabled` opacity above moves to
   `interaction.disabledOpacity` (Button/TextInput/Label/DropdownMenu content
   change 0.6 → 0.5; list under Changed).
6. `useScalePress`: under reduce motion do not change scale at all (opacity
   carries the feedback); haptics unaffected.
7. Find the DOM leak from the console warning and attach press handlers only to
   elements that render a `Pressable`; confirm the warning is gone on
   `/showcase` and `/components` on web.
8. Docs: `packages/ui/README.md` new "Press feedback and haptics" section
   (setting, default, per-instance override, reduce motion), `LLM_USAGE.md` line,
   `CHANGELOG.md` `## [Unreleased]` Added (setting, `haptic` prop, `interaction`
   tokens) and Changed (Toggle/ToggleGroup haptics, disabled 0.5, pressed 0.85).
   Regenerate `packages/ui/llms-full.md` if a script owns it; `bun run docs:llms`.

Tests first (jest-expo, mock `expo-haptics`): feedback store defaults and
`UIProvider haptics` propagation; Button fires no haptic at default and fires
under `"all"` / `haptic`; Toggle fires under default and not under `"off"`;
`useScalePress` keeps scale 1 under reduce motion; a web-render test under a `jest-expo/web` project if that wiring is cheap;
otherwise verify the dev console on the running showcase and record it in the PR.

## Validation

- `bun run ui:test`, `bun run ui:typecheck`, `bun run typecheck`, `bun run lint`,
  `bun run docs:llms:check`, then `bun run verify`.
- Web: `/showcase` Button/Toggle/Card sections before/after under
  `/tmp/fleet/ui/expo-ui/press-feedback/`; dev console free of the
  `onPressIn`/`onPressOut` warnings.

## Out of scope

Native device haptic verification (note as pending); new IconButton component.

## Open questions

None.
