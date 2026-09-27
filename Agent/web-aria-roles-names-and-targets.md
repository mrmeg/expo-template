---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/128
---

# Web ARIA roles, names and hit targets for the form controls

## Goal
Consumer apps (simplesell, mindmap, fieldnest, downrange) reported kit-level accessibility defects on web. A DOM audit of every showcase route on `origin/dev` (`/tmp/fleet/ui/expo-ui/w4-before/a11y.json`) confirms what is still open and adds what the apps did not see:

- `ToggleGroup` items render `<button role="button" aria-checked>` on web — `aria-checked` is not valid on a button (WCAG 4.1.2). The rn-primitives web `Item` sets `role='button'` before spreading props, so Radix's `role="radio"` is lost while its `aria-checked` survives.
- Every `Icon` without `accessibilityLabel` or `decorative` is exposed as `role="img"` with no name — about 77 unnamed images on every gallery page, and the same in every consumer app (WCAG 1.1.1). The docs already say to omit the label when the icon sits beside text that says it, so an unlabeled icon is decorative by intent.
- `Switch` rows in `Item` (Profile, Settings template) and icon-only `Toggle`s have no accessible name (`role="switch"` / `role="button"` with empty text).
- Labelled `Checkbox` / `RadioGroup.Item` nest two controls (an outer `Pressable role="checkbox"` around the primitive's own `<button role="checkbox">`): screen readers announce the control twice. The primitive box is the only click target on web and it is 20×20 px (`md`) or 16×16 (`sm`) — `hitSlop` does nothing on react-native-web — below the 24×24 minimum of WCAG 2.5.8.
- The password eye/clear icons inside `TextInput` are unlabeled images inside an already-labelled button.
- The showcase `CodeSnippet` "Copy" button is 22 px tall.

## Context
- `packages/ui/src/components/ToggleGroup.tsx` `ToggleGroupItem` spreads `{...props}` into `ToggleGroupPrimitive.Item`; `ToggleGroupPrimitive.useRootContext()` exposes `type` (`"single" | "multiple"`). `node_modules/@rn-primitives/toggle-group/dist/toggle-group.web.js` Item: `<Component ref onPress disabled role='button' {...props} />` — a `role` prop from the kit wins. Radix's single-type item emits `role="radio"` + `aria-checked`; multiple-type emits `aria-pressed` on a button (valid). Native (`toggle-group.js`) already uses `radio`/`checkbox` roles.
- `packages/ui/src/components/Icon.tsx` `iconAccessibilityProps(decorative, label)`: web → `{ "aria-hidden": true }` | `{ role: "img" }` | `{ role: "img", "aria-label" }`; native → `accessible: false` set | `{ accessible: true }` | with `accessibilityLabel`. Tests: `__tests__/Icon.test.tsx`, `Icon.web.test.tsx` ("omits aria-label when no label is given" asserts `role: "img"` — that expectation flips).
- `packages/ui/src/components/Item.tsx`: `Item` (row, optional `onPress`), `ItemGroup`, `ItemMedia`, `ItemContent`, `ItemTitle` (`StyledText` with `{...props}`), `ItemDescription`, `ItemActions`. `separatorInset()` already scans `children` with `Children.toArray` + `isValidElement`. Tests: `__tests__/Item.test.tsx`, `ItemGroup.test.tsx` (has an "on web" block that flips `Platform.OS`).
- `Switch.tsx` spreads `{...props}` (root props include `accessibilityLabel`, `aria-labelledby`) onto `SwitchPrimitives.Root`; `Checkbox.tsx` (lines ~125–215) and `RadioGroup.tsx` (~190–262) render the primitive Root as the visual box, then wrap it in a second `Pressable` with the same role when `label` is set. `Toggle.tsx` spreads `{...props}` onto `TogglePrimitive.Root`.
- `TextInput.tsx` ~432–477: clear button icons are already `decorative`; the eye icon (`name={passwordVisible ? "eye-off" : "eye"}`) is not. The native (Android) variant ~968–979 has the same eye icon.
- `client/showcase/previews.tsx` `TogglePreview` renders icon-only toggles without a label; `client/showcase/CodeSnippet.tsx` copy `Pressable` has no min height. `app/(main)/(tabs)/profile.tsx` and `client/templates/settings/Screen.tsx` render `<Switch>` inside `ItemActions` with the row title in `ItemTitle`.
- Web tests use `import "./forceWebPlatform"` as the first import (`Carousel.web.test.tsx`) or flip `Platform.OS` in a `describe`.
- `spacing` (`packages/ui/src/constants/spacing.ts`): `touchTarget` 44, `rowMinHeight` 40, `iconSm` 16. No 24-pt minimum-target token exists.

## Work
1. **ToggleGroup role.** In `ToggleGroupItem`, read `type` from the root context and pass `role={type === "single" ? "radio" : "button"}` to the primitive Item on web (`Platform.OS === "web"` only; native keeps the primitive's roles). A single group's items then read `role="radio" aria-checked`; a multiple group's stay `role="button" aria-pressed`. Also give the web Root `role="radiogroup"` for single (`"group"` for multiple) if the primitive does not already (check the rendered props in the test).
2. **Icon default.** An `Icon` with neither `accessibilityLabel` nor `decorative` is hidden from the accessibility tree on both platforms (web `aria-hidden: true`; native the same props as `decorative`). A labelled icon keeps `role="img"` + label (web) / `accessible` + `accessibilityLabel` (native). Update the `decorative` and `accessibilityLabel` doc comments, `Icon.web.test.tsx`, `Icon.test.tsx`, README/LLM_USAGE Icon sections. CHANGELOG `### Changed`.
3. **Item labels for trailing controls.** `Item` creates a `useId()` title id and scans its children (like `separatorInset`) for an `ItemContent` → `ItemTitle` whose children are a string (or an array of strings), giving `{ titleId, title }`. It provides `ItemLabelContext` (exported hook `useItemLabel()` from `components/Item`, re-exported through the barrels) with `{ titleId, title }` or `null` outside a row. `ItemTitle` renders `nativeID={titleId}` (id on web) when it is the row's title. `Switch`, `Checkbox` (unlabelled form) and `Toggle` consume it: when the control has no `accessibilityLabel`/`aria-label`/`aria-labelledby` of its own and sits in a row with a title, it gets `aria-labelledby={titleId}` on web and `accessibilityLabel={title}` (+ `accessibilityLabelledBy` where RN supports it) on native. Explicit props always win.
4. **Checkbox / RadioGroup.Item structure and hit target.**
   - One control: when `label` is set, the outer wrapper is a `Pressable` with `accessible={false}` and `focusable={false}` (no role, no state) that only extends the tap area to the label text; the primitive Root is the single control and receives `accessibilityLabel={label}` (native) / `aria-labelledby` pointing at the label `StyledText`'s `nativeID` (web). The `required` asterisk stays visual only.
   - Hit target: the primitive Root becomes the hit box — `minWidth`/`minHeight` of `max(size, 24)` (add `spacing.minTarget = 24` in `constants/spacing.ts` with a comment naming WCAG 2.5.8), centered content, transparent, with negative margins of `-(hit - size) / 2` so layouts do not shift — and an inner `View` carries the border, background, radius, focus ring and the indicator. `hitSlop` stays for native. Keep the animated scale on the Root's wrapper as today.
   - Update `Checkbox.test.tsx` / `RadioGroup.test.tsx` accordingly (one element with the role, label linkage, hit box size on web).
5. **Toggle names.** `TogglePreview` in `client/showcase/previews.tsx` and any icon-only `Toggle` in `client/showcase/*Screen.tsx` get `accessibilityLabel`s that say what they toggle. In `Toggle.tsx`, when `iconOnly` is set and no label prop arrives, `console.warn` once in dev (`process.env.NODE_ENV !== "production"`) naming the fix. README/LLM_USAGE Toggle section: icon-only toggles need a label.
6. **TextInput eye icon** → `decorative` in both variants.
7. **CodeSnippet copy button**: `minHeight: 32`, `paddingHorizontal: spacing.sm`, `justifyContent: "center"`, plus `hitSlop` for native.
8. **Docs + changelog.** `packages/ui/CHANGELOG.md` `## [Unreleased]`: `### Changed` — Icon default (unlabeled icons are hidden from assistive tech; pass `accessibilityLabel` for a standalone icon), Checkbox/Radio single control + 24 px web target; `### Added` — `useItemLabel` / Item-provided names, ToggleGroup radio roles; `### Fixed` — ToggleGroup `aria-checked`, TextInput eye icon. README + LLM_USAGE for Icon, Item, Checkbox, Toggle. Then `bun run docs:llms`.

Write the RED tests first (kit): ToggleGroup web roles (single → radio, multiple → button + no aria-checked), Icon default hidden (web + native), Item-provided `aria-labelledby` / `accessibilityLabel` on Switch, Checkbox/Radio single role + web hit box ≥ 24 + label linkage, Toggle dev warning. Showcase: a test that `TogglePreview` toggles have labels (or extend an existing previews test).

## Validation
- `bun run pkg ui typecheck`, `bun run typecheck`, `bun run lint`, `bun lint:ui --changed`, `bun run gen --check`, `bun run docs:versions:check`, targeted jest (`bunx jest --maxWorkers=2 packages/ui/src/components/__tests__/{ToggleGroup,Toggle,Icon,Item,ItemGroup,Checkbox,RadioGroup,Switch,TextInput}*`), then the full `bun run verify` gates.
- Web: Metro on 8133 (`--max-workers 2`), run `node /tmp/fleet/ui/expo-ui/a11y-probe.mjs <out.json>` — expect `aria-checked-on-button` 0, `img-without-label` 0 on every route except icons that carry labels, `no-accessible-name` 0 on `/profile`, `/screen-settings`, `/components/Switch`, `/components/Toggle`, no `target-under-24px` for checkbox/radio; before/after screenshots of `/components/{Checkbox,RadioGroup,ToggleGroup,Switch,Toggle}` and `/profile` (light + dark) under `/tmp/fleet/ui/expo-ui/aria/{before,after}/` — layouts must not shift.
- No native build needed; iOS device check optional (Checkbox tap on fleet-sim-b) — list as pending if the lock is unavailable.

## Out of scope
- Publishing or bumping `@mrmeg/expo-ui`; adopting the changes in consumer apps.
- ~~`Tabs` trigger heights~~ — the `/showcase` measurement proved the 16 px trigger real (`flex: 1` in the column wrapper collapsed the declared height); fixed in the PR.
- Console warnings (`useNativeDriver`, `pointerEvents`) and the SSR first-render overflow — separate spec.

## Open questions
None.
