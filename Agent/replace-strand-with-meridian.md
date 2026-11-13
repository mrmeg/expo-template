---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Replace the Strand look with Meridian

## Goal

Remove Strand from the Looks demo and put a new look, Meridian, in its slot. Matt compared Strand and Editorial on the Housefold hub design canvas and chose a look between them: Strand's cool carbon neutrals, hairlines and single blue signal, without its 2px corners, uppercase expanded Archivo titles and mono figures; plus Editorial's soft corners and Newsreader titles. Housefold will adopt Meridian next, so the template must define and preview it.

## Context

Verified on `dev` at `31b0f0bf`.

- `DEMO_LOOKS` in `client/showcase/looks.ts` is the one list of looks, in the order refined, classic, strand, glass, editorial. Everything else (the `/looks` list, `/looks/<id>` detail, Explore search hits, the reference snippet) derives from it.
- Strand is demo-only. The package ships only `refinedLook` and `classicLook` (`packages/ui/src/state/looks.ts`), so this needs no package source change and no version bump.
- Strand's faces are a web-only override (`STRAND_WEB_FONTS`, `STRAND_STYLESHEET` in `looks.ts`). `client/showcase/looks/loadLookFonts.ts` injects `demo.fonts.webStylesheet` before `applyLook`; `referenceFonts` feeds the snippet in `client/showcase/lookReference.ts`. Native Strand keeps the default sans and platform mono.
- Newsreader is already loaded for the kit's serif preset (`app/+html.tsx` self-hosts it on web; native registers `client/lib/fonts/newsreaderFonts.native.ts`). Editorial uses it through `serif: "newsreader"`.
- `DemoDisplay` fields only Strand sets: `title.uppercase`, `title.wide`, `tabLabels`, `segmentTint`, `gridLine`, `chrome: "hud"`. Strand is also the only look that sets `labelVariant`. Their consumers are in `client/showcase/looks/parts.tsx` (grid lines, `HudCorners`, `HudPrefix`, `hudDot`, `hudBar`, `upperTracked`, `fontStretch`), `client/showcase/looks/HomeSample.tsx` and `client/showcase/looks/SettingsSample.tsx` (`segmentTint`).
- `client/showcase/__tests__/looks.test.ts` requires every non-package look to color all package tokens in both schemes, define `shape.button/input/card/badge/dialog` and `treatments`, and hold 4.5:1 for `text`, `textDim` and `link` on `background` and `card`.
- Strand is named in tests (`looks.test.ts`, `lookReference.test.ts`, `lookSession.test.ts`, `looksScreen.test.tsx`, `galleries.test.tsx`, `filters.test.ts`) and in prose (`client/showcase/LooksScreen.tsx`, `docs/brand.md`, `packages/ui/README.md`, and generated `llms-full.txt`).

## Work

### 1. Define Meridian in `client/showcase/looks.ts`

Delete `strandLook`, `ARCHIVO`, `JETBRAINS_MONO`, `STRAND_WEB_FONTS` and `STRAND_STYLESHEET`. Add `meridianLook` with exactly these values:

```ts
const GEIST_MONO = "\"Geist Mono\", ui-monospace, monospace";

const MERIDIAN_WEB_FONTS: NonNullable<Look["fonts"]> = {
  families: { mono: { regular: GEIST_MONO } },
  webWeightStrategy: "numeric",
};

const MERIDIAN_STYLESHEET = {
  id: "mrmeg-demo-looks-meridian",
  href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400..600&display=swap",
};

const meridianLook: Look = {
  id: "meridian",
  name: "Meridian",
  description: "Geist with Newsreader titles and Geist Mono labels, cool carbon neutrals, soft 6 / 12 corners, hairlines, one blue signal.",
  serif: "newsreader",
  fonts: Platform.OS === "web" ? MERIDIAN_WEB_FONTS : undefined,
  colors: {
    light: {
      surfaceSunken: "#eceeeb",
      background: "#f5f6f4",
      foreground: "#111416",
      card: "#fcfcfb",
      cardForeground: "#111416",
      popover: "#fcfcfb",
      popoverForeground: "#111416",
      text: "#111416",
      textDim: "#485158",
      primary: "#111416",
      primaryForeground: "#f5f6f4",
      secondary: "#e9ebe8",
      secondaryForeground: "#111416",
      muted: "#e9ebe8",
      mutedForeground: "#485158",
      accent: "#1d5fc4",
      accentForeground: "#ffffff",
      link: "#1d5fc4",
      destructive: "#b42f1d",
      destructiveForeground: "#ffffff",
      success: "#17704c",
      warning: "#f59e0b",
      border: "#dcdfdc",
      borderStrong: "#c2c7c5",
      input: "#c2c7c5",
      ring: "#1d5fc4",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    dark: {
      surfaceSunken: "#090a0c",
      background: "#0d0f11",
      foreground: "#eceff1",
      card: "#14171a",
      cardForeground: "#eceff1",
      popover: "#14171a",
      popoverForeground: "#eceff1",
      text: "#eceff1",
      textDim: "#a0aab1",
      primary: "#eceff1",
      primaryForeground: "#0d0f11",
      secondary: "#1d2125",
      secondaryForeground: "#eceff1",
      muted: "#1d2125",
      mutedForeground: "#a0aab1",
      accent: "#8cc2ff",
      accentForeground: "#0d0f11",
      link: "#8cc2ff",
      destructive: "#ff8a7a",
      destructiveForeground: "#0d0f11",
      success: "#7fe0b4",
      warning: "#fbbf24",
      border: "#262b30",
      borderStrong: "#3a4148",
      input: "#3a4148",
      ring: "#8cc2ff",
      overlay: "rgba(0, 0, 0, 0.7)",
    },
  },
  shape: {
    button: { borderRadius: 6, withShadow: false },
    input: { borderRadius: 6 },
    card: { borderRadius: 12 },
    sheet: { borderRadius: 12 },
    badge: { borderRadius: 9999 },
    dialog: { borderRadius: 12 },
  },
  treatments: {
    segmentedSelection: "surface",
    switchTrack: "primary",
    eyebrow: "sentence",
    focusRing: "offset",
    elevation: "hairline",
  },
};
```

