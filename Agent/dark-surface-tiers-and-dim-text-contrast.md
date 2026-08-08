---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Dark theme: T3-style surface tiers + higher-contrast dim text

## Goal
Adopt the surface lessons from the T3 Code dark theme — layered background tiers (chrome darker than content, raised panels lighter, hairline borders one step above their fill) instead of shadow-driven elevation — while keeping dim/secondary text **more readable than T3's** (T3's meta text sits around ~4–4.5:1; ours must stay well above that, enforced by a test).

## Context
Verified 2026-08-08:

- Theme source: `packages/ui/src/constants/colors.ts`. Dark theme today has only two effective surface tiers: `background` `#09090B` (zinc-950) and `card`/`popover` `#18181B` (zinc-900). `muted`/`secondary`/`border`/`input` are all `#27272A` (zinc-800) — so a border drawn on a `muted`-filled chip is invisible (same hex).
- Dim text: `textDim` and `mutedForeground` are `#A1A1AA` (zinc-400) in dark — measured WCAG ratios: ~7.8:1 on `background`, ~7.0:1 on `card`, ~5.9:1 on `muted`. Light theme uses `gray500` `#71717A` on white: ~4.8:1, barely above AA and *below* the readability bar we want.
- T3 Code reference (screenshot reviewed with the user): app chrome (sidebar, side panels) is the darkest layer; content pane sits above it; raised elements (composer, selected sidebar item, file bar) are a lighter fill **plus a hairline border one step lighter than the fill**; chips/pills get the same treatment; accent color is used sparingly (selection reads as raised-surface-plus-border, not accent fill). Its weakness — the part we do NOT copy — is very dim meta text.
- `packages/ui/src/components/Drawer.tsx:641` and `:804` paint the rail/overlay panel with `theme.colors.background`, so chrome and content are currently the same tier. Both are inline render-time style objects (`drawerStyle`/`panelStyle`), not `createThemedStyles` — the token swap has no SSR-registration implication. Both already draw a `theme.colors.border` hairline.
- `StatCard.test.tsx:68` asserts the neutral-change color is literally `#71717A` (light `textDim`) — the light bump breaks it; update the expectation.
- WCAG contrast math already exists as private helpers in `packages/ui/src/hooks/useTheme.ts` (`calculateLuminance`, `calculateContrastRatio`); a test can reimplement the ~15 lines rather than exporting hooks internals.
- `packages/ui` is published to npm (version `0.18.0`, `CHANGELOG.md` present); color/token changes need a minor bump + changelog entry.
- Related pending work: `web-drawer-navigation-shell.md` (blocked) will render the Drawer rail as the web app chrome — this spec's tokens land underneath it. PRs #41–46 (in review) each bump `packages/ui` to 0.19.0; expect version/CHANGELOG merge conflicts.
- SSR constraint: any component style edits must keep module-scope `createThemedStyles` registration (`docs/ssr-hydration.md`).

## Work
All in `packages/ui` unless noted.

1. **New semantic tokens** in `src/constants/colors.ts` (`ThemeColors` interface + both themes):
   - `surfaceSunken` — app-chrome tier below `background`. Dark: add palette entry `#050506` (below zinc-950). Light: `gray50` `#FAFAFA`.
   - `borderStrong` — hairline border for elements sitting on filled surfaces (chips on `muted`, raised panels), one visible step above the fill. Dark: `dark600` `#3F3F46`. Light: `gray300` `#D4D4D8`.
   - `background`, `card`, `muted` values stay as-is; elevation order becomes `surfaceSunken < background < card/popover < muted (chips/insets)`.
2. **Dim text bump** in `src/constants/colors.ts`:
   - Dark `textDim` + `mutedForeground`: `#A1A1AA` → `#B0B0B8` (a zinc-350 midpoint; ~9.2:1 on `background`, ~6.9:1 on `muted`). Must stay visibly dimmer than `text` (`#F4F4F5`) so hierarchy survives.
   - Light `textDim` + `mutedForeground`: `gray500` → `gray600` `#52525B` (~7.7:1 on white).
3. **Apply the chrome tier**: `src/components/Drawer.tsx:641` and `:804` `background` → `surfaceSunken` so the rail/overlay reads as chrome beneath content (matches the T3 sidebar/content split; the web shell spec inherits this for free).
   Update `StatCard.test.tsx:68`'s hardcoded `#71717A` expectation to the new light `textDim` value.
4. **Contrast floor test** (new, e.g. `src/constants/__tests__/colors.test.ts`) using local WCAG luminance math, asserting for **both schemes**:
   - `textDim`/`mutedForeground` ≥ 7:1 against `background`, `card`, and `popover`; ≥ 6:1 against `muted` and `secondary`. (Floors sit well above T3's ~4.5:1 meta text — this test is the durable form of the user's requirement.)
   - `text`/`foreground` ≥ 12:1 against `background` and `card`.
   - `borderStrong` differs from `muted` and `secondary` (guards against the current invisible-border regression).
   - Tier ordering by luminance: dark `surfaceSunken` < `background` < `card` (strict); light `surfaceSunken` < `background` only — light `card` and `background` are both white, so no strict three-way ordering there.
5. **Release chores**: minor version bump + `CHANGELOG.md` entry describing the new tokens and the dim-text change (call it out as a visual change for consumers).

## Validation
- `bun run typecheck && bun run lint && bun run test:ci && bun run ui:test`
- Browser check (web showcase, dark mode): drawer/overlay chrome is visibly darker than the content pane; cards read as raised via background step + border, not shadow; timestamps/captions/`textDim` copy is comfortably readable at small sizes; light mode has no regressions.
- The new contrast test fails if someone later dims `textDim` back down.

## Out of scope
- Restyling selection/hover states across the component library to the raised-fill-plus-border pattern (T3 lesson worth a follow-up; only Drawer chrome changes here).
- Light-theme surface redesign beyond the two token mappings above.
- The web drawer navigation shell itself (`web-drawer-navigation-shell.md`).
- Copying T3's dim meta-text contrast — explicitly rejected.

## Merge plan
Land after the current in-review wave (PRs #41–46) merges: three of those PRs already bump `packages/ui` to 0.19.0, so this spec's version/CHANGELOG bump will conflict; rebase and take the next free minor.

## Open questions
- None blocking. `#B0B0B8` is a suggested value — implementer may tune within the test's floors (≥7:1 on `background`/`card`, ≥6:1 on `muted`) while keeping it visibly dimmer than `text`.
