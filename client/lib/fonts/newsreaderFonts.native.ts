/**
 * The Newsreader files the app registers for `@mrmeg/expo-ui`'s serif preset:
 * four weights and the 400 italic, each from its own per-weight subpath so the
 * native bundle carries exactly these five and no other face. The names match
 * `newsreaderFamilies.native` in the kit.
 */
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader/500Medium";
import { Newsreader_600SemiBold } from "@expo-google-fonts/newsreader/600SemiBold";
import { Newsreader_700Bold } from "@expo-google-fonts/newsreader/700Bold";

import type { NewsreaderFontMap } from "./newsreaderFonts";

export type { NewsreaderFontMap };

export const newsreaderFontMap: NewsreaderFontMap | null = {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
  Newsreader_400Regular_Italic,
};
