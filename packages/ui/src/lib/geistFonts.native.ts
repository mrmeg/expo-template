/**
 * The packaged Geist faces `useResources` registers through `expo-font` —
 * native variant.
 *
 * Exactly the four static weights the native `sansSerif` family keys point at
 * (see `constants/fonts.ts`), each imported from its own per-weight subpath.
 * The `@expo-google-fonts/geist` root entry `require`s every file (all nine
 * weights plus italics), and Metro ships every file a bundle requires, so
 * importing it would add the unused faces to every native app.
 */
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";

import type { GeistFontMap } from "./geistFonts";

export type { GeistFontMap };

export const geistFontMap: GeistFontMap | null = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
};
