/**
 * SSR hydration guardrails.
 *
 * These assertions exist so a fork can't silently drop the wiring that keeps
 * the server render and the client's first render identical. They are cheap
 * source/behavior checks — the *real* verification is still a curl against the
 * dev server (see docs/ssr-hydration.md → "How to verify an SSR fix").
 *
 * Jest mocks expo-font and react-i18next and tsc doesn't model Metro/SSR, so
 * neither catches a regression here on its own. The point of these tests is to
 * fail loudly if the structural wiring disappears.
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// `app/_layout.tsx` is the routed entry, but it may define RootLayout inline or
// re-export it from the feature layer (it currently does the latter:
// `export { default } from "@/client/features/app/RootLayout"`). The render-body
// i18n init we guard lives in whichever file actually defines the component, so
// resolve that file here instead of hard-coding `app/_layout.tsx`.
function resolveRootLayoutSource(): { rel: string; src: string } {
  const entry = read("app/_layout.tsx");
  const reexport = entry.match(/export\s*\{\s*default\s*\}\s*from\s*["']([^"']+)["']/);
  if (!reexport) return { rel: "app/_layout.tsx", src: entry };

  const spec = reexport[1].replace(/^@\//, "");
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    try {
      return { rel: spec + ext, src: read(spec + ext) };
    } catch {
      // try the next candidate extension
    }
  }
  throw new Error(`Could not resolve RootLayout source re-exported from "${reexport[1]}"`);
}

describe("SSR hydration guardrails", () => {
  // §1 — the HTML shell must render the framework's SSR nodes (RNW <style>,
  // expo-font @font-face). Dropping these causes FOUC + icon-font mismatch.
  describe("app/+html.tsx renders framework SSR nodes", () => {
    const html = read("app/+html.tsx");

    it("consumes useServerDocumentContext", () => {
      expect(html).toContain("useServerDocumentContext");
    });

    it("renders headNodes and bodyNodes", () => {
      expect(html).toContain("headNodes");
      expect(html).toContain("bodyNodes");
    });
  });

  // §2 — the icon font must be registered during render, because expo-font's
  // SSR store is per-request AsyncLocalStorage. A module-scope-only
  // registration lands in at most one request's store, so requests 2+ ship no
  // @font-face and render icons as empty <Text/> → React #418.
  describe("the icon font registers during render for SSR", () => {
    const src = read("packages/ui/src/hooks/useResources.ts");

    it("exports ensureIconFontRegistered() keyed on the lowercase 'feather' family", () => {
      expect(src).toContain("export function ensureIconFontRegistered()");
      // @expo/vector-icons builds the set as createIconSet(glyphMap, 'feather',
      // font), so the server-side loaded-check key is lowercase.
      expect(src).toContain('Font.isLoaded("feather")');
    });

    it("useResources calls it in the render body, not only an effect", () => {
      const renderBody = src.slice(src.indexOf("export const useResources"));
      const callIndex = renderBody.indexOf("ensureIconFontRegistered()");
      const firstEffectIndex = renderBody.indexOf("useEffect(");
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(firstEffectIndex).toBeGreaterThanOrEqual(0);
      expect(callIndex).toBeLessThan(firstEffectIndex);
    });
  });

  // §5 — the theme must be resolved server-side from the cookie. Without this
  // wiring every SSR render ships a LIGHT React tree and dark-mode visitors
  // watch the whole page recolor after hydration.
  describe("the theme is seeded from the request", () => {
    const html = read("app/+html.tsx");

    it("+html.tsx renders data-theme from the per-request read", () => {
      expect(html).toContain("detectSsrThemeFromRequestScope");
      expect(html).toContain("data-theme");
    });

    it("+html.tsx stamps data-theme ONLY when the request carried a real signal", () => {
      // Stamping unconditionally would permanently un-match the
      // `html:not([data-theme])` dark media query AND leave the inline
      // COLOR_SCHEME_SCRIPT nothing to correct against (its restamp needs a
      // `system-color-scheme` cookie behind the stamp, which a guess has no
      // reason to have) — so a dark-OS first-timer with no cookie and no client
      // hint would get a light paint with both failsafes disabled. The attribute
      // must be behind the detection's null `scheme`.
      expect(html).toContain("if (ssrScheme)");
      expect(html).not.toContain("data-theme={ssrScheme}");
    });

    it("+html.tsx merges htmlAttributes.style instead of clobbering it", () => {
      // `style={{ colorScheme }}` after `{...htmlAttributes}` would silently
      // drop any framework-supplied <html> style.
      expect(html).toContain("...htmlAttributes?.style");
    });

    it("+html.tsx stamps the resolved system scheme for the client to read back", () => {
      // The `Sec-CH-Prefers-Color-Scheme` hint is a request header; browser JS
      // can't see it, so the server must put its resolved value in the HTML or
      // the client's first render has to guess and will diverge.
      expect(html).toContain("SSR_SYSTEM_SCHEME_ATTRIBUTE");
      expect(html).toContain("THEME_CLIENT_HINT_ACCEPT_CH");
    });

    // The script is assembled from double-quoted JS strings, so the *source*
    // carries `\"` where the emitted script has `"`. Unescape so these
    // assertions can be written the way the script actually reads.
    const colorSchemeScriptSource = () =>
      html
        .slice(html.indexOf("const COLOR_SCHEME_SCRIPT"), html.indexOf("const REACT_SCAN_SCRIPT"))
        .replace(/\\"/g, "\"");

    it("the theme-loading shield stays a first-visit-or-stale-scheme failsafe", () => {
      const script = colorSchemeScriptSource();

      // Two paths, and both have to survive.
      //
      // 1. No stamp → resolve the scheme here. This is the hint-less first visit
      //    and the only thing that can get a dark OS right before paint.
      expect(script).toContain("if(stamped){");
      expect(script).toContain("root.dataset.theme=resolved");
      // It must still be able to resolve a dark OS on its own for that case.
      expect(script).toContain("prefers-color-scheme:dark");

      // 2. Stamp present → return, UNLESS the cookies prove it stale. The old
      //    unconditional `if(root.dataset.theme){return;}` can't come back: a
      //    `system-color-scheme`-derived stamp is the previous load's reading and
      //    also un-matches the `html:not([data-theme])` media query, so this
      //    restamp is the only remaining correction.
      expect(script).not.toContain("if(root.dataset.theme){return;}");
      expect(script).toContain("stamped===\"light\"");
      expect(script).toContain("pref===\"system\"");
      expect(script).toContain("last!==os");
      expect(script).toContain("os===\"dark\"");

      // Light→dark ONLY: a stale-dark stamp stays dark rather than flashing a
      // light body under a dark tree.
      expect(script).not.toContain("root.dataset.theme=\"light\"");

      // The restamp must NOT touch the attribute the client's hydration seed
      // reads, or the first client render stops matching the served HTML.
      expect(script).not.toContain("data-ssr-system-scheme");
      expect(script).not.toContain("SSR_SYSTEM_SCHEME_ATTRIBUTE");

      // Cookie names come from the shared constants, not fresh literals.
      expect(script).toContain("${THEME_COOKIE_NAME}");
      expect(script).toContain("${SYSTEM_SCHEME_COOKIE_NAME}");

      // And its window must not grow past the documented 500ms.
      expect(script).toContain("},500);");
    });

    it("the staleness check reads cookies, not localStorage", () => {
      const script = colorSchemeScriptSource();
      const stampedBranch = script.slice(
        script.indexOf("if(stamped){"),
        script.indexOf("localStorage.getItem")
      );

      // Cookies are the exact bytes the server resolved from, and localStorage
      // can be evicted while an explicit preference cookie survives — reading it
      // here would let a `dark`-cookie visitor be mistaken for a `system` one.
      expect(script).toContain("document.cookie.match");
      expect(stampedBranch).toContain("ck(");
      expect(stampedBranch).not.toContain("localStorage");
    });

    it("the CSS dark fallback for un-stamped documents survives", () => {
      // The other half of the no-signal path: the body must go dark from the
      // media query before the script (or React) has run at all.
      expect(html).toContain("@media (prefers-color-scheme: dark)");
      expect(html).toContain("html:not([data-theme]) body");
    });

    it("the server exposes signal-vs-guess so the shell can branch", () => {
      const server = read("server/lib/ssrTheme.ts");
      expect(server).toContain("hasSignal");
      // A `system` cookie with no hint is a known preference but an UNKNOWN
      // scheme; conflating the two is how the regression happened.
      expect(server).toContain("SsrThemeDetection");
      expect(server).toContain("schemeIsKnown");
    });

    it("the root layout provides SsrThemeProvider above its own useTheme()", () => {
      const { src } = resolveRootLayoutSource();
      expect(src).toContain("SsrThemeProvider");

      // A component cannot consume a context it renders itself, so the default
      // export must only mount the provider and delegate the theme-reading
      // body to a child component.
      const entry = src.slice(src.indexOf("export default function RootLayout"));
      const providerIndex = entry.indexOf("<SsrThemeProvider>");
      const useThemeIndex = entry.indexOf("useTheme()");
      expect(providerIndex).toBeGreaterThanOrEqual(0);
      expect(useThemeIndex === -1 || providerIndex < useThemeIndex).toBe(true);
    });

    it("packages/ui does not import expo-server for the seed", () => {
      // The package runs outside this server and `check:forbidden-imports`
      // would fail; the parse has to live in the app's server layer.
      expect(read("packages/ui/src/state/ssrTheme.ts")).not.toContain("expo-server");
      expect(read("packages/ui/src/state/themeStore.ts")).not.toContain("expo-server");
    });

    it("the theme store dual-writes the cookie the server reads", () => {
      const store = read("packages/ui/src/state/themeStore.ts");
      expect(store).toContain("writeThemeCookie");
      expect(store).toContain("SameSite=Lax");
      // Same name for the cookie and the localStorage key.
      expect(store).toContain('export const THEME_COOKIE_NAME = THEME_KEY;');
    });
  });

  // §3 — i18n must initialize synchronously during render (incl. SSR), not only
  // in an effect, or SSR-reachable t() leaks raw keys server-side.
  describe("i18n initializes synchronously for SSR", () => {
    it("the root layout calls ensureI18nInitialized() in the render body, not only an effect", () => {
      const { src } = resolveRootLayoutSource();
      expect(src).toContain("ensureI18nInitialized()");

      // The call must not live exclusively inside a useEffect — the whole point
      // is that it runs during render (effects don't fire on the server).
      const renderBody = src.slice(src.indexOf("export default function RootLayout"));
      const callIndex = renderBody.indexOf("ensureI18nInitialized()");
      const firstEffectIndex = renderBody.indexOf("useEffect(");
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(callIndex).toBeLessThan(firstEffectIndex);
    });

    it("importing the i18n module leaves i18next initialized synchronously", () => {
      // Module-load side effect (ensureI18nInitialized()) runs on import.
      const { i18n } = require("@/client/features/i18n");
      expect(i18n.isInitialized).toBe(true);
      // A real key resolves to its translation, not the raw key — exactly what
      // must be true on the server's first render.
      expect(i18n.t("common.ok")).toBe("OK");
    });
  });
});
