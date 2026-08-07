/**
 * SsrThemeProvider contract tests.
 *
 * The provider is the per-request channel that gets the visitor's theme into
 * the render before hydration. The regressions that matter:
 *   - it reads `document.cookie` in the browser (NOT localStorage — the server
 *     can't see that, and the asymmetry is the hydration mismatch this fixes)
 *   - it recovers the server's resolved system scheme from the
 *     `data-ssr-system-scheme` attribute, because the client hint is a request
 *     header browser JS cannot read
 *   - with no signal it provides the shared default, so `useTheme` behaves
 *     exactly as it did before the seed existed
 *   - the seed is captured once per mount and is not recomputed on rerender
 *     (the post-mount reconcile lives in the store's `hasLoadedTheme`)
 *   - it is inert on native
 */

import React from "react";
import { Platform } from "react-native";
import { render } from "@testing-library/react-native";
import { SSR_THEME_SEED_DEFAULT, useSsrThemeSeed, type SsrThemeSeed } from "@mrmeg/expo-ui/state";

import { SsrThemeProvider } from "../SsrThemeProvider";

let observed: SsrThemeSeed | null = null;

function Probe() {
  observed = useSsrThemeSeed();
  return null;
}

function installDocument(cookie: string, systemScheme?: string) {
  const attributes: Record<string, string> = {};
  if (systemScheme !== undefined) attributes["data-ssr-system-scheme"] = systemScheme;
  const doc = {
    cookie,
    documentElement: {
      getAttribute: (name: string) => attributes[name] ?? null,
    },
  };
  (globalThis as unknown as { document: typeof doc }).document = doc;
  return doc;
}

describe("SsrThemeProvider", () => {
  const originalOS = Platform.OS;
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;

  beforeEach(() => {
    observed = null;
    (Platform as { OS: string }).OS = "web";
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    if (originalDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    }
  });

  it("seeds an explicit preference from the cookie", async () => {
    installDocument("user-theme-preference=dark");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "dark", systemTheme: "light" });
  });

  it("recovers the server's system scheme from the html attribute", async () => {
    // The server resolved dark from `Sec-CH-Prefers-Color-Scheme` and stamped
    // it into the HTML; reading `window.matchMedia` instead would diverge from
    // the server on every hint-less request.
    installDocument("user-theme-preference=system", "dark");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("ignores localStorage entirely", async () => {
    installDocument("");
    const getItem = jest.fn(() => "dark");
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem };

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(getItem).not.toHaveBeenCalled();
    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it("provides the shared default when there is no signal", async () => {
    installDocument("mrmeg-vw=1280; has-seen-onboarding=1");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("ignores a cookie value the store would never write", async () => {
    installDocument("user-theme-preference=sepia");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("captures the seed once and does not recompute it on rerender", async () => {
    const doc = installDocument("user-theme-preference=dark");

    const { rerender } = await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);
    expect(observed).toEqual({ userTheme: "dark", systemTheme: "light" });

    // A later cookie write must not retroactively change the value this render
    // pass committed with — the store's hasLoadedTheme owns the handover.
    doc.cookie = "user-theme-preference=light";
    await rerender(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "dark", systemTheme: "light" });
  });

  it("is inert on native", async () => {
    (Platform as { OS: string }).OS = "ios";
    installDocument("user-theme-preference=dark");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
  });
});
