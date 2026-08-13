---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/63
---

# CSS-variable theming on web

## Goal

Make the exported HTML theme-agnostic: on web, semantic theme colors resolve to
CSS custom properties (`var(--c-*)`) defined per `html[data-theme]` in
`app/+html.tsx`, so a dark visitor's first frame paints fully dark with zero
JS. This removes the reason the `theme-loading` shield exists (commit 7475398:
the shield hides `#root` for dark visitors because the shell bakes light hex
colors that CSS cannot re-theme), so the shield is deleted as part of this
work — nothing hidden, nothing flashed, on any cold load.

## Context

Verified current behavior:

- Exported shells bake literal light-theme hex into every style because theme
  colors are JS strings resolved at render time. `packages/ui/src/constants/colors.ts`
  defines a flat semantic `ThemeColors` interface (string values); the only
  non-hex values are two literal `rgba()` `overlay` tokens.
- Runtime color math on theme values DOES exist (review finding 2026-08-12),
  all funneled through `packages/ui/src/hooks/useTheme.ts`:
  - Module-level `withAlpha(color, alpha)` (~line 428) parses hex/rgba and
    **replaces** the alpha channel (source alpha is discarded — the overlay
    tokens' 0.5/0.7 never survive it). Exposed via the hook return and the
    `createStyles` StyleContext. `getShadowStyle` feeds `theme.colors.overlay`
    and `theme.colors.primary` (glow) through it on every shadowed surface.
  - `parseColor`-based contrast helpers: `getContrastingColor` (module-level
    cache keyed on the raw input strings), `getContrastRatio`,
    `getTextColorForBackground`. ~14 files call these or `withAlpha` with
    theme colors: Button (destructive/custom presets only — default/ghost/
    secondary/outline/link use direct tokens), Switch, TextInput, Popover,
    Dialog, Slider, Toggle, ToggleGroup, Checkbox, RadioGroup, Tooltip, and
    templates settings/list/hero. A `var()` input makes `parseColor` return
    null → `console.error` + wrong fallback.
  - 23 hex-alpha concatenations `theme.colors.x + "15"` across 9 files
    (5 `client/features/auth/components/*Form.tsx`,
    `packages/ui/src/components/Notification.tsx`, `app/(main)/(tabs)/profile.tsx`,
    `settings.tsx`, `app/(main)/(demos)/auth-demo.tsx`) — `var(--c-x)15` is
    invalid CSS and paints nothing.
- `createThemedStyles` (`packages/ui/src/lib/themedStyles.ts`) runs factories
  for BOTH themes eagerly at module scope (required for the head-snapshot CSS
  registration), so code inside a factory cannot consult the active scheme —
  it only receives the theme object. Web `var()` handling must not depend on
  runtime scheme state at factory time.
- The onboarding gate (the only cold-load surface) uses none of the
  helper-derived colors: `OnboardingFlow.tsx` buttons are `ghost`/`default`
  presets (direct tokens) and it has no `withAlpha`/concat/contrast usage. So
  helper outputs staying runtime-computed does not break the zero-JS dark
  first frame.
- react-native-web 0.21.2 passes string style values through to CSS verbatim
  (`normalizeValueWithProperty` only converts numbers) — proven in commit
  7475398 with `width: "100vw"`. `var(--c-x)` will reach the DOM unchanged.
- Icons are Feather font glyphs (`useResources`), colored via CSS `color` —
  no SVG presentation attributes to worry about.
- The blocking script in `app/+html.tsx` stamps `data-theme` on `<html>`
  pre-paint and adds `theme-loading` for dark visitors;
  `client/features/app/RootLayout.tsx` removes it on the first commit whose
  `scheme` matches the stamp. `useTheme` keeps `data-theme` in sync afterward.
- `client/features/app/safariThemeColor.ts` writes a literal color string into
  `<meta name="theme-color">` — this sink cannot take `var()`.
- 73 files consume colors via `createThemedStyles(theme => ...)`; apart from
  the 9 concat files above they need no changes if `theme.colors.*`
  transparently becomes a `var()` string on web.
- `packages/ui` is the npm source for `@mrmeg/expo-ui` (consumed by sibling
  apps with their own `+html.tsx`), so the CSS block must be exported as a
  helper, not hardcoded in this repo's `+html.tsx`.

## Work

1. `packages/ui/src/constants/colors.ts` (or sibling module): derive a stable
   `--c-<token>` name per semantic color token. Export
   `getThemeCssVariables(): string` returning CSS that defines every token
   under `html[data-theme="light"]` and `html[data-theme="dark"]`, plus a
   `@media (prefers-color-scheme: dark)` block for `html:not([data-theme])`
   (pre-script fallback, mirroring the existing body-background fallback).
   Also emit a companion `--c-<token>-rgb: R, G, B` triplet per token (alpha
   stripped) — `withAlpha` rewrites onto these (item 4).
2. Same module, web only (`Platform.OS === "web"`): build both schemes'
   `colors.<scheme>.colors` maps with `var(--c-*)` strings; keep native on raw
   hex. Export the raw hex maps (e.g. `rawThemeColors.light/.dark`) for
   non-CSS sinks. The two `rgba()` overlay tokens become variables like any
   other token.
3. Navigation theme (`colors.<scheme>.navigation`): attempt `var()` on web,
   but @react-navigation internals sometimes parse colors with a color
   library; if anything color-parses at runtime, keep the navigation map on
   raw hex — acceptable because the cold-load surface is the onboarding gate,
   which doesn't render navigation chrome. Record which way it went in the
   CHANGELOG.
4. `packages/ui/src/hooks/useTheme.ts` — make the color-math helpers
   `var()`-aware:
   - `withAlpha`: when the input matches `var(--c-<token>)`, return
     `rgba(var(--c-<token>-rgb), α)` (pure CSS, re-themes with the variable;
     exact parity because `withAlpha` already replaces alpha). Non-var inputs
     keep the current parse path. Export it standalone from the package (the
     hook and StyleContext delegate to it) so style factories can import it.
     `getShadowStyle` then works unchanged.
   - Contrast helpers (`getContrastingColor`, `getContrastRatio`,
     `getTextColorForBackground`): resolve a `var(--c-<token>)` input to the
     active theme's raw hex (via the `rawThemeColors` reverse lookup) BEFORE
     `parseColor` and before the module-level contrast cache, so cache keys
     stay scheme-specific. These outputs remain runtime-computed literals —
     acceptable per the onboarding fact above.
5. Replace the 23 `theme.colors.x + "NN"` concat sites with
   `withAlpha(theme.colors.x, α)` (hex suffix → fraction: "10"→0.06,
   "15"→0.08, "20"→0.13, "30"→0.19, "40"→0.25).
6. `app/+html.tsx`: inject `getThemeCssVariables()` into the global `<style>`;
   delete the `html.theme-loading #root` rule; remove the
   `classList.add("theme-loading")` branch from `COLOR_SCHEME_SCRIPT` (the
   `data-theme` stamp and `colorScheme` assignment stay — they are the switch
   the variables key off).
7. `client/features/app/RootLayout.tsx`: delete the shield-removal effect.
8. `client/features/app/safariThemeColor.ts`: read from `rawThemeColors[scheme]`.
9. Sweep for other non-CSS sinks of `theme.colors.*` on web (StatusBar,
   SystemUI, expo-navigation-bar are native-only; media StatusBar uses
   literal "black"; verify nothing else feeds a non-style sink) and route any
   found through `rawThemeColors`.
10. `packages/ui`: minor version bump + CHANGELOG entry describing the new
   export and the web `var()` behavior, so downstream apps (Terlo,
   Neurospicyos) can adopt by embedding `getThemeCssVariables()` in their own
   `+html.tsx`.

## Validation

- `bun run build`: the exported `(main)/(tabs)/index.html` contains `var(--c-`
  in the onboarding markup and the `--c-*` definitions in the head `<style>`;
  `theme-loading` appears nowhere in `dist/`.
- Browser, fresh profile, dark scheme, JS disabled: the static shell renders
  dark-themed *content* (onboarding title computed color equals the dark
  foreground token), not just a dark body. With JS enabled: no hidden window,
  no light frame, onboarding functional (paging, dots, buttons).
- Runtime theme toggle (settings screen) still switches every surface
  instantly in both directions.
- Helper surface: no "Invalid color" console errors on load or toggle;
  destructive Button label, Switch/TextInput contrast colors, error-banner
  tints (auth forms, Notification), and card shadows all render correctly in
  both schemes.
- `bunx jest`, `bun run tsc --noEmit`, `bunx eslint` on touched files.
- Native smoke (iOS simulator): onboarding and one themed screen render
  unchanged — native must still receive raw hex.

## Out of scope

- CSS-sizing the remaining JS-breakpoint consumers of `useDimensions`
  (WebNavShell, MaxWidthContainer, Carousel, etc.) — separate spec.
- Reintroducing request-time SSR.
- Publishing the `@mrmeg/expo-ui` release to npm (release flow runs
  separately) and migrating Terlo/Neurospicyos.
- The React #418 hydration regression (separate track).

## Open questions

- None blocking. The navigation-theme decision (item 3) is resolvable during
  implementation with the stated fallback rule.
