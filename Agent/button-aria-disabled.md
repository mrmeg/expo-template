---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Button: `aria-disabled` announces and dims without blocking the press

## Goal
Let a `Button` be announced and styled as disabled while it stays focusable and pressable, so the app can say why the action is unavailable when it is pressed. uvii's survey "Next" button needs this for a required question: it passes `accessibilityState={{ disabled: blocked }}` and routes the press to a "This question is required." hint (`~/Development/uvii/uvii/client/client/features/survey-response/components/ui/QuestionOverlay.tsx:617-625`, on `@mrmeg/expo-ui` 0.17.0, whose Button has the same code as `dev`). Screen readers on every platform still announce an enabled button. Only sighted users see it as disabled, and uvii fakes that look with its own opacity style (`primaryPillButtonBlocked`, ~line 1021).

After this change, `aria-disabled` (or `accessibilityState.disabled`) without `disabled` follows ARIA's contract: announced as disabled, dimmed, still focusable, and `onPress` still fires. `disabled` and `loading` keep blocking presses exactly as today.

## Context
Verified on `dev` `3474414` (react-native 0.88.0-rc.0, react-native-web 0.21.2):

**`ButtonRoot` in `packages/ui/src/components/Button.tsx`.**
- `isDisabled = disabled || loading` (line 294) is always a boolean, and it feeds everything:
  - `<Pressable accessibilityRole="button" accessibilityState={{ disabled: !!isDisabled, busy: loading }} {...rest} … disabled={isDisabled}>` (338–348);
  - `useScalePress({ disabled })` (295);
  - the shadow, `withShadow && !isDisabled` (369);
  - `styles.disabled` and `disabledStyle` (374–375);
  - the focus ring, `focused && !isDisabled` (376);
  - `disabledTextStyle` (410);
  - the accessories' `disabled` (397, 425).
- The pressed styles (370–373) apply regardless of `isDisabled`.
- A consumer `accessibilityState` arrives in `rest` and replaces the kit's object, which drops `busy`.
- `ButtonProps extends PressableProps`, so `aria-disabled` and `accessibilityState` are already typed. This needs no type change.

**Native.** `node_modules/react-native/Libraries/Components/Pressable/Pressable.js`, ~249–258:
- Builds `accessibilityState.disabled` from `aria-disabled ?? accessibilityState.disabled`.
- Then `disabled != null ? {..., disabled}` overwrites it, so Button's `disabled={false}` erases the consumer's value.
- The press config reads only the `disabled` prop, so presses still fire when that prop is `undefined`.

**Web.**
- `node_modules/react-native-web/dist/exports/Pressable/index.js`, ~118–132, renders `View` with `{...rest, "aria-disabled": disabled, tabIndex: disabled ? -1 : 0}`. The Pressable's own `disabled` therefore always overwrites a consumer `aria-disabled`.
- RNW 0.21 ignores `accessibilityState` entirely.
- `role="button"` renders a real `<button>` (`dist/modules/AccessibilityUtil/propsToAccessibilityComponent.js`). When `aria-disabled` or `accessibilityDisabled` is true, `dist/modules/createDOMProps/index.js` (~314) also adds the native `disabled` attribute, which blocks clicks and focus.
- So no prop can produce a `<button aria-disabled="true">` that still clicks; the attribute has to be set on the host node. RNW's `PressResponder` reads only the `role` attribute, never `aria-disabled`, so the attribute does not block presses.

**Refs.** Under React 19, `ref` reaches `ButtonRoot` as a prop and is forwarded to the Pressable through `rest`. `asChild` triggers pass one via `@rn-primitives/slot`, e.g. `client/showcase/details.tsx:245` `<DialogTrigger asChild><Button … /></DialogTrigger>`. The kit has no ref-composition helper: `grep -rn "composeRefs\|mergeRefs" packages/ui/src` is empty. `TextInput.tsx` and `BottomSheet.tsx` already use plain `useLayoutEffect`.

**Tests.**
- `packages/ui/src/components/__tests__/Button.test.tsx` uses RNTL with the native renderer and mocks `useScalePress` (`mockScalePressIn`/`mockScalePressOut`, line 77). Its "Accessibility" and "Interactions" blocks are the patterns to extend.
- `Button.haptics.test.tsx` tests the real haptics setting.
- Web tests import `./forceWebPlatform` first. Jest still renders RN's `Pressable`, not RNW's, so the DOM contract is proven by the browser check.

**Showcase and docs.**
- Showcase: `COMPONENT_DETAILS.Button` in `client/showcase/details.tsx:138` (its variants include `disabled`), served at `/components/Button`.
- Docs: `packages/ui/README.md` "Press feedback and haptics" (~430), the `packages/ui/LLM_USAGE.md` rules (~187–190), and `packages/ui/CHANGELOG.md` `## [Unreleased]`.
- `Card` and `Item` take fixed props with no `rest` spread, so they are unaffected.

**In flight.** `agent/web-aria-roles-names-and-targets` (fleet worktree `~/.fleet/wt/expo-ui-audit`) edits:
- `Checkbox`, `Icon`, `Item`, `RadioGroup`, `Switch`, `TextInput`, `Toggle` and `ToggleGroup`;
- `constants/spacing.ts`;
- `client/showcase/previews.tsx`;
- the kit CHANGELOG, README and LLM_USAGE.

