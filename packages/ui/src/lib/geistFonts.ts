/**
 * The packaged Geist faces `useResources` registers through `expo-font` —
 * web variant: none.
 *
 * Web loads Geist as one multi-weight CSS family (the host's self-hosted
 * `@font-face` rules or the Google Fonts stylesheet, see `useResources`), and
 * `constants/fonts.ts` points every web weight at that family, so no static
 * `.ttf` would ever be referenced. Importing one here would still make the
 * bundler emit it as a web asset, so this variant imports nothing. Metro
 * resolves `geistFonts.native.ts` on iOS and Android instead.
 *
 * Private module: not re-exported from `lib/index.ts`, and `lib/*` is not an
 * exported subpath, so consumers can't reach it.
 */
export type GeistFontMap = Readonly<Record<string, number>>;

export const geistFontMap: GeistFontMap | null = null;
