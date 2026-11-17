/**
 * The Allo Round faces for the opt-in `"allo-round"` sans preset (Allo at roundness 100) — web variant: none.
 *
 * Web loads each Allo cut as one multi-weight CSS family (the host's
 * self-hosted `@font-face` rules or the package stylesheet, see
 * `useResources`), so no static `.ttf` is ever referenced. Importing one here
 * would still make the bundler emit it as a web asset, so this variant is
 * empty. Metro resolves `alloRoundFonts.native.ts` on iOS and Android instead.
 */
import type { AlloFontMap } from "./alloFontMap";

export const alloRoundFonts: AlloFontMap = {};
