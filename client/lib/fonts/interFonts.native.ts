/**
 * The Inter files the app registers for `@mrmeg/expo-ui`'s opt-in "inter" sans
 * preset (the classic look): four weights, each from its own per-weight
 * subpath so the native bundle carries exactly these four and no other Inter
 * face. The names match `interFamilies.native` in the kit.
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