`textDim` is set to hold the kit's own floors (7:1 on `background`, `card` and `popover`, 6:1 on `muted`) in both schemes, not only the demo test's 4.5:1. If the token list in `rawThemeColors` has changed since this was written, color every token it lists.

Put Meridian third in `DEMO_LOOKS`, where Strand was:

```ts
{
  look: meridianLook,
  display: {
    title: { size: "display", weight: "medium", variant: "serif", tracking: -0.015 },
    labelVariant: "mono",
    chrome: "plain",
    tabDot: true,
  },
  fonts: { webStylesheet: MERIDIAN_STYLESHEET },
  referenceFonts: MERIDIAN_WEB_FONTS,
},
```

No `figure` entry: stat figures stay the kit's own (Geist). Rewrite the file's header comment: Strand is gone, and Meridian does not come from the design boards; it was designed on the Housefold hub canvas, so its values are authored here.

Before relying on a mono-only `fonts` override, read how the theme store applies `FontOverrides` (`packages/ui/src/state`) and confirm that `webWeightStrategy: "numeric"` with only `mono` set leaves the default Geist sans and the Newsreader serif rendering at their normal weights on web. If it does not, adjust the override so it does, and say what you changed in the PR.

### 2. Remove Strand-only presentation

After step 1 nothing sets `title.uppercase`, `title.wide`, `tabLabels`, `segmentTint`, `gridLine` or `chrome: "hud"`. Remove those fields from `DemoDisplay` and their consumers in `client/showcase/looks/parts.tsx`, `HomeSample.tsx` and `SettingsSample.tsx` (grid lines, `HudCorners`, `HudPrefix`, `hudDot`, `hudBar`, `upperTracked`, the `fontStretch` rule, the `tintColor` branches). Grep each name before deleting; keep anything Glass or Editorial still reads.

Keep `labelVariant`, now meaning the face for eyebrows and data labels only. Tab labels stop reading it, so Meridian's tab labels stay sans. Update its doc comment.

Update the Strand mentions in comments in `loadLookFonts.ts`, `lookReference.ts` and `parts.tsx` to describe Meridian's web-only mono instead.

### 3. Tests

Replace Strand with Meridian in `client/showcase/__tests__/`:

- `looks.test.ts`: the order is refined, classic, meridian, glass, editorial.
- `lookReference.test.ts`: shape rows are button 6, card 12, sheet 12 with no button shadow; the snippet contains `applyLook(meridianLook)`, `const meridianLook: Look = {`, `accent: "#1d5fc4"`, `Geist Mono` and `fonts.googleapis.com`.
- `lookSession.test.ts`, `looksScreen.test.tsx`, `galleries.test.tsx` (search "meridian", hit `explore-hit-look-meridian`), `filters.test.ts` (`lookRoute("meridian")`).

Keep every assertion's intent; change only the look and its expected values. Remove tests that covered only the deleted HUD presentation, if any exist.

### 4. Docs

- `client/showcase/LooksScreen.tsx`, `docs/brand.md`, `packages/ui/README.md`: name Meridian where Strand is listed.
- Run `bun run gen` and commit what it regenerates (`llms-full.txt` at least). Never hand-edit generated files.

## Out of scope

- Adding Meridian to the package (`packages/ui/src/state/looks.ts`) or bumping any package version.
- Bundling Geist Mono for native. Native Meridian keeps the platform mono, as native Strand did.
- Adopting Meridian in Housefold or any other fork.
- Re-syncing the `@mrmeg/expo-ui` design system in Claude, whose README still lists Strand. Note it in the PR description as a follow-up for Matt.

## Validation

Run from the repo root and report the output:

- `bun run verify`
- `bun run typecheck`, `bun run lint`, `bun run lint:ui`
- `bun run test:ci` (if tests fail on stale `packages/*/node_modules` or `dist`, delete those and rerun)
- `bun run gen --check`, `bun run docs:versions:check`
- `git grep -i strand -- . ':!Agent'` returns nothing.

Check on web (a fresh origin opens onboarding: Skip first), in light and dark:

- `/looks` lists Refined, Classic, Meridian, Glass, Editorial.
- `/looks/meridian` applies the look: Newsreader screen titles, Geist body, Geist Mono eyebrows, sans tab labels, 6px buttons, 12px cards, blue focus ring and links.
- Its reference page shows the colors, type, shape, treatments and a snippet naming Geist Mono.
- Switching Meridian to Classic, Glass or Editorial and back leaves no stale face (Inter loads; the mono override clears).
- `/looks/strand` shows the screen's existing unknown-look state and does not crash.

Check on the iOS simulator that `/looks/meridian` renders with Newsreader titles and the platform mono, with no missing-font error.
