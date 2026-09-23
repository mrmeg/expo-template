/**
 * The packaged Inter faces `useResources` registers through `expo-font` —
 * native variant.
 *
 * Exactly the four static weights the native `sansSerif` family keys point at
 * (see `constants/fonts.ts`), each imported from its own per-weight subpath.
 * The `@expo-google-fonts/inter` root entry `require`s all 18 files (every
 * weight, plus italics), and Metro ships every file a bundle requires, so
 * importing it added 14 unused faces (~4.8 MB) to every native app.
 */
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";

import type { InterFontMap } from "./interFonts";

export type { InterFontMap };

export const interFontMap: InterFontMap | null = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};
