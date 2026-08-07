/**
 * SSR style-cascade ordering.
 *
 * The SSR flush (`client/features/app/SsrStyleFlush.tsx`) re-emits the whole
 * react-native-web sheet so the pre-hydration frame is styled. That node is a
 * React 19 hoistable style resource, so React writes it into the head
 * *preamble* — ahead of everything else `app/+html.tsx` renders. RNW, meanwhile,
 * builds its client sheet with `head.insertBefore(element, head.firstChild)`,
 * landing it at index 0. The flush therefore used to be the LATER sheet, and at
 * equal (single-class) specificity the later sheet wins: the flush's base reset
 * `.css-g5y9jx { padding: 0px; margin: 0px; … }` defeated any atomic
 * padding/margin rule that existed only in the client sheet.
 *
 * The fix is an empty `<style id="react-native-stylesheet">` anchor rendered by
 * `+html.tsx` *after* the preamble. RNW's `createCSSStyleSheet` looks the id up
 * with `getElementById` and returns the existing element, so the client
 * *adopts* the anchor instead of creating a competing sheet at `head.firstChild`
 * — which puts the client sheet after the flush, so the flush can only ever
 * lose ties.
 *
 * These assertions pin the ordering, not the paint. jsdom does not model
 * cross-stylesheet cascade faithfully, so the computed-style check belongs in a
 * real browser (see docs/ssr-hydration.md §7).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// `+html.tsx` reads its nodes from the framework's SSR context. Mock the hook
// so the test can inject the exact node the filter has to strip: the
// framework's own (incomplete) `<style id="react-native-stylesheet">` snapshot.
// The factory must build its JSX inline — jest hoists it above module scope.
jest.mock("expo-router/html", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require("react") as typeof import("react");
  return {
    ScrollViewStyleReset: () => react.createElement("style", { id: "expo-reset" }),
    useServerDocumentContext: () => ({
      htmlAttributes: {},
      bodyAttributes: {},
      headNodes: [
        react.createElement("link", { key: "preload", rel: "preload", href: "/font.woff2", as: "font" }),
        react.createElement("style", {
          key: "rnw-style-element",
          id: "react-native-stylesheet",
          dangerouslySetInnerHTML: { __html: ".css-g5y9jx{padding:0px;}" },
        }),
      ],
      bodyNodes: [react.createElement("script", { key: "body-node" })],
    }),
  };
});

/**
 * A stand-in for what `StyleSheet.getSheet()` returns on web: RNW's serialized
 * sheet, group markers and all. Shape copied from a real production render —
 * the classic `.css-*` resets sit in group 1, the atomics in groups 2–3.
 */
const mockSheetText = [
  '[stylesheet-group="0"]{}',
  "body{margin:0;}",
  '[stylesheet-group="1"]{}',
  ".css-g5y9jx{box-sizing:border-box;display:flex;flex-direction:column;margin:0px;padding:0px;}",
  ".css-146c3p1{display:inline;font:14px;margin:0px;padding:0px;}",
  '[stylesheet-group="2.2"]{}',
  ".r-fd4yh7{padding-top:32px;}",
  '[stylesheet-group="3"]{}',
  ".r-1udh08x{overflow-x:hidden;}",
].join("\n");

// Mirror the SSR environment the flush checks for: web platform, no document.
// Patch through a Proxy so the rest of react-native stays lazy — spreading the
// module eagerly resolves native getters (DevMenu) and throws under jest-expo's
// ios-flavoured environment. `getSheet` is an RNW extension that RN lacks.
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const platform = Object.create(actual.Platform, { OS: { value: "web", enumerable: true } });
  const styleSheet = Object.create(actual.StyleSheet, {
    getSheet: {
      value: () => ({ id: "react-native-stylesheet", textContent: mockSheetText }),
      enumerable: true,
    },
  });
  return new Proxy(actual, {
    get: (target, prop, receiver) => {
      if (prop === "Platform") return platform;
      if (prop === "StyleSheet") return styleSheet;
      return Reflect.get(target, prop, receiver);
    },
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Root = require("@/app/+html").default as React.ComponentType<{ children?: React.ReactNode }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SsrStyleFlush } = require("@/client/features/app/SsrStyleFlush");

/**
 * Render the document the way the streaming renderer does: the app subtree
 * inside `<div id="root">`, with the flush as its last child.
 */
function renderDocument(): string {
  return renderToStaticMarkup(
    <Root>
      <div id="root">
        <div className="css-g5y9jx r-fd4yh7">app</div>
        <SsrStyleFlush />
      </div>
    </Root>
  );
}

const html = renderDocument();
const head = html.slice(0, html.indexOf("</head>"));
const anchorTag = '<style id="react-native-stylesheet">';

describe("SSR style cascade ordering", () => {
  it("renders exactly one <style id=\"react-native-stylesheet\"> — no duplicate snapshot", () => {
    // The framework's snapshot is still filtered out, so the only node with
    // this id is the anchor `+html.tsx` renders itself.
    expect(html.split('id="react-native-stylesheet"').length - 1).toBe(1);
  });

  it("the anchor is empty, so it defines no rules of its own", () => {
    expect(html).toContain(`${anchorTag}</style>`);
    // The framework snapshot's rule must not have survived the filter.
    expect(html).not.toContain(".css-g5y9jx{padding:0px;}");
  });

  it("puts the anchor in <head>, after the hoisted flush", () => {
    const flushAt = head.indexOf('data-precedence="rnw-ssr"');
    const anchorAt = head.indexOf(anchorTag);

    expect(flushAt).toBeGreaterThan(-1);
    expect(anchorAt).toBeGreaterThan(-1);
    // This ordering IS the fix: the adopted client sheet must come last so it
    // wins single-class ties against the flush's base resets.
    expect(anchorAt).toBeGreaterThan(flushAt);
  });

  it("places the anchor before the bootstrap scripts so RNW can adopt it", () => {
    // RNW calls createSheet() at module scope. If the anchor were parsed after
    // the entry bundle ran, getElementById would miss and RNW would create a
    // competing sheet at head.firstChild — reintroducing the defeat.
    const anchorAt = html.indexOf(anchorTag);
    const firstScriptAt = html.indexOf("<script");
    expect(firstScriptAt).toBeGreaterThan(-1);
    expect(anchorAt).toBeLessThan(firstScriptAt);
  });

  it("keeps the flush hoisted via href/precedence so the pre-hydration frame stays styled", () => {
    // Dropping `precedence` would un-hoist the flush into <body>, after the
    // bootstrap scripts and after most of the markup — an unstyled first paint.
    expect(head).toContain('data-precedence="rnw-ssr"');
    expect(head).toContain('data-href="rnw-ssr-flush"');
  });

  it("keeps the base resets in the flush — they are defined nowhere else pre-hydration", () => {
    // `+html.tsx` strips the framework snapshot and the client sheet does not
    // exist until JS runs, so the flush is the ONLY pre-hydration source of
    // View/Text resets. Stripping them collapses every View to block layout.
    const flushStart = head.indexOf('data-precedence="rnw-ssr"');
    const flush = head.slice(flushStart, head.indexOf("</style>", flushStart));
    expect(flush).toMatch(/\.css-[\w-]+\{/);
  });
});
