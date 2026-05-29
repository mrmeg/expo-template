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

  // §3 — i18n must initialize synchronously during render (incl. SSR), not only
  // in an effect, or SSR-reachable t() leaks raw keys server-side.
  describe("i18n initializes synchronously for SSR", () => {
    it("app/_layout.tsx calls ensureI18nInitialized() in the render body, not only an effect", () => {
      const layout = read("app/_layout.tsx");
      expect(layout).toContain("ensureI18nInitialized()");

      // The call must not live exclusively inside a useEffect — the whole point
      // is that it runs during render (effects don't fire on the server).
      const renderBody = layout.slice(layout.indexOf("export default function RootLayout"));
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
