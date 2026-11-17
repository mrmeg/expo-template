/**
 * The Allo Sharp faces for the default `"allo"` sans preset (Allo at its sharp roundness) — web variant: none.
 *
 * Web loads each Allo cut as one multi-weight CSS family (the host's
 * self-hosted `@font-face` rules or the package stylesheet, see
 * `useResources`), so no static `.ttf` is ever referenced. Importing one here
 * would still make the bundler emit it as a web asset, so this variant is
 * empty. Metro resolves `alloFonts.native.ts` on iOS and Android instead.
 */
import type { AlloFontMap } from "./alloFontMap";

export const alloFonts: AlloFontMap = {};
