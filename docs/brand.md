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
`packages/ui/src/constants/colors.ts`. Neutrals are Tailwind's zinc scale, the
accent is teal, and status colors are Tailwind's defaults.

| Token | Light | Dark | Role |
|---|---|---|---|
| `surfaceSunken` | `#FAFAFA` | `#050506` | App chrome (tab bar, rail) |
| `background` | `#FFFFFF` | `#09090B` | Content; also each scheme's launch background |
| `card` / `popover` | `#FFFFFF` | `#18181B` | Raised panels |
| `muted` | `#F4F4F5` | `#27272A` | Chips, insets, skeletons |
| `text` / `foreground` | `#09090B` | `#F4F4F5` | Body text |
| `textDim` / `mutedForeground` | `#52525B` | `#B0B0B8` | Secondary text |
| `primary` / `primaryForeground` | `#18181B` / `#FAFAFA` | `#FAFAFA` / `#18181B` | Filled controls |
| `accent` / `accentForeground` | `#14B8A6` / `#FFFFFF` | `#2DD4BF` / `#18181B` | The one brand color: links, selection, the dot |
| `destructive` | `#EF4444` | `#F87171` | Danger |
| `success` / `warning` | `#22C55E` / `#F59E0B` | `#4ADE80` / `#FBBF24` | Status |
| `border` / `borderStrong` | `#E4E4E7` / `#D4D4D8` | `#27272A` / `#3F3F46` | Hairlines; strong sits on filled surfaces |
| `ring` | `#A1A1AA` | `#A1A1AA` | Web focus ring |

Contrast is tested, not hoped for: `packages/ui/src/constants/__tests__/colors.test.ts`
holds `text` on `background`/`card` at ≥ 7:1 and `textDim`/`mutedForeground` at
≥ 6:1 in both schemes (WCAG AA asks 4.5:1 for body text and 3:1 for large text
and UI parts). A fork that re-brands through `setColors` should keep those
floors; the same test file is the place to pin them.

Rules: elevation is layered surfaces, not shadows (`surfaceSunken` <
`background` < `card` < `muted`); the accent appears once per view as the
thing to look at, never as a large fill; status colors mean status.

## Type

Two families at most.

- **Sans (everything):** Inter, weights 400/500/600/700, loaded by
  `useResources()` (four static files on native, one Google Fonts family on
  web). Body 16/24, captions 14/20 and 12/16, headings from the `StyledText`
  size scale (`xs`…`display`) and semantics (`title`, `heading`, `subheading`,
  `body`, `caption`, `label`, `eyebrow`). Eyebrows are 12 px, uppercase,
  tracked, `mutedForeground`.
- **Serif (display accents):** the `serif` variant. Georgia by default; the
  package's opt-in Newsreader preset (see the package README, Typography) is
  the recommended pairing for display text and section titles.
- **Mono (data):** platform monospace via the `mono` variant, for codes, IDs
  and tabular figures.

Forks replace faces with `setFonts` — never by patching `node_modules`.

## Shape, elevation, rhythm

- **Radii** (`spacing.radius*`): 4 chips/checkboxes, 8 menu items, 10 controls
  (Button default, inputs), 14 cards and dialogs, 16 sheets (moving to the
  scale's 18), 24 hero panels,
  full for pills and avatars. Forks retune Button (and other slots as the
  package adds them) through `setShape`.
- **Elevation:** `getShadowStyle("subtle")` on the `default` Button and cards;
  everything else flat. Dark mode relies on surface tiers, not shadow.
- **Rhythm:** 8-pt base (`spacing.sm` 8, `md` 16, `lg` 24, `xl` 32) with 4 and
  12 as half steps; screen gutter 16; section spacing 24; rows 10 × 16 padding;
  44-pt touch targets.

## The mark

A component frame with the wordmark's dot on its corner: a rounded-square
stroke (the "card" every screen is built from) interrupted at the bottom-right
by a filled accent dot — the same dot that precedes `@mrmeg/expo-ui` in the web
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
| `splash-light.svg` / `splash-dark.svg` | `splash-icon.png` / `splash-icon-dark.png` | Splash on `#FFFFFF` / `#09090B` — each scheme's `background` |
| `favicon.svg` | `favicon.png` 48² | Web favicon (heavier stroke so it survives 16 px) |

The showcase's sample avatar and the auth screen's logo `require` `icon.png`,
so they follow the mark automatically. `__tests__/brandAssets.test.ts` pins the
sizes and the config wiring.

## What a fork replaces

1. Identity: `EXPO_PUBLIC_APP_NAME`, `_SLUG`, `_SCHEME`, bundle id and package
   in `.env` (see `.env.example`).
2. Mark: edit or replace the SVGs in `assets/brand/`, keep the file names, run
   `bun run brand:assets`, commit both. Keep the dark/tinted/monochrome
   variants — iOS and Android render them without asking.
3. Palette: `setColors({ light, dark })` once at startup with the brand's
   `primary`/`accent` (and any other tokens); re-run the contrast test.
4. Type: `setFonts` with the brand faces, loaded through `expo-font`.
5. Wordmark: `client/features/navigation/WebNavShell.tsx` (`Wordmark`).
