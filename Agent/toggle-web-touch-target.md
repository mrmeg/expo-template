---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Toggle and ToggleGroup items: 44pt pointer target on web, sharing Button's hit extender

## Goal

The wave-6 web pointer-target audit (390 px, dev 4ba1949) measured `Toggle` at 32/36/40 px tall (`sm` icon-only 32×32) and `ToggleGroup` items at 32 px, with `hitSlop={DEFAULT_HIT_SLOP}` (8) that react-native-web ignores. Give both the same 44pt vertical web target `Button` got in #142, through one shared helper, without changing the drawn size, layout or anchoring. Additive; no API change.

## Context (verified on `dev` 4ba1949)

- `packages/ui/src/components/Button.tsx` 64–92: `OUTLINE_BORDER_WIDTH`, `getNativeHitSlop`, `HitInsets`, `getWebHitInsets(hitSlop, sizeConfig)` and the inline extender `<View testID="button-hit-target" aria-hidden … position: "absolute" top: 0 - (insets.top + hitBorder) …/>` rendered last inside the drawn box. Tests: `__tests__/Button.web.test.tsx` (11 cases), `Button.test.tsx` "Hit target (native)".
- `Toggle.tsx`: `TOGGLE_SIZES` heights 32 / 36 / 40 (`sm` / `default` / `lg`); `TogglePrimitive.Root` (Pressable-based) gets `style={{ ...styles.root (borderWidth: 1), height, minWidth, … }}` and `hitSlop={DEFAULT_HIT_SLOP}` (line ≈259, 8, native only); children are the spinner, a render function `(state) => …`, or nodes, each wrapped in `TextSelectabilityContext.Provider`. No `overflow: hidden`.
- `ToggleGroup.tsx`: item sizes 32 / 36 / 40 (lines 16–33; the doc comment at 71–73 says 32/40/48 and is stale); `ToggleGroupPrimitive.Item` with `styles.item` (`borderWidth: 1`), `hitSlop={DEFAULT_HIT_SLOP}` (≈296), the same children shapes. The group container has no `overflow: hidden`.
- Web tests force the platform with `./forceWebPlatform` first; `ToggleGroup.web.test.tsx` mocks `@rn-primitives/toggle-group` around the actual module, `../../lib/haptics` and `../../hooks/useScalePress`, and imports `@/test/mockTheme`.

## Work

1. **Shared helper** `packages/ui/src/lib/webHitTarget.tsx`: export `HitInsets`, `verticalSlopFor(height)` (= `ceil(max(0, spacing.touchTarget − height) / 2)`), `getWebHitInsets(hitSlop: PressableProps["hitSlop"], height: number): HitInsets | null` (moved from Button, same semantics: default vertical-only, caller `hitSlop` verbatim, `null` when nothing extends) and `WebHitTarget({ insets, border = 0, testID = "hit-target" })`, which returns `null` off web or with `insets === null`, else the transparent absolute `View` (`aria-hidden`, `importantForAccessibility="no-hide-descendants"`, `focusable={false}`, insets negated with `0 - (inset + border)` so `0` stays `+0`).
2. **Button** uses the helper (`getNativeHitSlop` → `verticalSlopFor(sizeConfig.height)`, `<WebHitTarget insets={webHitInsets} border={hitBorder} testID="button-hit-target" />`). Behaviour-preserving: every existing Button test stays green unchanged.
3. **Toggle**: `webHit = Platform.OS === "web" ? getWebHitInsets(undefined, sizeConfig.height) : null` (Toggle owns `hitSlop`, callers cannot pass one today; keep that); render `<WebHitTarget insets={webHit} border={1} />` as the last child inside `TogglePrimitive.Root` in all three children shapes (spinner, render function via a fragment inside the function, nodes). Native unchanged (`hitSlop={DEFAULT_HIT_SLOP}` stays).
4. **ToggleGroup.Item**: same as Toggle with `border={1}`; fix the stale size comment (32/36/40).
5. **Tests, RED first.** New `__tests__/Toggle.web.test.tsx`: `sm` extender `{ top: -7, bottom: -7, left: -1, right: -1 }` (6 + 1 border), `default` −5/−1, `lg` −3/−1; a press on the extender calls `onPressedChange`; disabled ignores it; extender `aria-hidden` and `focusable === false`; one `button` role; root keeps `height` 32. `ToggleGroup.web.test.tsx`: items render an extender with `top/bottom −7` and a press on it selects the item. `Toggle.test.tsx` (native): no `hit-target` node, `hitSlop` 8 on the root.
6. **Docs.** README `touchTarget` row and the Button gotcha: "`Button`, `Toggle` and `ToggleGroup` items reach it on web through the transparent hit extender"; Toggle/ToggleGroup sections mention the 44pt web target. `bun run docs:llms`. CHANGELOG `## [Unreleased]` → `### Changed`: extend the Button entry to "`Button`, `Toggle` and `ToggleGroup` items have a 44pt pointer target on web" (one entry, one Changed section).

## Validation

- `bunx jest --config jest.config.js packages/ui/src/components/__tests__/Toggle packages/ui/src/components/__tests__/ToggleGroup packages/ui/src/components/__tests__/Button --watchman=false --maxWorkers=2` RED then GREEN; `bun run pkg ui typecheck`; `bun run pkg ui test`.
- Web capture (web-only Metro 8134, heavy slot): `/tmp/fleet/ui/expo-ui/target-audit/audit.mjs Toggle ToggleGroup Button` shows no Toggle / ToggleGroup rows under 44 (before: 32×32 Bold/Italic/Underline, 45–64×32 Left/Center/Right); screenshots identical.
- CI green on the PR.

## Out of scope

- `SegmentedControl` (28px segments inside an `overflow: hidden` track: needs the track to route taps), `Tabs` triggers (36), `Select` trigger (32/36/40), `Switch` (24 tall), `Slider` thumb; all in the audit JSON for a follow-up.
- Horizontal extension for icon-only toggles narrower than 44 (adjacent toolbar toggles would share hit regions).

## Open questions

None.
