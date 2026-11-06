# Brand System

The template's own identity, and the system every fork inherits until it
replaces it. The package (`@mrmeg/expo-ui`) ships the tokens; this document
says what they mean together and which files a fork swaps.

## Positioning

A quiet, high-contrast foundation that gets out of the way of each app's
brand. The kit should feel finished and calm on day one and disappear behind
an app's own palette on day two — every decision below is a neutral default
with one accent, not a look a fork has to fight.

## Palette

Semantic tokens only; components never read raw palette entries. Source:
`packages/ui/src/constants/colors.ts`. Neutrals are Tailwind's neutral grey
scale (the Refined look), the accent is teal, and status colors are Tailwind's
defaults.

| Token | Light | Dark | Role |
|---|---|---|---|
| `surfaceSunken` | `#FAFAFA` | `#0A0A0A` | App chrome (tab bar, rail) |
| `background` | `#FFFFFF` | `#0A0A0A` | Content; light is also the launch background (dark launch stays `#09090B` in `app.config.ts`) |
| `card` / `popover` | `#FFFFFF` | `#171717` | Raised surfaces: collection tiles, popovers, sheets |
| `muted` | `#F5F5F5` | `#262626` | Chips, insets, skeletons |
| `text` / `foreground` | `#0A0A0A` | `#FAFAFA` | Body text |
| `textDim` / `mutedForeground` | `#525252` | `#A4A4A4` | Secondary text |
| `primary` / `primaryForeground` | `#171717` / `#FAFAFA` | `#E5E5E5` / `#171717` | Filled controls |
| `accent` / `accentForeground` | `#14B8A6` / `#FFFFFF` | `#2DD4BF` / `#171717` | The one brand color: the selection dot and fills |
| `link` | `#0F766E` | `#5EEAD4` | Link text (Button `link`, "See all"); the accent is too light to read as text on white |
| `destructive` | `#DC2626` | `#F87171` | Danger |
| `success` / `warning` | `#15803D` / `#F59E0B` | `#4ADE80` / `#FBBF24` | Status |
| `border` / `borderStrong` | `#E5E5E5` / `#D4D4D4` | `#262626` / `#404040` | Hairlines; strong sits on filled surfaces |
| `ring` | `#A1A1A1` | `#737373` | Web focus ring |

Contrast is tested, not hoped for: `packages/ui/src/constants/__tests__/colors.test.ts`
holds `text` at ≥ 12:1 and `textDim`/`mutedForeground` at ≥ 7:1 on
`background`, `card`, and `popover` (≥ 6:1 on `muted`/`secondary`), and `link`
at ≥ 4.5:1 on `background`, `card`, and `popover`, in both schemes (WCAG AA asks
4.5:1 for body text and 3:1 for large text and UI parts). Dark `#A4A4A4` is the
darkest grey that keeps the 6:1 floor on `muted`. A fork that re-brands through
`setColors` should keep those floors; the
same test file is the place to pin them. A fork that overrides `background`,
`card`, or `popover` should re-check its values against the Surface Lab
(`/surface-lab`), which shows the tier ladder and the specimens it has to read
on.

