/**
 * Registers font files through `expo-font` — web variant: nothing to register.
 *
 * Web loads its faces from stylesheets (see `useResources`), so the hook never
 * calls this there. Keeping `expo-font` behind this split also keeps it out of
 * the web bundle: `useResources` was its only importer, which put it on every
 * route. Metro resolves `loadNativeFonts.native.ts` on iOS and Android instead.
 *
 * Private module: not re-exported from `lib/index.ts`, and `lib/*` is not an
 * exported subpath, so consumers can't reach it.
 */
export type NativeFontMap = Readonly<Record<string, number | string>>;

export function loadNativeFonts(_fonts: NativeFontMap): Promise<void> {
  return Promise.resolve();
}
