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
      expect(html).toContain("detectSsrThemeSeedFromRequestScope");
      expect(html).toContain("data-theme={ssrScheme}");
    });

    it("+html.tsx stamps the resolved system scheme for the client to read back", () => {
      // The `Sec-CH-Prefers-Color-Scheme` hint is a request header; browser JS
      // can't see it, so the server must put its resolved value in the HTML or
      // the client's first render has to guess and will diverge.
      expect(html).toContain("SSR_SYSTEM_SCHEME_ATTRIBUTE");
      expect(html).toContain("THEME_CLIENT_HINT_ACCEPT_CH");
    });

    it("the theme-loading shield stays a first-visit-only failsafe", () => {
      const script = html.slice(html.indexOf("const COLOR_SCHEME_SCRIPT"));
      // Bails out when the server already rendered a theme, so it only ever
      // runs for a hint-less first visit.
      expect(script).toContain("if(root.dataset.theme){return;}");
      // And its window must not grow past the documented 500ms.
      expect(script).toContain("},500);");
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
