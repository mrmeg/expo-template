import { createContext, createElement, use, type ReactNode } from "react";
import type { ResolvedTheme } from "./themeStore";

const InitialSchemeContext = createContext<ResolvedTheme | undefined>(undefined);

/**
 * The scheme the FIRST render should use, before the persisted preference has
 * been read — a server-render hint.
 *
 * On web the theme store boots `system` + `light` and only reads the visitor's
 * preference in `syncThemeFromEnvironment()` after the first commit, so the
 * server and the hydrating client both paint light and a dark-mode visitor
 * gets a flash (and any `useId`-dependent markup that differs by scheme
 * mismatches). An app that knows the scheme on both sides — the template
 * mirrors it into a `color-scheme` cookie the server and `document.cookie`
 * both read — wraps its root in this provider; `useTheme()` uses the hint
 * until `hasLoadedTheme` is true, then the store as always. Mount it ABOVE the
 * first `useTheme()` caller (the root layout itself usually reads the theme
 * for the navigation `ThemeProvider`). Native never hydrates and ignores it.
 *
 * Context, not `setState`: the store is a module singleton shared by every
 * concurrent server request, so a per-request value has to travel down the
 * tree.
 */
export function InitialSchemeProvider({
  scheme,
  children,
}: {
  scheme: ResolvedTheme | undefined;
  children: ReactNode;
}) {
  // `state/*` modules are `.ts` (the package's source export pattern), hence no JSX.
  return createElement(InitialSchemeContext.Provider, { value: scheme }, children);
}

/** The first-render scheme hint, or `undefined` outside an `InitialSchemeProvider`. */
export function useInitialScheme(): ResolvedTheme | undefined {
  return use(InitialSchemeContext);
}
