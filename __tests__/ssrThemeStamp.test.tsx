/**
 * What `app/+html.tsx` actually stamps on `<html>`, per request.
 *
 * The shell has to choose between two mutually exclusive strategies, and the
 * choice is driven entirely by whether the request carried a theme signal:
 *
 *   - **Signal** (a `light`/`dark` cookie, or a `Sec-CH-Prefers-Color-Scheme`
 *     hint) → stamp `data-theme` + `color-scheme`. The `html[data-theme=…]`
 *     rules paint the correct body background on byte 1, and the inline
 *     `COLOR_SCHEME_SCRIPT` short-circuits on `root.dataset.theme`.
 *
 *   - **No signal** → stamp NOTHING. The server's light is a guess, and a
 *     stamped guess permanently disables both failsafes that could beat it:
 *     the inline script bails on `root.dataset.theme`, and the
 *     `@media (prefers-color-scheme: dark) html:not([data-theme])` rules stop
 *     matching. A brand-new visitor on a dark OS whose browser sent no hint
 *     would get a light flash with no recovery — the regression these tests
 *     exist to prevent.
 *
 * Rendered rather than grepped: the attribute set on the real element is the
 * contract, and `undefined` vs `"light"` is exactly the distinction a source
 * check is worst at seeing.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// `requestHeaders()` is Expo Server's ambient per-request scope. There is no
// scope under jest, so drive it directly: `null` means "no active scope" and
// the real function's throw is reproduced, which is also the static-export and
// client-bundle path.
const mockScope: { headers: Record<string, string> | null } = { headers: null };

jest.mock("expo-server", () => ({
  requestHeaders: () => {
    const headers = mockScope.headers;
    if (!headers) throw new Error("No active request scope");
    return {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    };
  },
}));

// The framework SSR context. Empty nodes keep the markup small; `htmlAttributes`
// carries a style so the merge (rather than clobber) can be asserted.
jest.mock("expo-router/html", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require("react") as typeof import("react");
  return {
    ScrollViewStyleReset: () => react.createElement("style", { id: "expo-reset" }),
    useServerDocumentContext: () => ({
      htmlAttributes: { style: { WebkitTextSizeAdjust: "100%" } },
      bodyAttributes: {},
      headNodes: [],
      bodyNodes: [],
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Root = require("@/app/+html").default as React.ComponentType<{ children?: React.ReactNode }>;

function renderWith(headers: Record<string, string> | null): string {
  mockScope.headers = headers;
  try {
    return renderToStaticMarkup(<Root><div id="root" /></Root>);
  } finally {
    mockScope.headers = null;
  }
}

/** The opening `<html …>` tag only — the rest of the document is noise here. */
function htmlTag(markup: string): string {
  return markup.slice(markup.indexOf("<html"), markup.indexOf(">", markup.indexOf("<html")) + 1);
}

describe("app/+html.tsx <html> theme stamping — with a signal", () => {
  it("stamps the cookie's explicit dark scheme", () => {
    const tag = htmlTag(renderWith({ cookie: "user-theme-preference=dark" }));

    expect(tag).toContain('data-theme="dark"');
    expect(tag).toContain("color-scheme:dark");
  });

  it("stamps an explicit light scheme too", () => {
    const tag = htmlTag(renderWith({ cookie: "user-theme-preference=light" }));

    expect(tag).toContain('data-theme="light"');
    expect(tag).toContain("color-scheme:light");
  });

  it("resolves a `system` cookie through the client hint", () => {
    const tag = htmlTag(
      renderWith({
        cookie: "user-theme-preference=system",
        "sec-ch-prefers-color-scheme": "dark",
      })
    );

    expect(tag).toContain('data-theme="dark"');
    // The hint is a request header the browser's JS cannot read back, so the
    // resolved value has to travel in the markup for the client's first render.
    expect(tag).toContain('data-ssr-system-scheme="dark"');
  });

  it("resolves a hint-only first visit (no cookie yet) to the OS scheme", () => {
    const tag = htmlTag(renderWith({ "sec-ch-prefers-color-scheme": "dark" }));

    expect(tag).toContain('data-theme="dark"');
    expect(tag).toContain('data-ssr-system-scheme="dark"');
  });

  it("merges the framework's <html> style instead of replacing it", () => {
    const tag = htmlTag(renderWith({ cookie: "user-theme-preference=dark" }));

    expect(tag).toContain("color-scheme:dark");
    // Was being clobbered by `style={{ colorScheme }}` placed after the spread.
    expect(tag).toContain("-webkit-text-size-adjust:100%");
  });
});

describe("app/+html.tsx <html> theme stamping — with no signal", () => {
  // THE regression case: dark OS, first ever visit, no cookie, and a browser
  // that sent no client hint (either it doesn't implement them, or this is the
  // very first request so `Accept-CH` hasn't been honoured yet).
  const noSignalCases: [string, Record<string, string> | null][] = [
    ["no cookie and no hint", {}],
    ["unrelated cookies only", { cookie: "mrmeg-vw=1280; has-seen-onboarding=1" }],
    ["a cookie value the store would never write", { cookie: "user-theme-preference=sepia" }],
    ["no request scope at all (static export / crawler)", null],
  ];

  it.each(noSignalCases)("omits data-theme with %s", (_label, headers) => {
    const tag = htmlTag(renderWith(headers));

    // No attribute at all — NOT `data-theme="light"`. `html:not([data-theme])`
    // has to keep matching so the dark media query can paint the body.
    expect(tag).not.toContain("data-theme");
  });

  it.each(noSignalCases)("omits color-scheme with %s", (_label, headers) => {
    const tag = htmlTag(renderWith(headers));

    expect(tag).not.toContain("color-scheme");
    // The framework's own style still has to survive.
    expect(tag).toContain("-webkit-text-size-adjust:100%");
  });

  it.each(noSignalCases)("omits data-ssr-system-scheme with %s", (_label, headers) => {
    const tag = htmlTag(renderWith(headers));

    // Writing the guessed light here would just be the same guess in a second
    // place; the client resolves the OS scheme itself when there's no signal.
    expect(tag).not.toContain("data-ssr-system-scheme");
  });

  it("leaves the inline script live so a dark OS still gets a dark first paint", () => {
    const markup = renderWith({});

    // The bail-out is conditional on the attribute the render above omitted, so
    // the script proceeds: it reads localStorage / prefers-color-scheme, sets
    // data-theme itself, and shields #root for up to 500ms.
    expect(htmlTag(markup)).not.toContain("data-theme");
    expect(markup).toContain("if(root.dataset.theme){return;}");
    expect(markup).toContain("prefers-color-scheme:dark");
    expect(markup).toContain("theme-loading");
  });

  it("keeps the CSS dark fallback matchable for the pre-script frame", () => {
    const markup = renderWith({});

    expect(markup).toContain("html:not([data-theme]) body");
  });
});

describe("app/+html.tsx <html> theme stamping — a `system` cookie with no hint", () => {
  // A known PREFERENCE but an unknown SCHEME. Treating these as the same thing
  // is what made the unconditional stamp look correct.
  const headers = { cookie: "user-theme-preference=system" };

  it("does not stamp a scheme the server had to guess", () => {
    expect(htmlTag(renderWith(headers))).not.toContain("data-theme");
  });

  it("still records the system scheme it rendered with, so hydration agrees", () => {
    // The seed drove the React tree (light), and the client's first render must
    // reach the same conclusion from the same bytes.
    expect(htmlTag(renderWith(headers))).toContain('data-ssr-system-scheme="light"');
  });
});
