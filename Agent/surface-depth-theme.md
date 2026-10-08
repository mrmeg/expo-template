---
status: ready
mode: HITL
base-branch: dev
blocked-by: -
pr: -
---

# Surface depth: a perceptual surface ramp, dark-mode edge light, and a Surface Lab

## Goal

Dark mode reads flat: cards, popovers, and sheets don't feel raised, and there is
no sense of light or material. Rebuild the `@mrmeg/expo-ui` surface system so
depth is legible in both schemes, and ship a Surface Lab screen that makes the
system tunable and teachable for forks.

Two stages in one PR, with a human pick between them:

1. Build the Surface Lab with candidate palettes, shadow treatments, and an
   explainer. **Stop and ask Matt to pick** a dark candidate and a light candidate
   (dayshift question; if running unattended, push the lab, set the PR draft, and
   leave the pick as the PR's open question).
2. Apply the picked values to the package defaults and fix the components that
   work around the current tiers.

## Context

Verified on `dev` (ui 0.28.0):

- Tokens: `packages/ui/src/constants/colors.ts`. Neutrals are Tailwind zinc hex
  values; no perceptual model. Documented in `docs/brand.md` (Palette table,
  "elevation is layered surfaces, not shadows").
- Dark tiers: `surfaceSunken #050506` < `background #09090B` < `card #18181B` =
  **`popover #18181B`** < `muted #27272A`; `border` = `muted` = `#27272A`.
  Causes of the flat look:
  - The base is near-black, so there is no darker value left for shadows to
    render against. `getShadowStyle` (`packages/ui/src/hooks/useTheme.ts:184`)
    triples alpha in dark (`boost = 3`) but black at ~0.1 alpha on `#09090B` is
    invisible.
  - `popover` equals `card`, so a menu, select, dialog, or sheet over a card has
    only a hairline to separate it. `Notification.tsx:375-376` already works
    around this by hardcoding `palette.dark600`/`palette.dark700` in dark.
  - Raised surfaces have no top-edge highlight, the cue that most strong dark
    UIs (macOS, Linear, Vercel, Radix) use for "lit from above".
  - Steps are uneven in perceived lightness (hex picked by eye), and chroma is
    zero, so surfaces read as gray plastic.
- Light tiers: `background` and `card` are both `#FFFFFF`; cards separate only
  by `border` plus `getShadowStyle("subtle")` (alpha 0.04/0.03 of
  `overlay rgba(0,0,0,0.5)`). Test comment in `colors.test.ts` notes only the
  chrome step is ordered in light.
- Surface consumers: `Card.tsx` (`card` + `border` + `subtle` shadow), `Dialog`,
  `Popover`, `DropdownMenu`, `Select`, `Tooltip` (`popover` + `border` + `soft`),
  `Drawer` (`soft`/`elevated`), `BottomSheet` (`card`), `Notification`
  (`elevated` + the hardcoded dark hack). App-wide: `colors.border` ×89,
  `background` ×74, `muted` ×47, `card` ×24, `popover` ×11.
- Web themes through CSS variables generated from `rawThemeColors`
  (`getThemeCssVariables`), so new values flow to web automatically; any new
  token must be added to `ThemeColors`, both base themes, and gets a var for free.
- `boxShadow` is the only shadow path (RN 0.88 + RNW); RN's `boxShadow` supports
  `inset` layers on iOS, Android, and web.
- `packages/ui/src/constants/__tests__/colors.test.ts` pins contrast floors
  (text ≥ 12:1 and dim text ≥ 7:1 on `background`/`card`/`popover`, dim ≥ 6:1
  on `muted`/`secondary`), tier ordering, and specific palette mappings.
- Launch surfaces hardcode backgrounds: `app.config.ts:49` splash `#FFFFFF`,
  `:54` splash dark `#09090B`, `:124` Android adaptive icon `#09090B`;
  `assets/brand/*.svg` and `__tests__/brandAssets.test.ts` use `#09090B` as the
  mark's tile color.
- Existing pattern for live palette swaps: `client/showcase/ThemedShowcaseScreen.tsx`
  calls `useThemeStore().setColors({ light, dark })` and clears on unmount; it is
  registered in `client/showcase/registry.ts:79` and routed through the lazy
  shell `app/(main)/(demos)/themed-showcase.tsx`.

## Principles the work applies

Put these in the Lab explainer and `docs/brand.md`, briefly:

1. **Dark mode: higher = lighter.** Each elevation step adds a little light
   (Material's overlay model). Shadows only help once the base is lifted off
   near-black (~`#111` rather than `#09090B`).
2. **Even steps in a perceptual space.** Define the ramp in OKLCH lightness with
   roughly equal ΔL (~0.03–0.04 in dark), then emit hex. Hex-by-eye ramps bunch up.
3. **A trace of hue.** Chroma 0.004–0.012 toward a cool hue makes surfaces feel
   like material instead of gray; keep it low enough that the accent still owns color.
4. **Edge light on raised surfaces in dark.** A 1px inset top highlight
   (white ~4–6%) plus a deeper, larger black shadow. In light, the shadow does the
   work and the highlight is unnecessary.
5. **Light mode: canvas and paper.** Off-white `background` with white `card`
   gives cards lift without heavier shadows; or keep white-on-white and lean on
   border + shadow. Both are candidates.
6. **Contrast floors don't move.** Lifting the dark base lowers text contrast
   slightly; the existing tests must keep passing.

## Work

### Stage 1 — Surface Lab (stop for the pick at the end)

1. Add `client/showcase/SurfaceLabScreen.tsx` and wire it exactly like
   `ThemedShowcaseScreen`: export in `client/showcase/gallery.tsx:39`, add to the
   screen union and map in `client/showcase/lazyGallery.tsx:84,100`, a one-line
   shell `app/(main)/(demos)/surface-lab.tsx` (copy `themed-showcase.tsx`), both
   lists in `client/showcase/__tests__/gallerySplitPoint.test.ts:42,52`, and a
   `client/showcase/registry.ts` entry after line 79 (icon `layers`). Update
   AGENTS.md's "Five gallery routes" note to six, and run `bun run gen` and
   `bun run docs:llms` (demo routes feed `llms-examples.txt`).
2. Candidates, applied live via `setColors` (cleared on unmount, as in
   ThemedShowcase). Matt wants dark mode to stay very dark for contrast, so
   Dark D "deep" (near-black base, wider tier spacing; OKLCH L .11/.145/.195/.235/.265)
   is the lead candidate and the Lab's default; on it the edge highlight, not the
   shadow, carries depth. Values were generated from OKLCH (dark hue 286 C 0.004
   and hue 264 C 0.012; light hue 286 C 0.003) — use them as given:

   | Token | Dark: current | Dark D "deep" | Dark A "lifted neutral" | Dark B "slate" | Light: current | Light C "canvas" |
   |---|---|---|---|---|---|---|
   | surfaceSunken | #050506 | #040405 | #0B0B0D | #090B10 | #FAFAFA | #F0F0F2 |
   | background | #09090B | #0A0A0C | #111113 | #0F1217 | #FFFFFF | #F9F9FB |
   | card | #18181B | #151517 | #19191B | #17191F | #FFFFFF | #FFFFFF |
   | popover | #18181B | #1E1E20 | #212123 | #1F2228 | #FFFFFF | #FFFFFF |
   | muted / secondary | #27272A | #252527 | #27272A | #25282E | #F4F4F5 | #F0F0F2 |
   | border / input | #27272A | #27272A | #2B2B2D | #282B31 | #E4E4E7 | #E4E4E6 |
   | borderStrong | #3F3F46 | #363639 | #3A3A3D | #373B41 | #D4D4D8 | #D4D4D6 |

   Text tokens stay as they are; if a candidate fails a contrast floor from
   `colors.test.ts`, adjust that candidate's text token, don't drop the floor.
3. Shadow treatments, selectable independently of the palette (a local
   `SegmentedControl`): `current` (today's `getShadowStyle`), and `edge-lit` —
   dark: `inset 0 1px 0 rgba(255,255,255,0.05)` plus `0 1px 2px rgba(0,0,0,0.4),
   0 8px 24px rgba(0,0,0,0.35)` for raised surfaces (`subtle` on cards, `soft` on
   overlays scaled up one step); light: today's presets with alpha roughly
   doubled. Prototype these as a local helper in the Lab; do not change
   `useTheme` yet.
4. Specimen, flat per the screen rules (one 16pt inset, sections broken by
   `SectionHeader`/spacing): the tier ladder as labelled swatches with hex and
   OKLCH L; a collection of `Card`s on `background`; a card with a `muted` chip
   and a `TextInput`; a popover-tier panel rendered statically over a card (render
   the surface with the overlay styles, not an open Popover, so it stays in
   view); a `Notification`-style toast; an `ItemGroup` settings block. Show a
   short explainer of the principles above at the top.
5. Gate: run Stage 1 validation, screenshot the Lab in dark and light on web
   and the iOS simulator for each candidate, put the screenshots in front of Matt
   (SendUserFile), and ask: which dark candidate, which light candidate, which
   shadow treatment, and whether to keep the Lab in the template (recommended:
   keep, with the candidates as fork presets).

### Stage 2 — Apply the pick

1. `colors.ts`: replace the dark (and, if picked, light) neutral palette
   entries with the picked values, keeping zinc entries that other tokens still
   use. Add a comment stating the OKLCH hue/chroma/L steps the ramp came from.
   Keep token names; `popover` becomes a distinct tier above `card` in dark.
   Update `navigation` maps to match.
2. `useTheme.ts` `getShadowStyle`: if `edge-lit` is picked, make dark presets use
   black at real alpha (drop the `boost` multiplier for dark in favour of
   per-scheme layers) and prepend the inset highlight to raised presets (`subtle`,
   `card*`, `soft`, `elevated`, `glass`); leave `glow` and `sharp` alone. Update
   `useTheme.test.tsx` expectations.
3. `Notification.tsx:375-376`: replace the `palette.dark*` hack with
   `popover`/`borderStrong` tokens.
4. Check each surface consumer listed in Context renders the intended tier
   (overlays on `popover`, `BottomSheet` → decide `card` vs `popover`; sheets are
   overlays, so prefer `popover`).
5. Tests: `colors.test.ts` — update the palette-mapping assertions, add
   `card < popover` in dark, and if light canvas is picked add
   `background < card` in light. Contrast floors unchanged.
6. Launch/brand: set `app.config.ts` splash `backgroundColor`/`dark.backgroundColor`
   to the new `background` values (the comment says they track it). Leave the
   icon tile `#09090B` and `assets/brand/` alone unless Matt says otherwise.
7. Docs: `docs/brand.md` Palette table and the Shape/elevation section;
   `packages/ui/LLM_USAGE.md` and `packages/ui/README.md` theming text if they
   quote values or the elevation rule; `packages/ui/CHANGELOG.md` `[Unreleased]`
   → `### Changed` entry naming the new values and that forks overriding
   `background`/`card` should re-check against the Lab. No `package.json` version
   bump (no dependency/exports change). Run `bun run docs:llms`.

## Validation

- `bun run pkg ui test` and `bun run pkg ui typecheck`.
- `bun run gen --check` and `bun run docs:llms:check` (after `bun run gen` /
  `bun run docs:llms`).
- `bun lint:ui --changed` — the Lab uses tokens/components, no raw colors
  outside the candidate table (the candidate hexes go through `setColors`; if the
  lint flags the table, keep it in a data module with a `-- reason` disable).
- `bun run verify` before marking the PR ready.
- Web: `bun run build && bun run start`, open `/surface-lab` and
  `/showcase` in both schemes; confirm no hydration warnings and that the first
  paint uses the new CSS variables (no flash from old values).
- iOS simulator (and Android emulator if available): Lab in both schemes; a
  card with an open `DropdownMenu`, a `Dialog`, a `BottomSheet`, and a toast —
  each overlay must be visibly separated from the card beneath it without
  relying on the border alone.

## Exclusions

- No grain/noise textures or blur materials (cost on Android, SSR, and the
  bundle); revisit after the ramp lands.
- No accent, status, or typography changes.
- No new semantic tokens unless the Lab shows a tier is missing; if one is
  needed, raise it at the Stage 1 gate instead of adding it silently.
- No consumer-app migrations; those follow the 0.29.0 publish.
