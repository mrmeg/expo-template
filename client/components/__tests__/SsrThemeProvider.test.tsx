/**
 * SsrThemeProvider contract tests.
 *
 * The provider is the per-request channel that gets the visitor's theme into
 * the render before hydration. The regressions that matter:
 *   - it reads `document.cookie` in the browser (NOT localStorage — the server
 *     can't see that, and the asymmetry is the hydration mismatch this fixes)
 *   - it recovers the server's resolved system scheme from the
 *     `data-ssr-system-scheme` attribute, because the client hint is a request
 *     header browser JS cannot read — and it must NOT read the
 *     `system-color-scheme` cookie, even though that one IS readable here: the
 *     hint may have beaten a disagreeing cookie on the server, so a cookie read
 *     would diverge from the served HTML on exactly those requests
 *   - with no signal it provides the shared default, so `useTheme` behaves
 *     exactly as it did before the seed existed
 *   - the seed is captured once per mount and is not recomputed on rerender
 *     (the post-mount reconcile lives in the store's `hasLoadedTheme`)
 *   - it is inert on native
 *
 * The no-signal cases matter most. `app/+html.tsx` omits `data-theme` and
 * `data-ssr-system-scheme` when the request carried nothing, precisely so the
 * inline color-scheme script and the `prefers-color-scheme` CSS fallback stay
 * live for a dark-OS first-timer. The provider has to agree: it must resolve
 * the shared light default from that document rather than reach for
 * `window.matchMedia`, because the SERVER rendered light and the first client
 * render has to match it. The script and the CSS own the visible paint until
 * `hasLoadedTheme` flips; the React tree recolors after that, not before.
 */

import React from "react";
import { Platform } from "react-native";
import { render } from "@testing-library/react-native";
import { SSR_THEME_SEED_DEFAULT, useSsrThemeSeed, type SsrThemeSeed } from "@mrmeg/expo-ui/state";

import { resolveSsrThemeDetection } from "@/server/lib/ssrTheme";

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

  it("provides the shared default on an un-stamped document even when the OS is dark", async () => {
    // The regression case, from the client's side. No cookie, and `+html.tsx`
    // deliberately shipped no `data-ssr-system-scheme` because the server had
    // no signal either — so the seed must be the light default, matching the
    // light tree the server rendered. Resolving dark here (from matchMedia)
    // would be a hydration mismatch; the inline script and the CSS media query
    // are what make the *paint* dark, and `hasLoadedTheme` is what recolors the
    // tree afterwards.
    installDocument("");
    const matchMedia = jest.fn(() => ({ matches: true }));
    (globalThis as unknown as { window: unknown }).window = { matchMedia };

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
    expect(observed).toEqual({ userTheme: "system", systemTheme: "light" });
    expect(matchMedia).not.toHaveBeenCalled();

    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("reads a `system` cookie's scheme back from the stamped attribute, not matchMedia", async () => {
    // `system` + a real client hint IS a signal, so the server stamped both
    // `data-theme` and `data-ssr-system-scheme`. The provider takes the
    // server's answer.
    installDocument("user-theme-preference=system", "dark");
    const matchMedia = jest.fn(() => ({ matches: false }));
    (globalThis as unknown as { window: unknown }).window = { matchMedia };

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "system", systemTheme: "dark" });
    expect(matchMedia).not.toHaveBeenCalled();

    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("agrees with a server render that resolved from the system-color-scheme cookie", async () => {
    // The attribute round-trip that keeps the new cookie hydration-safe: the
    // server resolved dark from `system-color-scheme` and stamped it, and the
    // client has to reach the identical seed from the served bytes.
    const cookie = "user-theme-preference=system; system-color-scheme=dark";
    const server = resolveSsrThemeDetection(cookie);
    expect(server.seed).toEqual({ userTheme: "system", systemTheme: "dark" });

    installDocument(cookie, server.seed.systemTheme);

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual(server.seed);
  });

  it("takes the stamped attribute even when the scheme cookie disagrees with it", async () => {
    // A fresher same-request client hint beat the cookie on the server, so the
    // cookie is NOT the value that was rendered. Reading the cookie here — which
    // browser JS can do — would be a hydration mismatch; the attribute wins.
    const cookie = "user-theme-preference=system; system-color-scheme=light";
    const server = resolveSsrThemeDetection(cookie, "dark");
    expect(server.seed.systemTheme).toBe("dark");

    installDocument(cookie, server.seed.systemTheme);

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "system", systemTheme: "dark" });
  });

  it("ignores the scheme cookie entirely when the document carries no attribute", async () => {
    // Bytes that DID reach this document say dark, and the provider still has to
    // say light — because the served HTML has no attribute, so whatever produced
    // it (a static export, a cached response, a build predating the cookie)
    // rendered light. Only the markup gets a vote.
    installDocument("system-color-scheme=dark");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toBe(SSR_THEME_SEED_DEFAULT);
  });

  it("keeps a dark cookie's seed even when the server stamped no system scheme", async () => {
    // An explicit preference doesn't need the hint at all: `resolveThemePreference`
    // ignores `systemTheme` unless the preference is `system`.
    installDocument("user-theme-preference=dark");

    await render(<SsrThemeProvider><Probe /></SsrThemeProvider>);

    expect(observed).toEqual({ userTheme: "dark", systemTheme: "light" });
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
