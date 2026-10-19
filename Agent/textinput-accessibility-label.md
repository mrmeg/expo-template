---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/157
---

# TextInput: name the native field from `label`, describe it with `errorText`

## Goal

`@mrmeg/expo-ui`'s `TextInput` renders `label` as plain text beside the field
on iOS and Android and gives the native field no accessible name, so VoiceOver
and TalkBack announce every kit form field by its placeholder (or as an
unnamed edit box). On web the field is named but its error and helper text are
not linked. Fix the kit so `label` names the field and `errorText` (else
`helperText`) describes it on all three platforms. Every consumer app gets the
fix by bumping the kit; no app change is needed beyond passing `label` and
`errorText`, which the fleet migration specs already ask for.

Found by the fleet audit (tractor-tools-direct, "Checkout, My Orders lookup,
Write a review, Share your setup"); the verifier confirmed the kit only sets
`accessibilityLabel` on the web path.

## Context

Verified on `dev` at 4760902 (`@expo/ui` 58.0.16).

- `packages/ui/src/components/TextInput.tsx:243` dispatches: native platforms
  render `NativeTextInput` (line 540), web renders `WebTextInput`.
- **Web** (`WebTextInput`): the label is a `StyledText` (lines 363-370), the RN
  `TextInput` gets `accessibilityLabel={label}` and
  `accessibilityHint={helperText || errorText}` (lines 423-424). react-native-web
  maps `accessibilityLabel` to `aria-label`, so the field is named. It has no
  `accessibilityHint` mapping (absent from
  `node_modules/react-native-web/dist/modules/createDOMProps/index.js`), so the
  hint is dropped and the error/helper text (lines 497-507) is not associated.
  The hint also prefers `helperText` over `errorText`, the reverse of what the
  visible text shows (`errorText || helperText`).
- **Native** (`NativeTextInput`): the label is a `StyledText` (lines 882-889)
  that VoiceOver/TalkBack read as a separate element. The field is
  `NativeTextField` (lines 949-968) spread with `rest`; nothing derives an
  accessible name from `label`, and a consumer's own `accessibilityLabel` lands
  in `rest` and is ignored by the native field.
- `packages/ui/src/components/nativeTextField.tsx` re-exports `@expo/ui`'s
  universal `TextInput`. Metro resolves it on iOS and web; Jest (`jest-expo`,
  haste `defaultPlatform: "ios"`, platforms `android, ios, native`) and
  TypeScript resolve it too. Its props (`@expo/ui` `TextInputProps`) have no
  accessibility props. The iOS universal field
  (`node_modules/@expo/ui/build/universal/TextInput/index.ios.js:64`) prepends
  the caller's `modifiers` to its own, so a SwiftUI modifier passed in
  `modifiers` reaches the `TextField`/`SecureField`.
- `nativeTextField.android.tsx` is the package-owned Compose port. It already
  takes `modifiers: userModifiers` and appends `semantics({ contentType })` for
  `autoComplete` (line 296).
- Available modifiers: `@expo/ui/swift-ui/modifiers` exports
  `accessibilityLabel(label)` and `accessibilityHint(hint)`;
  `@expo/ui/jetpack-compose/modifiers` exports `semantics({ contentType,
  contentDescription })` (no hint or error key). Both subpaths are in
  `@expo/ui`'s export map.
- `@expo/ui/swift-ui/modifiers/index.js` calls `requireNativeModule('ExpoUI')`
  at module load, so it must never be imported by a file web resolves, and
  Jest needs a mock for it.
- Web ids: `useId()` values differ between Expo Router's server render and
  hydration (`docs/server-guide.md`, "`useId` diverges"). The kit's rule is to
  emit `id`/`aria-*` id pairs only after `useHydrated()`
  (`packages/ui/src/hooks/useHydrated.ts`) returns true; `Item.tsx` is the
  pattern and `__tests__/Item.test.tsx:116` mocks `useHydrated`.
- Draft PR #156 also edits `packages/ui/CHANGELOG.md` (adds `### Fixed` under
  `## [Unreleased]`). No other open PR touches `TextInput.tsx`,
  `nativeTextField*`, or `test/setup.ts`.

## Work

### Native field props (`nativeTextField*`)

1. `nativeTextField.tsx` (default: web, Jest/TS types): change
   `NativeTextFieldProps` to `TextInputProps & { accessibilityLabel?: string;
   accessibilityHint?: string }` and export a `NativeTextField` that drops the
   two props and renders `@expo/ui`'s `TextInput` with the rest (web never
   renders it; this keeps the type surface shared). Keep the doc comment
   accurate: it no longer covers iOS.
2. New `nativeTextField.ios.tsx`: same exports and types (import the type from
   `./nativeTextField`). Render `@expo/ui`'s `TextInput` with
   `modifiers={[...(modifiers ?? []), ...(accessibilityLabel ?
   [accessibilityLabel(...)] : []), ...(accessibilityHint ?
   [accessibilityHint(...)] : [])]}` from `@expo/ui/swift-ui/modifiers`.
   Forward the ref. Header comment in the style of the Android file.
3. `nativeTextField.android.tsx`: accept the two props and add one
   `semantics({ contentDescription })` modifier, where `contentDescription` is
   `[accessibilityLabel, accessibilityHint].filter(Boolean).join(", ")` (Compose
   semantics has no hint key). Merge it with the existing `autoComplete`
   `semantics` call into a single modifier when both apply. Add a third item to
   the header's "differs in exactly two places" list.

### `TextInput.tsx`

