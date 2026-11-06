/**
 * Web twin of `interFonts.native.ts`: the Inter faces come from the Google
 * Fonts stylesheet `loadSansPreset("inter")` injects (or the self-hosted
 * `<style id="mrmeg-expo-ui-inter">` in `app/+html.tsx`), so the web bundle
 * carries no font file.
 */
export type InterFontMap = Readonly<Record<string, number>>;

export const interFontMap: InterFontMap | null = null;
