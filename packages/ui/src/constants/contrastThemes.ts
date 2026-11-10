import { Platform } from "react-native";
import { colors, contrastColorOverrides } from "./colors";
import type { Colors } from "./colors";

/**
 * The base themes under "more" contrast: `colors` with `contrastColorOverrides`
 * merged into each scheme's `colors` on native, where values are literals.
 *
 * Internal: `useTheme` reads it, and `constants/index.ts` deliberately does
 * not re-export this module.
 *
 * On web both contrast levels are the SAME objects as `colors`: theme colors
 * are `var(--c-*)` references and CSS (`getThemeCssVariables`) re-themes them
 * on `data-contrast`, so the identity memoized styles key on must not change.
 */
export const moreContrastColors: Colors =
  Platform.OS === "web"
    ? colors
    : {
      light: {
        ...colors.light,
        colors: { ...colors.light.colors, ...contrastColorOverrides.light },
      },
      dark: {
        ...colors.dark,
        colors: { ...colors.dark.colors, ...contrastColorOverrides.dark },
      },
    };
