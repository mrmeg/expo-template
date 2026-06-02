import { createContext, use, useMemo, type ReactNode } from "react";
import type { ColorOverrides } from "./themeStore";

/**
 * Per-subtree color overrides, layered on top of the global theme by `useTheme`.
 *
 * Unlike `setColors` (a global singleton on the theme store, meant for the app's
 * one brand palette), this is React context: it applies only to components
 * rendered inside the provider, and unwinds automatically when that subtree
 * unmounts. Use it for transient, scoped theming — a survey with custom brand
 * colors, a preview pane, an embed — where a global swap would bleed into the
 * rest of the app.
 */
const ThemeColorScopeContext = createContext<ColorOverrides | null>(null);

/** Read the active scoped override (null when not inside a scope). */
export function useThemeColorScope(): ColorOverrides | null {
  return use(ThemeColorScopeContext);
}

// Nested scopes layer: the inner scope's keys win, the outer scope's fill in.
function mergeScopes(
  parent: ColorOverrides | null,
  next: ColorOverrides,
): ColorOverrides {
  if (!parent) return next;
  return {
    light: { ...parent.light, ...next.light },
    dark: { ...parent.dark, ...next.dark },
  };
}

export function ThemeColorScope({
  colors,
  children,
}: {
  /** Per-scheme partial overrides — same shape as `setColors`. */
  colors: ColorOverrides;
  children: ReactNode;
}) {
  const parent = use(ThemeColorScopeContext);
  const value = useMemo(() => mergeScopes(parent, colors), [parent, colors]);
  return (
    <ThemeColorScopeContext.Provider value={value}>
      {children}
    </ThemeColorScopeContext.Provider>
  );
}
