# Spec: Fix Dark-Mode Icon On Primary Background

**Status:** Merged
**Priority:** High
**Type:** Bug
**Area:** app

---

## What

Replace the two hard-coded white icon colors that sit on `theme.colors.primary` backgrounds and disappear in dark mode. Pair `theme.colors.primary` with `theme.colors.primaryForeground` consistently and add a small lint or test guard so the pattern does not regress.

## Why

In dark mode, `theme.colors.primary` resolves to `palette.gray50` (`#FAFAFA`, near-white). Two consumer-facing screens render an icon with a hard-coded white color on that background:

1. `app/(main)/(tabs)/media.tsx:741` — the play button overlay on every video thumbnail in the Media tab. Icon is `<Icon name="play" color="white" />` over a `theme.colors.primary` circle. In dark mode, white-on-near-white is invisible, breaking the primary affordance for playing media.
2. `app/(main)/(tabs)/profile.tsx:184` — the user avatar fallback icon. `<Icon name="user" color={palette.white} size={48} />` over a `theme.colors.primary` circle. Avatar disappears in dark mode.

Both pair the only inverting-paired tokens incorrectly. Investigation `Agent/Investigations/20260526-dark-mode-color-issues.md` confirms every other site that uses `theme.colors.primary` as a background already pairs it with `theme.colors.primaryForeground` (or a contrast-derived computation). These two are the outliers.

## Current State

`packages/ui/src/constants/colors.ts:124-126, 168-170`:

```ts
// light theme
primary: palette.gray900,            // #18181B
primaryForeground: palette.gray50,   // #FAFAFA

// dark theme
primary: palette.gray50,             // #FAFAFA
primaryForeground: palette.gray900,  // #18181B
```

`app/(main)/(tabs)/media.tsx:740-743, 975-984`:

```tsx
<View style={styles.playButton}>
  <Icon name="play" size={16} color="white" />
</View>
// ...
playButton: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: theme.colors.primary,
  ...
}
```

`app/(main)/(tabs)/profile.tsx:183-185, 484-490`:

```tsx
<View style={[styles.avatar, getShadowStyle("soft")]}>
  <Icon name="user" color={palette.white} size={48} />
</View>
// ...
avatar: {
  width: 96,
  height: 96,
  borderRadius: 48,
  backgroundColor: theme.colors.primary,
  ...
}
```

## Changes

> **Implementation order:** Change 2 first (decides whether `palette` import stays), then Change 1, then Change 4 (extract helpers), then Change 3 (test that depends on Change 4), then Change 5 (lint guard).

### 1. Switch the two icon colors to the inverting token

Edit `app/(main)/(tabs)/media.tsx`:

- Line 741: replace `color="white"` with `color={theme.colors.primaryForeground}`.
- `theme` is already in scope: `app/(main)/(tabs)/media.tsx` calls `const { theme, getShadowStyle } = useTheme();` at the top of the component.

Edit `app/(main)/(tabs)/profile.tsx`:

- Line 184: replace `color={palette.white}` with `color={theme.colors.primaryForeground}`.
- After Change 2 lands, drop the `palette` import if no other call site in the file still needs it.

### 2. Make the latent `providerLetter` default less footgun-prone

`app/(main)/(tabs)/profile.tsx:596-600` defines:

```ts
providerLetter: {
  fontSize: 16,
  color: palette.white,
  fontWeight: "bold",
},
```

The Google call site relies on this default (white "G" on hard-coded `#DB4437` red — fine). The Apple call site overrides with `theme.colors.background`. A future provider added by an agent could regress.

**Use Option A:** drop the default `color` on `providerLetter` and pass an explicit color at every call site:

- Line 373 (Google): `<SansSerifBoldText style={[styles.providerLetter, { color: palette.white }]}>G</SansSerifBoldText>` — keep white literal because the Google brand red is hard-coded.
- Line 386 (Apple): already passes `{ color: theme.colors.background }` — leave as is.

This makes the intent visible at every call site and prevents a future provider from accidentally inheriting white.

### 3. Regression test for inverting token pairs