4. `NativeTextInput`: destructure `accessibilityLabel` and `accessibilityHint`
   out of `rest`. Pass the field
   `accessibilityLabel={accessibilityLabel ?? label}` and
   `accessibilityHint={accessibilityHint ?? (errorText || helperText)}`
   (consumer props win). When the field carries the label, hide the visible
   label `View` from assistive tech (`accessibilityElementsHidden` and
   `importantForAccessibility="no-hide-descendants"`) so it is not read twice.
   Leave the helper/error `StyledText` readable. The hidden handoff Host
   (lines 941-944) already hides the inactive field; both fields get the props.
5. `WebTextInput`: `{...rest}` is spread before `accessibilityLabel={label}`
   (line 381 vs 423), so today `label` overrides a consumer's
   `accessibilityLabel`; make it `accessibilityLabel={rest.accessibilityLabel
   ?? label}` (or destructure) so the consumer wins, as on native. Drop the dead `accessibilityHint` and add `aria-describedby`
   pointing at the helper/error `StyledText`, which gets a matching `nativeID`.
   Base the id on the consumer's `nativeID` when given (`${nativeID}-desc`),
   else `useId()`, and emit both the `nativeID` and `aria-describedby` only
   when `useHydrated()` is true. Also keep `aria-invalid` as is.
   Do **not** switch the name to `aria-labelledby` or a `<label for>`: the
   visible label includes the required ` *`, so a labelledby name would read
   "Email star", and `aria-label` already names the field from SSR on.
   Record that reason in a short comment.
6. Update the `NativeTextInput` doc comment (lines 517-538) to say the field is
   named from `label` and described by `errorText`/`helperText`.

### Tests

7. `test/setup.ts`: add a recording mock for `@expo/ui/swift-ui/modifiers`
   (`accessibilityLabel` / `accessibilityHint` return `{ name, value }`), since
   Jest now resolves `nativeTextField.ios.tsx` for every `./nativeTextField`
   import (haste `defaultPlatform: "ios"`), including under
   `forceWebPlatform`. The existing `@expo/ui` mock
   forwards `modifiers` to an RN `TextInput`, so tests can read them.
8. iOS — `__tests__/TextInput.test.tsx` (Jest default platform): with
   `label="Email" errorText="Email is required"` the native field's `modifiers`
   hold `accessibilityLabel("Email")` and `accessibilityHint("Email is
   required")`; `helperText` is the hint when there is no `errorText`; a
   consumer `accessibilityLabel` / `modifiers` win / are kept first; no
   accessibility modifiers without `label`; the visible label is hidden from
   accessibility. Add a direct `nativeTextField.ios.test.tsx` if that is
   cleaner than asserting through `TextInput`.
9. Android — `__tests__/nativeTextField.android.test.tsx` (imports the Android
   file directly with recording Compose mocks): `contentDescription` is
   `"Email, Email is required"`, label only when there is no hint, merged with
   `contentType` into one `semantics` call, absent when neither prop is set.
   Extend `__tests__/TextInput.android.test.tsx` with one case that the field
   receives `accessibilityLabel`/`accessibilityHint` from `label`/`errorText`.
   The "re-exports @expo/ui's TextInput from the default variant" case
   (`nativeTextField.android.test.tsx:354`) no longer holds: import the default
   file by explicit path (`../nativeTextField.tsx`) and assert it drops the two
   accessibility props and renders `@expo/ui`'s `TextInput`; keep the
   "only route from TextInput.tsx" case.
10. Web — new `__tests__/TextInput.web.test.tsx` importing
    `./forceWebPlatform` first and mocking `useHydrated` as in
    `Item.test.tsx`: the input's `accessibilityLabel` is the label; hydrated,
    its `aria-describedby` equals the error text's `nativeID` and follows a
    consumer `nativeID`; unhydrated, neither id is emitted; no
    `accessibilityHint` is passed.

### Changelog

11. `packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Fixed`: one bullet saying
    the native `TextInput` now names its field from `label` (SwiftUI
    `accessibilityLabel`, Compose `contentDescription`) and describes it with
    `errorText`/`helperText`, and on web the error/helper text is linked with
    `aria-describedby`. If #156 has merged, add the bullet under its existing
    `### Fixed`; otherwise create the heading. **No version bump** and no
    `package.json` change; the next release picks it up.

## Exclusions

- No visual change: label, asterisk, helper and error text render as today.
- `required` is not added to the native name (web keeps `aria-required`).
- Live announcement of a newly shown error (`accessibilityLiveRegion` /
  `AccessibilityInfo.announceForAccessibility`) is out of scope.
- Consumer app changes (passing `label`/`errorText`) belong to the fleet
  migration specs.

## Validation

- `bun run pkg ui typecheck` and `bun run pkg ui test` (includes
  `check:forbidden-imports`).
- `bun run pkg ui build`, then confirm `dist/components/nativeTextField.ios.js`
  exists and `bun run pkg ui consumer-smoke` passes.
- `bun run verify`.
- `bun run build && bun run start`, open a route with a labelled kit
  `TextInput` with an error (the components gallery detail page,
  `/components/TextInput`, registry id `TextInput`), and in
  the browser confirm no hydration warning in the console and that the
  `<input>` has `aria-label` and an `aria-describedby` resolving to the error
  text.
- Device checks (report the blocker if a simulator/emulator is unavailable):
  iOS simulator build, inspect the accessibility tree (Accessibility Inspector
  or the agent-device snapshot) and confirm the text field's label is the
  `label` and its hint the error text, with no separate label element; Android
  emulator, `adb shell uiautomator dump` and confirm the `EditText`'s
  `content-desc` is `"<label>, <error>"`. Check a secure field before and after
  the eye toggle on both.
