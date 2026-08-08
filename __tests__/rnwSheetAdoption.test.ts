/**
 * @jest-environment jsdom
 */
/**
 * react-native-web stylesheet adoption.
 *
 * `app/+html.tsx` renders an empty `<style id="react-native-stylesheet">` so
 * RNW adopts it as the client sheet instead of creating its own at
 * `head.firstChild` — which is what keeps the client sheet AFTER the SSR flush
 * in the cascade (see `__tests__/ssrStyleCascade.test.tsx`).
 *
 * That trick rests on two undocumented behaviors of a third-party dist file
 * (`react-native-web/dist/exports/StyleSheet/dom/`). These tests pin them so an
 * RNW upgrade that changes either one fails here instead of silently zeroing
 * padding in production:
 *
 *  1. `createCSSStyleSheet` resolves the id with `getElementById` and reuses a
 *     matching element rather than creating a competing one.
 *  2. `createOrderedCSSStyleSheet` hydrates its group bookkeeping by walking
 *     the adopted element's existing rules — so the anchor must be EMPTY. A
 *     pre-populated sheet only survives if every rule is preceded by its
 *     `[stylesheet-group="N"]{}` marker, which is why we don't inline the
 *     flushed CSS into this node.
 */

// The exports live in RNW's dist tree, not its public entry point.
type CreateSheet = (
  root?: Node | null,
  id?: string
) => {
  id: string;
  getTextContent: () => string;
  insert: (cssText: string, group: number) => void;
};

const RNW_DOM_PATH = "react-native-web/dist/cjs/exports/StyleSheet/dom/index.js";

/** RNW's sheet registry is module state, so each case needs a fresh copy. */
function loadCreateSheet(): CreateSheet {
  let createSheet: CreateSheet | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ createSheet } = require(RNW_DOM_PATH) as { createSheet: CreateSheet });
  });
  if (!createSheet) throw new Error(`Failed to load ${RNW_DOM_PATH}`);
  return createSheet;
}

const ANCHOR_ID = "react-native-stylesheet";

describe("react-native-web client stylesheet adoption", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("adopts an existing empty <style id=\"react-native-stylesheet\"> instead of creating one", () => {
    // Mimic the SSR head: hoisted flush first, then the anchor.
    document.head.innerHTML =
      '<style data-precedence="rnw-ssr">.css-g5y9jx{padding:0px;}</style>' +
      `<style id="${ANCHOR_ID}"></style>`;
    const anchor = document.getElementById(ANCHOR_ID);

    const sheet = loadCreateSheet()();

    expect(sheet.id).toBe(ANCHOR_ID);
    // No second sheet was created…
    expect(document.querySelectorAll("style")).toHaveLength(2);
    // …and the adopted element is the very node we rendered.
    expect(document.getElementById(ANCHOR_ID)).toBe(anchor);
  });

  it("keeps the adopted sheet after the flush, so the flush loses cascade ties", () => {
    document.head.innerHTML =
      '<style data-precedence="rnw-ssr">.css-g5y9jx{padding:0px;}</style>' +
      `<style id="${ANCHOR_ID}"></style>`;

    loadCreateSheet()();

    const ids = [...document.head.children].map(
      (el) => el.id || el.getAttribute("data-precedence")
    );
    expect(ids).toEqual(["rnw-ssr", ANCHOR_ID]);
  });

  it("without an anchor it inserts its own sheet at head.firstChild — the bug being fixed", () => {
    document.head.innerHTML = '<style data-precedence="rnw-ssr">.css-g5y9jx{padding:0px;}</style>';

    loadCreateSheet()();

    const ids = [...document.head.children].map(
      (el) => el.id || el.getAttribute("data-precedence")
    );
    // The client sheet lands FIRST, so at equal specificity the flush wins and
    // its base resets override client-only atomics.
    expect(ids).toEqual([ANCHOR_ID, "rnw-ssr"]);
  });

  it("routes late rule insertions into the adopted sheet", () => {
    document.head.innerHTML = `<style id="${ANCHOR_ID}"></style>`;

    const sheet = loadCreateSheet()();
    // A padding atomic registered after the flush was serialized — the exact
    // class of rule that used to get zeroed.
    sheet.insert(".r-fd4yh7{padding-top:32px;}", 2.2);

    const rules = [...(document.getElementById(ANCHOR_ID) as HTMLStyleElement).sheet!.cssRules].map(
      (r) => r.cssText
    );
    expect(rules.some((r) => r.startsWith(".r-fd4yh7"))).toBe(true);
    // Group markers stay ordered, so subsequent inserts keep landing correctly.
    const markers = rules
      .map((r, i) => [r.match(/\[stylesheet-group="?([\d.]+)"?\]/)?.[1], i] as const)
      .filter(([g]) => g != null);
    const positions = markers.map(([, i]) => i);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("throws if the anchor is pre-populated without group markers — why it stays empty", () => {
    // This is the failure mode that rules out inlining the flushed CSS into the
    // anchor: RNW's hydration walk assumes a marker precedes every rule.
    document.head.innerHTML = `<style id="${ANCHOR_ID}">.css-g5y9jx{padding:0px;}</style>`;

    expect(() => loadCreateSheet()()).toThrow();
  });
});
