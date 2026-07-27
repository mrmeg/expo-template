import { colors, type Theme } from "../constants/colors";

/**
 * Registers theme-dependent styles at module scope so react-native-web
 * inserts their CSS rules into the server-side sheet before the document
 * <head> is serialized.
 *
 * Styles created lazily during render — the
 * `useMemo(() => createStyles(theme), [theme])` idiom — are inserted into
 * RNW's sheet *after* expo-router has already captured the
 * `<style id="react-native-stylesheet">` snapshot for the head. The SSR
 * HTML then references class names that have no rules, which paints
 * completely unstyled until hydration re-inserts them client-side (worst
 * on the first request after a server cold start, and on every dev
 * rebundle). See docs/ssr-hydration.md.
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
