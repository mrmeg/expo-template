import { colors, type Theme } from "../constants/colors";

/**
 * Registers theme-dependent styles at module scope so react-native-web
 * inserts their CSS rules into the sheet before the prerendered document
 * <head> is serialized at export time.
 *
 * Styles created lazily during render — the
 * `useMemo(() => createStyles(theme), [theme])` idiom — are inserted into
 * RNW's sheet *after* expo-router has already captured the
 * `<style id="react-native-stylesheet">` snapshot for the head. The exported
 * HTML shell then references class names that have no rules, which paints
 * completely unstyled until the client re-inserts them on hydration (worst
 * on a cold load of the shell, and on every dev rebundle). See "Enable
 * Server Output" in docs/server-guide.md.
 *
 * Both base themes are computed eagerly at module load. Themes carrying
 * color overrides (global brand or scoped) are computed once per theme
 * object identity — `useTheme` keeps that identity stable, so the WeakMap
 * behaves like the old `useMemo` without the render-time registration.
 */
export function createThemedStyles<T extends object>(
  factory: (theme: Theme) => T
): (theme: Theme) => T {
  const cache = new WeakMap<Theme, T>();
  cache.set(colors.light, factory(colors.light));
  cache.set(colors.dark, factory(colors.dark));
  return (theme: Theme): T => {
    const cached = cache.get(theme);
    if (cached) return cached;
    const created = factory(theme);
    cache.set(theme, created);
    return created;
  };
}