Do not touch those component files. Only the docs overlap, and those conflicts are mechanical.

## Work
1. **Separate press blocking from the announced state** in `ButtonRoot`. Destructure `accessibilityState` and `"aria-disabled": ariaDisabled` out of the props.
   - `pressBlocked = !!disabled || loading`.
   - `announcedDisabled = pressBlocked || (ariaDisabled ?? accessibilityState?.disabled) === true`.
   - Pass `disabled={pressBlocked || undefined}`, never `false`, and `accessibilityState={{ ...accessibilityState, disabled: announcedDisabled, busy: loading }}`.
   - `announcedDisabled` drives the whole look:
     - `styles.disabled`, `disabledStyle` and `disabledTextStyle`;
     - the accessories' `disabled`;
     - no shadow and no pressed styles;
     - `useScalePress({ disabled })`, so there is no scale and no haptic.
   - `pressBlocked` drives the Pressable's `disabled` and the focus-ring guard, so a focused `aria-disabled` button shows its ring.
   - `onPress`, `onPressIn`, `onPressOut` and `onLongPress` fire unless `pressBlocked`.
2. **Web DOM attribute.**
   - When `Platform.OS === "web"` and `announcedDisabled && !pressBlocked`, set `aria-disabled="true"` on the Pressable's host node in a `useLayoutEffect`.
   - Remove the attribute when that condition stops holding, unless `pressBlocked` (RNW owns the attribute then).
   - Get the node through a ref composed with `props.ref`, so `asChild` triggers keep their ref. Put the helper in `packages/ui/src/lib/` and handle both callback and object refs.
   - Comment the reason (RNW's Pressable overwrites the prop). Also note that on server-rendered pages the attribute only appears after hydration.
3. **Showcase.**
   - Add an `aria-disabled` variant to `COMPONENT_DETAILS.Button`: a small component with a `size="sm"` Button, text "Publish", that shows a one-line reason under itself when pressed ("Add a title first").
   - Update the entry's `summary` to mention it.
4. **Docs.**
   - README: a short paragraph next to "Press feedback and haptics" on when to use `disabled` (swallows presses, leaves the web tab order) and when to use `aria-disabled` (announced and dimmed, still pressable, so the press can explain), with a snippet.
   - LLM_USAGE: one rule saying the same.
   - The `disabled` prop's doc comment: point at `aria-disabled` for the explain-why case.
   - CHANGELOG `### Fixed`: Button now honours `aria-disabled` and `accessibilityState.disabled` (announced, dimmed, still pressable), and a consumer `accessibilityState` keeps `busy`.
   - Then run `bun run docs:llms`.

Write the RED tests first, in `Button.test.tsx` and `Button.haptics.test.tsx`:
- `aria-disabled` alone and `accessibilityState={{ disabled: true }}` alone each give `accessibilityState.disabled === true`. Each also fires `onPress`, passes `disabled: true` to `useScalePress`, and renders `interaction.disabledOpacity` with no shadow.
- There is no haptic under the `"all"` setting.
- `disabled` still blocks presses when `aria-disabled={false}` is also passed.
- `accessibilityState={{ selected: true }}` together with `loading` gives `busy: true` and `selected: true`.
- Cover the web effect in a `forceWebPlatform` test if the renderer can supply a host node with `setAttribute`/`removeAttribute`. Either way the browser check is authoritative.

## Validation
- `bunx jest --maxWorkers=2 packages/ui/src/components/__tests__/Button*`.
- `bun run pkg ui typecheck`, `bun run typecheck`, `bun run lint`, `bun lint:ui --changed` and `bun run docs:llms:check`.
- Then run the full gates through the heavy slot: `bash ~/Development/portfolio/bin/heavy-slot.sh run button-aria -- bun run verify --max-workers 2`.
- **Web.** Run Metro web on a free port (`--max-workers 2`) and open `/components/Button` in a browser, in light and dark:
  - The `aria-disabled` variant is a `<button aria-disabled="true">` with no `disabled` attribute and `tabindex="0"`.
  - Tab reaches it, and Enter, Space and click each show the reason.
  - The `disabled` variant is still `<button disabled aria-disabled="true">`, and Tab skips it.
  - The `/components/Dialog` `DialogTrigger asChild` Button still opens its dialog.
  - Screenshots show both variants with the same dimmed look.
- **Native.** On the iOS simulator (and the Android emulator if one is free):
  - The accessibility tree reports the `aria-disabled` variant as not enabled.
  - A tap still shows the reason.
  - VoiceOver/TalkBack double-tap reaching `onPress` is a device check. Run it if a screen reader is available; otherwise list it as pending in the PR.

## Out of scope
- Publishing or bumping `@mrmeg/expo-ui`.
- uvii's upgrade from 0.17.0. After it upgrades, `QuestionOverlay` can drop `primaryPillButtonBlocked`.
- A new prop such as `focusableWhenDisabled` or `onDisabledPress`; ARIA's own attribute covers the case.
- Announcing `busy` on web. RNW drops `accessibilityState`, so a loading Button reads only as disabled there.
- The same pass-through for other kit pressables.
- The Button web cursor.

## Merge plan
- Base: `dev`.
- If `agent/web-aria-roles-names-and-targets` merges first, merge `origin/dev` into this branch and keep both sides in the CHANGELOG, README and LLM_USAGE hunks.
- Then rerun `bun run docs:llms`.

## Open questions
None.
