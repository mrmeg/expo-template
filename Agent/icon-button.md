---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# IconButton: an icon-only button that requires a label

## Goal

From expo-ui 0.28, an `Icon` with no `accessibilityLabel` is hidden from assistive tech (`Icon.tsx:109-127`). That
is right for decorative icons. But an icon-only `Button` or `Pressable` now has no accessible name at all unless the
author remembers `accessibilityLabel`, and nothing in the kit makes them remember.

- The fleet audit (`/tmp/fleet-audit/reference.md:282`) found the template's own `media.tsx` refresh and upload
  buttons unnamed.
- Terlo built a local `IconCircleButton` plus a guard test to close 40 such controls (mrmeg/terlo PR #312).
- keepwatch's camera rework needs 44 pt icon buttons.

Ship `IconButton` in `@mrmeg/expo-ui/components`. Its `accessibilityLabel` is required by type and dev-warned at
runtime, its hit area is at least 44 pt on every platform, and it reuses `Button`'s presets and states. Then dogfood
it in `media.tsx`.

## Context

Verified on `dev` at 156c9a1.

- `packages/ui/src/components/Button.tsx`:
  - Presets are `default | outline | ghost | link | destructive | secondary` (line 37), and `ButtonSize` is
    `sm | md | lg` with visible heights 28/32/40 (`SIZE_CONFIGS`, lines 44-62).
  - Native `hitSlop` defaults to `verticalSlopFor(height)` (vertical only, via `getNativeHitSlop`). Web uses
    `getWebHitInsets(rest.hitSlop, height)` from `lib/webHitTarget.tsx`; a numeric `hitSlop` applies to all four
    sides on both platforms.
  - `...rest` (including `accessibilityLabel`) spreads onto the `Pressable` with role `button`.
  - `Button.Icon` (`ButtonIcon`, line 522) renders a decorative `Icon` in the preset's text color, taken from
    `TextColorContext`.
- `Toggle.tsx:196-210` is the kit's precedent for an icon-only control: `iconOnly`, plus a once-only dev
  `console.warn` when `accessibilityLabel` is missing.
- `verticalSlopFor(h) = ceil(max(0, 44 - h) / 2)` (`lib/webHitTarget.tsx:19`), so `sm`→8, `md`→6, `lg`→2.
- Package exports: `./components/*` is a wildcard and `./components` is the barrel
  (`packages/ui/src/components/index.ts`). A new file needs **no `exports` change**, so no version bump is required.
- Template call sites: `app/(main)/(tabs)/media.tsx:734-747` has two icon-only `Button`s (refresh: ghost `sm`,
  `refresh-cw`; upload: `upload`) with no `accessibilityLabel`.
- Showcase: components are registered in `client/showcase/registry.ts` (for example line 133, `ThemeSelector`) and
  previewed in `client/showcase/previews.tsx`. Previews load only through the lazy gallery (see `AGENTS.md`).
- Collisions: #156 changes `packages/ui/src/components/iconTypes.ts`, `packages/ui/CHANGELOG.md` and the icon
  generators, and #157 changes `CHANGELOG.md`. This spec touches neither `iconTypes.ts` nor the generators. Use only
  icon names already in `client/icons.json` (`refresh-cw`, `upload`, plus whatever the preview uses). Resolve the
  CHANGELOG by rebasing.

## Work

1. **`packages/ui/src/components/IconButton.tsx`** (new):

   ```ts
   export interface IconButtonProps
     extends Omit<ButtonProps, "children" | "text" | "tx" | "txOptions" | "RightAccessory" | "LeftAccessory" | "fullWidth" | "accessibilityLabel"> {
     /** Registered icon name. */
     icon: IconName;
     /** Required: the button's only accessible name (no visible text). */
     accessibilityLabel: string;
     /** @default "ghost" */
     preset?: ButtonProps["preset"];
     /** Visible size: sm 28, md 32, lg 40 (Button heights). Hit area is ≥ 44 on every platform. @default "md" */
     size?: ButtonSize;
     /** @default "square" (Button radius); "circle" for a round button. */
     shape?: "square" | "circle";
   }
   ```

   Drop any omitted key that `ButtonProps` does not actually have, so the type compiles. Render
   `<Button {...rest} preset size accessibilityLabel hitSlop={rest.hitSlop ?? verticalSlopFor(height)} style={[square, style]}>`
   with `<Button.Icon name={icon} size={ICON_SIZES[size]} />` as the child.
   - `square` is `{ width: height, minWidth: height, paddingHorizontal: 0, paddingVertical: 0 }`, plus
     `borderRadius: height / 2` for `circle`. Register the styles at module scope (`StyleSheet.create` per size and
     shape) so web SSR serializes them (`docs/server-guide.md`).
   - `ICON_SIZES = { sm: 16, md: 18, lg: 22 }`, and the heights come from `SIZE_CONFIGS`: export a
     `buttonHeights` record from `Button.tsx` instead of duplicating the numbers.
   - The numeric `hitSlop` gives 44 in both axes: native `Pressable.hitSlop`, and web through `getWebHitInsets`.
   - In `__DEV__`, when `accessibilityLabel` is empty or whitespace, `console.warn` once per component instance:
     "IconButton: `accessibilityLabel` is required; an icon-only button has no other accessible name." This
     matches `Toggle`.
2. **Export** it from `packages/ui/src/components/index.ts` (alphabetical, next to `Icon`).
3. **Showcase:**
   - Add `{ id: "IconButton", importPath: "@mrmeg/expo-ui/components/IconButton", category: "form" }` to
     `client/showcase/registry.ts`, next to `Button` (line 104).
   - Add a preview in `client/showcase/previews.tsx`: three sizes, `ghost` / `outline` / `default`, one `circle`,
     each with a label.
   - Add any new icon name with `bun run icons add <name>`, then `bun run gen`.
4. **Dogfood:** replace the two icon-only `Button`s at `app/(main)/(tabs)/media.tsx:734-747` with
   `IconButton`. Use `icon="refresh-cw"` with label "Refresh media" and `icon="upload"` with label "Upload media",
   keeping their presets (`ghost`, `default`), `size="sm"`, `onPress` and `disabled={uploadDisabled}`. The screen
   uses literal English strings (no `t()`), so use literals. The icons now take the preset's text color: the refresh
   glyph moves from `primary` to the ghost `text` color, which is intended.
5. **Docs:**
   - `packages/ui/LLM_USAGE.md`: add a component-table row (near line 426): "`IconButton` | Icon-only command;
     `accessibilityLabel` required; ≥44 pt hit area | `Button` with only an `Icon` child, or a raw `Pressable` +
     `Icon`".
   - `packages/ui/LLM_USAGE.md`: in the line 446 chooser, add "`IconButton` an icon-only command".
   - `packages/ui/README.md`: add `IconButton` to the components list.
6. **CHANGELOG** (`packages/ui/CHANGELOG.md` `## [Unreleased]` → `### Added`, no version bump): "**`IconButton`**
   (`@mrmeg/expo-ui/components`): an icon-only button with a required `accessibilityLabel` (dev-warned when
   empty), `Button`'s presets and states, `sm`/`md`/`lg` visible sizes, `square` or `circle` shape, and a hit area
   of at least 44 pt on iOS, Android and web. Use it for every icon-only control; an unlabelled `Icon` is
   decorative since 0.28."
7. `bun run gen` (registry and `llms-examples.txt` / `llms-full.txt`), and commit the generated output.

Exclusions:
- No lint rule for unnamed icon-only Pressables (a possible follow-up in `packages/lint`).
- No change to `Icon` or `Button` behavior beyond exporting the heights record.
- No version bump.

## Validation

The new tests fail on `dev` because the module does not exist.

- New `packages/ui/src/components/__tests__/IconButton.test.tsx` (iOS default, `@/test/mockTheme`):
  - `getByRole("button", { name: "Refresh media" })` exists.
  - The inner icon has `accessible={false}` / `importantForAccessibility="no-hide-descendants"`.
  - `hitSlop` is 6 for `md`, 8 for `sm` and 2 for `lg`, and a caller `hitSlop` wins.
  - The flattened style width equals its height for each size, and `circle` sets `borderRadius` to half of it.
  - `onPress` fires, and `disabled` blocks it and sets `accessibilityState.disabled`.
  - An empty label `console.warn`s once.
- New `__tests__/IconButton.android.test.tsx`: the name, the `hitSlop` and `onPress`.
- New `__tests__/IconButton.web.test.tsx` (`./forceWebPlatform`): `aria-label` on the button, the icon is
  `aria-hidden`, and the web hit extender's insets reach 44 in both axes for `md` (find the extender by testID
  `button-hit-target`, as `Button.web.test.tsx:41` does).
- Type check: add `// @ts-expect-error accessibilityLabel is required` on an `<IconButton icon="x" />` in the iOS
  test, so `bun run pkg ui typecheck` (or `bun run typecheck`) fails if the prop becomes optional.
- Existing `media` screen tests still pass. Update any that find those buttons by a missing name to use the new
  label.
- `bun run pkg ui test`, `bun run pkg ui typecheck`, `bun run lint`, `bun run gen --check` and `bun run verify` pass,
  as does `client/showcase/__tests__/gallerySplitPoint.test.ts` (the preview is imported only inside
  `client/showcase/`).
- Manual (record in the PR): the gallery `IconButton` page on the iOS simulator (VoiceOver reads the label and
  "button"), on the Android emulator (TalkBack the same), and on web against `bun run build && bun run start`. Also
  check the media tab's two buttons on web.