Add `packages/ui/src/constants/__tests__/colors.test.ts`:

For each scheme (`light`, `dark`), assert WCAG contrast ratios using the helpers extracted in Change 4:

- **Text-on-surface pairs (require ≥ 4.5:1, WCAG AA body text):**
  - `foreground` ↔ `background`
  - `cardForeground` ↔ `card`
  - `popoverForeground` ↔ `popover`
  - `mutedForeground` ↔ `muted`
- **UI-component pairs (require ≥ 3:1, WCAG AA non-text contrast):**
  - `primary` ↔ `primaryForeground`
  - `secondary` ↔ `secondaryForeground`
  - `accent` ↔ `accentForeground`
  - `destructive` ↔ `destructiveForeground`

The two thresholds are deliberate — `accentForeground` (#FFFFFF) on `accent` (#14B8A6 teal500) in light mode is roughly 2.6:1, which fails 4.5 but passes 3 (acceptable for non-text UI per WCAG 2.1 SC 1.4.11). Don't change the palette to satisfy 4.5 across the board; that's out of scope per Constraint #4.

If any pair currently fails its threshold, the test should report the actual ratio and fail loudly. Either bump the threshold (with a comment justifying), file a follow-up palette spec, or fix the offending token in this spec — implementer's call, but record the decision in the PR body.

### 4. Extract pure contrast helpers (required for Change 3)

Move these module-private functions from `packages/ui/src/hooks/useTheme.ts:280-440`:

- `parseColor`
- `hexToRgb`
- `calculateLuminance`
- `calculateContrastRatio`
- `getBetterContrast`
- `getTextColorForBackground`
- `withAlpha`

Into a new file `packages/ui/src/lib/contrast.ts`. Re-export them from `packages/ui/src/lib/index.ts`. Update `useTheme.ts` to import from the new module.

This is mandatory because the helpers are not exported today — `getContrastRatio` exposed by `useTheme()` is a closure that wraps `parseColor` + `calculateLuminance` + `calculateContrastRatio`. A non-React test file (Change 3) cannot reach those without the extraction.

### 5. Lint guard against the bug pattern

Add a custom ESLint rule under `eslint.config.mjs` (or via `eslint-plugin-local`) that flags the AST pattern:

```
JSXElement
  having a JSXOpeningElement attribute  `style` whose evaluated value contains `backgroundColor: theme.colors.primary` or `backgroundColor: theme.colors.foreground`
  AND containing a child JSXElement (any depth)
    with attribute `color="white"` | `color="#fff"` | `color="#FFFFFF"` | `color={palette.white}` | `color={palette.black}`
```

Pattern must NOT match when the bg uses a transparency wrapper (`withAlpha(theme.colors.primary, x)`, `theme.colors.primary + "20"`, or any string concat).

If the eslint plugin work is disproportionate (e.g., > 1 day of effort), substitute a small Node AST script using `@typescript-eslint/parser` invoked via `bun run lint:theme` and added to the existing `lint` flow. **Do NOT use plain ripgrep** — the cross-line bg-to-color association requires AST awareness.

Whichever path is chosen, add it to the CI workflow that runs `bun run lint`.

## Acceptance Criteria

1. `app/(main)/(tabs)/media.tsx:741` and `app/(main)/(tabs)/profile.tsx:184` no longer use literal white. Both use `theme.colors.primaryForeground`.
2. The `providerLetter` default `color` is removed; both Google and Apple call sites pass an explicit color.
3. `bun run ui:test` (or `bun run test:ci` from the workspace root) includes a passing `colors.test.ts` that asserts ≥ 4.5:1 contrast for text-on-surface pairs and ≥ 3:1 for UI-component pairs in both schemes. The test imports the contrast helpers from `packages/ui/src/lib/contrast.ts`.
4. `bun run lint` (or `bun run lint:theme` if a separate script is used) fails when a new JSX element with `backgroundColor: theme.colors.primary` (or `theme.colors.foreground`, without a transparency wrapper) contains a descendant `color="white"` / `color={palette.white}` / `color="#fff"` / `color="#FFFFFF"` / `color={palette.black}`.
5. Manual web + iOS dark-mode verification:
   - Open Media tab. Every video thumbnail shows a visible play icon contrasting its primary-colored circle.
   - Open Profile tab. Avatar fallback icon is visible in both schemes.
6. Verification guide added at `Agent/Testing/{task-slug}.md` per `Agent/Playbooks/VERIFICATION_GUIDE.md` (`status: pending` in frontmatter), covering both screens.

## Constraints

- Do not refactor either screen's layout or copy. The change is only to the icon color and (in Profile) the `providerLetter` style.
- Do not touch `client/features/media/components/VideoPlayer.tsx` or `client/features/media/components/ImagePreview.tsx`. Their hard-coded `color="white"` is on `backgroundColor: "black"` (literal), not on `theme.colors.primary`, so the lint rule never targets them — no allow-list needed. They are intentional dark-modal styling.
- Do not introduce a new color token for the play button. `primaryForeground` is the correct one.
- The contrast test must use the actual color values from `colors.ts`, not a snapshot, so the test guards future palette tweaks.
- Do not change the WCAG threshold without recording why in the PR body. The 4.5 / 3 split is deliberate.

## Out of Scope

- Web theme first-paint race (separate spec `draft-fix-web-theme-first-paint-race.md`).
- Splash screen and adaptive icon dark mode (separate spec `draft-add-dark-splash-and-themed-app-icon.md`).
- Doc updates (separate spec `draft-document-theming-contracts-in-expo-ui-package-doc.md`).
- Other low-priority decoration-color findings (`screen-list` offline status dot, `DetailHeroScreen` back button) — those are P3 with `Needs decision` status.

## Files Likely Affected

Client:

- `app/(main)/(tabs)/media.tsx`
- `app/(main)/(tabs)/profile.tsx`

Package:

- `packages/ui/src/lib/contrast.ts` (new — required by Change 4)
- `packages/ui/src/lib/index.ts` (re-export)
- `packages/ui/src/hooks/useTheme.ts` (re-import contrast helpers from `./../lib/contrast`)
- `packages/ui/src/constants/__tests__/colors.test.ts` (new)

Tooling:

- `eslint.config.mjs` (new rule), or
- `scripts/check-primary-fg.mjs` (new AST script using `@typescript-eslint/parser`) + `package.json` (`scripts.lint:theme`)

Testing:

- `Agent/Testing/{task-slug}.md`

## Edge Cases

- The play button is also rendered in `app/(main)/(demos)/screen-list.tsx` indirectly? Confirm no other thumbnail-style overlay has the same hardcoded `white`. Investigation grep covered all `color="white"` callsites; only the two listed are bugs.
- Some translucent surfaces use `withAlpha(theme.colors.primary, 0.1)` and pair with `theme.colors.primary` text — those are intentional and stay. The lint rule should look at `backgroundColor: theme.colors.primary` *without* a withAlpha wrapper.
- `theme.colors.primary + "20"` and similar string-concatenated alpha hacks (e.g., `app/(main)/(tabs)/settings.tsx:227`, `app/(main)/(demos)/screen-list.tsx:120`) should also be ignored by the lint rule (they're translucent tints over the page bg, not solid surfaces). Pattern: only flag exact `backgroundColor: theme.colors.primary` / `backgroundColor: theme.colors.foreground` without a transparency modifier.

## Risks

- The eslint rule is the highest-effort piece. If the implementer cannot land it cleanly, an AST script via `@typescript-eslint/parser` is acceptable as long as it runs in CI and fails the build on regressions. Plain ripgrep is NOT acceptable — it cannot reliably associate a `backgroundColor` declaration with a JSX descendant's `color` prop.
- Extracting the contrast helpers (Change 4) touches `useTheme.ts` import paths. Verify `bun run ui:typecheck` and the existing `useTheme.test.tsx` still pass before relying on the new path.
- If the contrast test reveals a current pair below threshold, document in the PR body whether the threshold was relaxed (with reason) or a follow-up palette spec was filed. Do not silently lower the bar.
