/**
 * Web twin of `newsreaderFonts.native.ts`: the Newsreader faces come from the
 * Google Fonts stylesheet `useResources({ serif: "newsreader" })` injects (or
 * the `<link id="mrmeg-expo-ui-newsreader">` in `app/+html.tsx`), so the web
 * bundle carries no font file.
 */
export type NewsreaderFontMap = Readonly<Record<string, number>>;

export const newsreaderFontMap: NewsreaderFontMap | null = null;
