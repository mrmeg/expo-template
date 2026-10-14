/**
 * The one react-native-web export the package calls directly: the web `Icon`
 * renderer (`components/IconGlyph.tsx`) draws a DOM `<svg>` through it, so RN
 * style arrays, `testID`, and ARIA props convert exactly as they do on `View`.
 * react-native-web ships no types; this declares only that function, and the
 * renderer's own signature keeps it out of the emitted declarations.
 */
declare module "react-native-web" {
  import type { ReactElement } from "react";

  export function unstable_createElement(
    tag: string,
    props?: Record<string, unknown>,
    options?: unknown
  ): ReactElement;
}
