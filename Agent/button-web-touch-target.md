---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/142
---

# Button: a 44-pt pointer target on web without changing the drawn size

## Goal

`Button` sizes `sm` / `md` / `lg` draw 28 / 32 / 40 pt tall. Native gets a 44-pt hit area through computed `hitSlop`; on web `hitSlop` does nothing (`Platform.OS === "web"` passes `undefined`, and react-native-web's `Pressable` ignores the prop anyway), so the pointer target is the drawn box: 32 px for the default size, above the WCAG 2.5.8 minimum (24) but below the 44-pt target every other kit control reaches. Give the web button a real 44-pt vertical target while the drawn box, layout and popover anchoring stay exactly as they are. Additive; no API change.

## Context (verified on `dev` 53b2d96)

- `packages/ui/src/components/Button.tsx`: `SIZE_CONFIGS` (line 43) heights 28/32/40; `getNativeHitSlop` (64) = `ceil((spacing.touchTarget − height) / 2)`; the `Pressable` (≈385) passes `hitSlop={rest.hitSlop ?? (Platform.OS === "web" ? undefined : getNativeHitSlop(sizeConfig))}` and carries only `{ alignSelf }` as style. The drawn box is the inner `View` with `styles.button` (`position: "relative"`, `minHeight: sizeConfig.height`, radius, padding, `cursor: pointer` on web; ≈400–425), which also carries the focus ring and the caller `style`. Inside it: the optional loader overlay (`styles.loaderOverlay`, absolute, `pointerEvents: none`) and the `styles.content` row.
- `spacing.touchTarget` = 44, `spacing.minTarget` = 24 (`packages/ui/src/constants/spacing.ts` 40–41).
- Precedent for a web hit box larger than the drawn box: `Checkbox.tsx` 126–132 grows the control to `spacing.minTarget` and takes the extra back in negative margins. That works for a fixed-size box; a Button is the anchor of `Popover` / `Tooltip` (Radix measures the trigger element = the `Pressable` root), so the root's rect must not grow. Extend the target with a child instead.
- Web tests force the platform by importing `./forceWebPlatform` first (see `pressableFocusRing.web.test.tsx`); `Icon.tsx` already emits `"aria-hidden": true` on RN views; tests find hidden nodes by `getByTestId(..., { includeHiddenElements: true })`.
- README `packages/ui/README.md` 861 says "Native targets add computed hit slop up to 44px"; the spacing table (314) says "pair a smaller visual height with `hitSlop`".

## Work

1. **Hit extender (web only)** in `Button.tsx`. Compute web insets once per render:
   - default: `slop = getNativeHitSlop(sizeConfig)` (6 for md, 8 sm, 2 lg) applied to `top` and `bottom` only; `left`/`right` 0. Vertical-only so two buttons in an 8-pt-gap row never share a hit region (native's symmetric slop overlaps there; on web z-order would make it arbitrary).
   - when the caller passes `hitSlop` (RN `Insets | number`), use it verbatim on web (number → all four sides; missing keys → 0), so `hitSlop` finally means something on web. Native keeps today's behaviour byte for byte.
   - when every inset is 0 (a `height ≥ 44` custom style is not detectable; only `hitSlop={0}`) render nothing.
   - render, as the **last child of the `styles.button` View** (so it sits above the content in paint order but inside the positioned box):
     `<View testID="button-hit-target" aria-hidden={true} importantForAccessibility="no-hide-descendants" focusable={false} style={{ position: "absolute", top: -top, bottom: -bottom, left: -left, right: -right }} />`
     Transparent, no size of its own, absolutely positioned so layout does not move. Clicks on it bubble to the `Pressable` root (a DOM ancestor), so `onPress`, hover, pressed state, `cursor` (inherited) all behave as a click on the drawn box. Only on `Platform.OS === "web"`; the native tree is unchanged (Android's fixed-tree rule in `stateSurfaceProps` is untouched because the node is never rendered there).
   - `styles.button` already has `position: "relative"`; do not add `overflow: hidden` anywhere. A clipping ancestor (`overflow: hidden` card) reduces the target back toward the drawn box, never below today.
2. **Tests, RED first.** New `packages/ui/src/components/__tests__/Button.web.test.tsx` (imports `./forceWebPlatform` first, mocks `useTheme` like `Button.test.tsx`):
   - md renders the extender with `top/bottom: -6`, `left/right: 0` (flatten style); sm `-8`; lg `-2`.
   - `hitSlop={{ top: 10, left: 4 }}` → `-10 / 0 / -4 / 0`; `hitSlop={5}` → all `-5`; `hitSlop={0}` → no extender.
   - `fireEvent.press(extender)` calls `onPress` once; with `disabled` it does not.
   - the extender carries `aria-hidden`, `focusable === false`; `screen.getByRole("button")` still returns exactly one button, and its `minHeight` (the `styles.button` view, flattened) is still 32 for md — the drawn size did not change.
   - In the existing native `Button.test.tsx`: assert no `button-hit-target` node renders and the root `hitSlop` is 6 for md (add if absent).
3. **Docs.** `packages/ui/README.md` 861: "Every platform gives Button a 44-pt vertical target: native through computed `hitSlop`, web through a transparent hit extender inside the drawn 28/32/40-pt box, so the visual size, layout and popover anchoring do not change; a caller `hitSlop` replaces both." Spacing table row `touchTarget` (314): note web reaches it the same way for `Button`. Run `bun run docs:llms`.
4. **CHANGELOG** `packages/ui/CHANGELOG.md` under `## [Unreleased]` → `### Changed`: "`Button` has a 44-pt pointer target on web (transparent extender inside the drawn box; `sm`/`md`/`lg` stay 28/32/40 pt tall) and honours a caller `hitSlop` on web. Native is unchanged."

## Validation

- RED first: the new web test file fails on `dev` (no extender), then passes.
- `bunx jest --config jest.config.js packages/ui/src/components/__tests__/Button --watchman=false --maxWorkers=2` (both Button files green), then `bun run pkg ui test` and `bun run pkg ui typecheck` through the heavy slot.
- Web capture (web-only Metro on 8134, `--max-workers 2`, heavy slot held): on `/components` (Button section) measure `getBoundingClientRect()` of a md button's `[role=button]` root, its drawn box and the extender: root and drawn box unchanged vs the before capture (32 px tall), extender 44 px tall and horizontally equal to the box; a click at 4 px above the drawn box fires the handler (console/`data-` probe or the showcase toast). Screenshots light/dark before/after under `/tmp/fleet/ui/expo-ui/button-web-target/` show no visual change. A popover triggered from a Button opens at the same offset as before (screenshot).
- CI (`bun run verify`) green on the PR.

## Out of scope

- Horizontal slop for icon-only buttons narrower than 44 px (needs layout measurement).
- Other controls (`Toggle`, `SegmentedControl`, `Tabs` triggers) — separate audit.
- Any change to native `hitSlop` or to the drawn heights.

## Open questions

None.
