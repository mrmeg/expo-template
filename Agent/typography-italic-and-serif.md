---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/125
---

# Typography: italic support and an opt-in real serif

## Goal

`StyledText` can render italic, apps can supply italic faces through `setFonts`,
and the package offers a real serif (Newsreader) as an opt-in instead of the
single-face Georgia — without adding a byte to apps that do not opt in.

## Context

- `constants/fonts.ts`: `FontFamilyMap` per variant × weight; `resolveFontStyle`
  returns `{ fontFamily, fontWeight? }` (numeric weight only under the web
  `"numeric"` strategy); serif is Georgia on every slot; `FontOverrides =
  { families?, webWeightStrategy? }`.
- `components/StyledText.tsx`: props `variant`, `fontWeight`, `size`, `semantic`;
  no italic. `hooks/useFontStyle.ts` wraps `resolveFontStyle`.
- `hooks/useResources.ts` loads Inter: native via `lib/interFonts.native.ts`
  (four per-weight subpath imports; the web twin exports `null`), web via one
  Google Fonts stylesheet (`Inter:wght@400;500;600;700`). CHANGELOG Unreleased
  already records trimming Inter to four files — do not add italic files to
  the default native load.
- `@expo-google-fonts/newsreader` 0.4.1 exists on npm with per-weight subpaths
  (same layout as `@expo-google-fonts/inter`); README's `setFonts` example
  already names `Newsreader_400Regular`.
- The showcase section titles (`client/showcase/Section.tsx`) render with the
  serif variant, so the template shows the change.

## Work

1. **Italic.** `FontFamilyOverride` gains optional `italic?: Partial<Record<FontFamilyWeight, string>>`
   (per-weight italic faces). `resolveFontStyle(overrides, variant, weight, { italic })`:
   an italic face from overrides (or the bundled serif preset) wins and emits no
   `fontStyle`; otherwise emit `fontStyle: "italic"` (browser/OS synthesizes).
   `StyledText` prop `italic?: boolean`; `useFontStyle(weight, variant, { italic })`.
   Web default stylesheet becomes `Inter:ital,wght@0,400;0,500;0,600;0,700;1,400`
   (a real 400 italic on web; native stays synthesized — say so in the README).
2. **Serif preset.** `lib/newsreaderFonts.ts` / `.native.ts` mirroring
   `interFonts`: native imports `Newsreader_400Regular`, `500Medium`,
   `600SemiBold`, `700Bold`, `400Regular_Italic` from per-weight subpaths; web
   exports `null`. Add `@expo-google-fonts/newsreader` to
   `packages/ui/package.json` dependencies (per-weight subpaths only, so nothing
   ships unless imported). `useResources({ serif?: "georgia" | "newsreader" })`
   (default `"georgia"`, today's behavior): with `"newsreader"` load the native
   files and a `Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400` stylesheet on
   web, and set a new theme-store field `serifPreset` that `resolveFontStyle`
   consults for the serif variant (`"Newsreader", Georgia, serif` + numeric
   weight on web; `Newsreader_<weight>` on native; italic 400 face). App
   `setFonts` serif overrides still win over the preset.
3. Template: `RootLayout.tsx` (where `useResources` is called) passes
   `{ serif: "newsreader" }`; the showcase's serif titles now render Newsreader.
   Add an italic row to the StyledText section of `client/showcase/ShowcaseScreen.tsx`.
4. Tests first: `resolveFontStyle` italic resolution (override face, synthesized,
   web numeric), `StyledText italic` style, `useResources` serif option loads
   the Newsreader map on native (mock `expo-font`) and injects the stylesheet id
   on web, preset vs `setFonts` precedence, and the existing
   `packageSideEffects` test still passes.
5. Docs: README Typography (italic, serif preset, bundle-size note), `LLM_USAGE.md`,
   CHANGELOG Added; `bun run docs:llms`; `bun run packages:peer-check` (new
   dependency).

## Validation

- `bun run ui:test`, `bun run ui:typecheck`, `bun run typecheck`, `bun run lint`,
  `bun run packages:peer-check`, `bun run docs:llms:check`, `bun run verify`.
- Web: `/showcase` StyledText + a serif section title before/after, light and
  dark, under `/tmp/fleet/ui/expo-ui/typography/`; confirm the Newsreader
  stylesheet is requested once.

## Out of scope

Native italic Inter files by default; variable fonts; changing the default
serif for apps that do not opt in.

## Open questions

None.
