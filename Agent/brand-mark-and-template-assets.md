---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Brand mark and template assets

## Goal

Give the template (and every app forked from it, doglog included) a real neutral
mark instead of Expo's placeholder concentric-circles art, with the brand system
written down so forks know what they inherit and what to replace. No package
API changes; no version bump.

## Context

- `assets/images/icon.png`, `splash-icon.png`, `adaptive-icon.png` (1024², 8-bit
  colormap) and `favicon.png` (48²) are the stock Expo placeholders (grid with
  three concentric circles). `partial-react-logo.png` is used only by
  `client/templates/hero/demo.tsx:42`. `client/features/auth/components/AuthScreen.tsx:587`
  and `client/showcase/ShowcaseScreen.tsx:1784` `require` `icon.png` as a logo /
  sample avatar, so they pick up the new mark automatically.
- `app.config.ts`: `icon`, `ios` (no icon variants), `android.adaptiveIcon`
  (`foregroundImage`, `backgroundColor: "#ffffff"`, no `monochromeImage`),
  `web.favicon`, and the `expo-splash-screen` plugin (`imageWidth: 200`,
  `resizeMode: "contain"`, `backgroundColor: "#ffffff"`, no `dark` variant).
- The existing brand device is the wordmark in `client/features/navigation/WebNavShell.tsx`
  (`Wordmark`: an 8 px accent dot + `@mrmeg/expo-ui`) and `mockups/*.html`
  (`.wordmark .dot`). Palette: zinc neutrals + teal accent
  (`packages/ui/src/constants/colors.ts`: `teal500 #14b8a6` light,
  `teal400 #2dd4bf` dark, `dark900 #09090B`, `gray50 #FAFAFA`).
- No brand doc exists (`docs/` has none; `AGENTS.md` Docs table lists every doc;
  `scripts/build-llms-full.mjs` holds the source-doc list for `llms-full.txt`).
- Renderer available: `/opt/homebrew/bin/rsvg-convert`. Root Jest (`bun run test:ci`)
  picks up `__tests__/*.test.ts`.

## Work

1. **SVG masters** under `assets/brand/`:
   - `mark.svg` (1024²): background `#09090B`; a rounded-square frame (stroke
     `#FAFAFA`, ~56 px, corner radius ~120 px, inset so the frame is ~560 px)
     with a filled accent dot (`#2DD4BF`, ~176 px) sitting on the frame's
     bottom-right corner — "the dot" from the wordmark inside a component
     frame. The dot must still read at 29 px.
   - `mark-dark.svg`: same art, transparent background (iOS dark icon).
   - `mark-tinted.svg`: frame + dot in one grayscale (`#FAFAFA` frame, `#A1A1AA` dot),
     transparent background (iOS tinted icon).
   - `adaptive-foreground.svg` (1024²): frame + dot scaled to stay inside the
     Android safe zone (inner 66 % circle), transparent background.
   - `adaptive-monochrome.svg`: same geometry, all `#FFFFFF`.
   - `splash-light.svg` / `splash-dark.svg` (1024², transparent): frame in
     `#09090B` with the dot in `#14B8A6` for light; frame `#FAFAFA` with dot
     `#2DD4BF` for dark.
   - `favicon.svg`: dot-in-frame simplified for 48 px (thicker stroke).
2. **Renderer** `scripts/build-brand-assets.mjs`: runs `rsvg-convert` over the
   masters into `assets/images/icon.png` (1024), `icon-dark.png`, `icon-tinted.png`,
   `adaptive-icon.png`, `adaptive-icon-monochrome.png`, `splash-icon.png`,
   `splash-icon-dark.png` (1024), `favicon.png` (48). Add `"brand:assets"` to
   root `package.json` scripts. Commit the rendered PNGs. Delete
   `assets/images/partial-react-logo.png` and point the hero demo at
   `@/assets/images/splash-icon.png`.
3. **`app.config.ts`**: `ios.icon: { light: "./assets/images/icon.png", dark: "./assets/images/icon-dark.png", tinted: "./assets/images/icon-tinted.png" }`;
   `android.adaptiveIcon.backgroundColor: "#09090B"` plus
   `monochromeImage: "./assets/images/adaptive-icon-monochrome.png"`;
   splash plugin `backgroundColor: "#FFFFFF"` and
   `dark: { image: "./assets/images/splash-icon-dark.png", backgroundColor: "#09090B" }`.
4. **`docs/brand.md`**: positioning line ("A quiet, high-contrast foundation
   that gets out of the way of each app's brand"), the palette as semantic
   light/dark tokens with the contrast pairs the package already tests
   (`packages/ui/src/constants/__tests__/colors.test.ts`), the type pairing
   (Inter sans; serif slot, see the typography spec), radii/elevation/8-pt
   rhythm from `spacing.ts`, the mark's construction and what a fork should
   replace (`assets/brand/*.svg`, `EXPO_PUBLIC_APP_NAME`). Add the doc to
   `AGENTS.md`'s Docs table and to the source-doc list in
   `scripts/build-llms-full.mjs`; run `bun run docs:llms`.
5. **Test first**: `__tests__/brandAssets.test.ts` reads each PNG header
   (IHDR width/height) and asserts the sizes above, that the SVG masters exist,
   and that `app.config.ts` resolves (import `appConfig` with a blank env) to
   the paths above. It must fail before step 2/3 and pass after.

## Validation

- `bun run brand:assets` regenerates byte-identical PNGs (run twice, `git status` clean).
- `file assets/images/*.png` shows the sizes above; render each master at
  60/40/29 px (`rsvg-convert -w 29`) and confirm the dot and frame still read.
- `bun x jest __tests__/brandAssets.test.ts --maxWorkers=2`, `bun run typecheck`,
  `bun run lint`, `bun run docs:llms:check`, then `bun run verify`.
- Web: `bun run build && bun run start` (or `expo start --web`) and check the
  favicon and the auth screen logo; before/after under `/tmp/fleet/ui/expo-ui/brand/`.
- Native icon/splash need a rebuild: write "device check pending rebuild" in the PR.

## Out of scope

Package palette changes; store listing art; renaming the template.

## Open questions

None.