Rules: elevation is layered surfaces (`surfaceSunken` < `background` < `card` <
`muted`) plus a hairline `border` (see
[Shape, elevation, rhythm](#shape-elevation-rhythm)); the accent appears once
per view as the thing to look at, never as a large fill; status colors mean
status.

## Type

Two families at most.

- **Sans (everything):** Geist, weights 400/500/600/700, loaded by
  `useResources()` (four static files on native, one Google Fonts family on
  web). Inter is the opt-in classic preset (`useResources({ sans: "inter",
  sansFonts })`, part of `classicLook`). Roles (`StyledText` `semantic`): body
  15/24.75, label 14/21 medium, caption 12/18, subheading 18/27 medium, heading
  22/26.4 semibold, title 28/33.6 semibold; eyebrow 13 medium, sentence case,
  untracked, `mutedForeground`. Sizes beyond the roles come from the `size`
  scale (`xs` 11 … `display` 34).
- **Serif (display accents):** the `serif` variant. Georgia by default; the
  package's opt-in Newsreader preset (see the package README, Typography) is
  the recommended pairing for display text and section titles.
- **Mono (data):** platform monospace via the `mono` variant, for codes, IDs
  and tabular figures.

Forks replace faces with `setFonts` — never by patching `node_modules`.

## Shape, elevation, rhythm

- **Radii** (`spacing.radius*`): 4 chips/checkboxes, 8 controls (Button
  default, inputs: TextInput, the Select trigger, InputOTP cells) and menu
  items and thumbnails, 14 collection tiles and dialogs, 24 hero media, full
  for pills and avatars. Sheets keep the platform's corner radius unless an app
  sets one. Forks retune Button (and other slots as the package adds them)
  through `setShape`.
- **Controls:** the drawn SegmentedControl (web, and `size="lg"`) marks the
  selection with a raised `background` segment on the `muted` track, not a teal
  fill; Switch's on-track is `primary`; the web focus ring is a soft 3px `ring`
  halo.
- **Elevation:** surface tiers first, then a hairline. The `subtle` shadow
  (`getShadowStyle("subtle")`, on the `default` Button and on collection tiles
  (`Card`)) is a 1px light shadow in light and nothing in dark, where the 1px
  `border` carries the edge. `elevation: "layered"` (a treatment, and part of
  `classicLook`) restores the dual-layer `subtle` shadow with the dark top
  highlight.
  Overlays (`Popover`, `Dialog`, `DropdownMenu`, `Select`, `Tooltip`) use
  `soft`, `Notification` uses `elevated`; screen content is flat. The Surface
  Lab (`/surface-lab`) shows the tier ladder and alternate surface ramps for
  forks.
- **Rhythm:** 8-pt base (`spacing.sm` 8, `md` 16, `lg` 24, `xl` 32) with 4 and
  12 as half steps; screen gutter 16; section spacing 24; rows 10 × 16 padding;
  44-pt touch targets.
- **Layout:** flat screens. One 16-pt gutter per screen; sections break on a
  header, spacing, or a hairline, never on a bordered or shadowed panel; lists
  are full-width rows with inset hairlines (`ItemGroup`); media fills the
  column; wide screens cap and centre it. A card is one item in a collection
  or one tappable object, never a layout box.

## The mark

A component frame with the wordmark's dot on its corner: a rounded-square
stroke (a component's frame) interrupted at the bottom-right by a filled accent
dot — the same dot that precedes `@mrmeg/expo-ui` in the web
rail. It reads at 29 px (one ring, one dot) and needs no text.

Masters live in `assets/brand/`; `bun run brand:assets` renders every raster
`app.config.ts` uses with `rsvg-convert` (`brew install librsvg`), byte-stable:

| Master | Raster | Slot |
|---|---|---|
| `mark.svg` | `assets/images/icon.png` 1024² | `icon`, `ios.icon.light` (dark tile, white frame, teal dot) |
| `mark-dark.svg` | `icon-dark.png` | `ios.icon.dark` (transparent tile) |
| `mark-tinted.svg` | `icon-tinted.png` | `ios.icon.tinted` (grayscale for the system tint) |
| `adaptive-foreground.svg` | `adaptive-icon.png` | Android adaptive foreground, mark at 66 % for the safe zone; background `#09090B` |
| `adaptive-monochrome.svg` | `adaptive-icon-monochrome.png` | Android themed icon |
| `splash-light.svg` / `splash-dark.svg` | `splash-icon.png` / `splash-icon-dark.png` | Splash on `#FFFFFF` / `#09090B` (launch colors set in `app.config.ts`, pinned by `brandAssets.test.ts`; dark is one step off the dark `background`) |
| `favicon.svg` | `favicon.png` 48² | Web favicon (heavier stroke so it survives 16 px) |

The showcase's sample avatar and the auth screen's logo `require` `icon.png`,
so they follow the mark automatically. `__tests__/brandAssets.test.ts` pins the
sizes and the config wiring.

## Looks

A look bundles colors, fonts, shape, and treatments (`segmentedSelection`,
`switchTrack`, `eyebrow`, `focusRing`, `elevation`) as one named value. The
default is Refined (`refinedLook`, everything on this page). `classicLook` is
the pre-0.35 look: Inter, zinc neutrals, teal selection, radius 10 controls,
uppercase eyebrow, offset focus ring, layered shadows. `applyLook(look)`
applies one through `setColors`, `setFonts`, `setShape`, and `setTreatments`;
`useTreatment(name)` reads a treatment. Looks is a Library section next to
Components, Blocks and Templates: `/looks` lists the style references (Refined,
Classic, Strand, Glass, Editorial) and `/looks/<id>` applies one across the app
while the page is open, with its colors, type, shape, treatments and a copyable
snippet. The sources are `client/showcase/LooksScreen.tsx` and
`client/showcase/LookDetailScreen.tsx`. Package details are in
[`packages/ui/README.md`](../packages/ui/README.md#looks-and-treatments).

## What a fork replaces

1. Identity: `EXPO_PUBLIC_APP_NAME`, `_SLUG`, `_SCHEME`, bundle id and package
   in `.env` (see `.env.example`).
2. Mark: edit or replace the SVGs in `assets/brand/`, keep the file names, run
   `bun run brand:assets`, commit both. Keep the dark/tinted/monochrome
   variants — iOS and Android render them without asking.
3. Palette: `setColors({ light, dark })` once at startup with the brand's
   `primary`/`accent`/`link` (and any other tokens); re-run the contrast test.
   To start from another look, `applyLook(look)` instead (or after, to layer
   brand colors on a look), and pass the same colors to
   `getThemeCssVariables` in `app/+html.tsx`.
4. Type: `setFonts` with the brand faces, loaded through `expo-font`, or a
   look's `sans`/`serif` preset.
5. Treatments: `setTreatments` (or a look's `treatments`) for the selection,
   switch, eyebrow, focus ring, and elevation styling.
6. Wordmark: `client/features/navigation/WebNavShell.tsx` (`Wordmark`).
