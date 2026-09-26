import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import { getThemeCssVariables } from "@mrmeg/expo-ui/constants";
import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";

// This file is web-only and configures the root HTML document for every web
// page during server rendering. It runs in Node per request (and during
// `expo export`), never in the browser, so it has no access to the DOM.
// Theme stays visitor-resolved client-side: the CSS variables below make the
// server-rendered markup theme-agnostic, so the server never needs to know
// the visitor's scheme (spec web-ssr-experiment — no theme cookie).
function getRootCssStyles() {
  /**
   * Global CSS styles for the application
   *
   * `getThemeCssVariables()` defines every semantic theme color as a
   * `--c-*` custom property per `html[data-theme]` (with a
   * prefers-color-scheme fallback for the paint before the inline script
   * below stamps `data-theme`). The app's styles reference those variables,
   * so the exported HTML shell is theme-agnostic: a dark visitor's first
   * frame paints fully dark from CSS alone, before any JS runs. Only
   * `color-scheme` (a CSS keyword, not var()-able) still needs explicit
   * per-theme rules here.
   */
  return `
    ${getThemeCssVariables()}

    html,
    body,
    #root {
      height: 100%;
      min-height: 100%;
    }

    body {
      background-color: var(--c-background);
      color-scheme: light;
      margin: 0;
      overflow: hidden;
    }

    #root {
      display: flex;
      isolation: isolate;
    }

    #root > div {
      flex: 1 1 auto;
      min-height: 100%;
    }

    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:active {
      -webkit-text-fill-color: var(--c-foreground);
      -webkit-box-shadow: 0 0 0px 1000px var(--c-card) inset;
      transition: background-color 5000s ease-in-out 0s;
    }

    /* OS dark mode fallback (before the script below runs) */
    @media (prefers-color-scheme: dark) {
      html:not([data-theme]) body {
        color-scheme: dark;
      }
    }

    /* Runtime theme (set by JS on <html data-theme>) */
    html[data-theme="dark"] body {
      color-scheme: dark;
    }

    html[data-theme="light"] body {
      color-scheme: light;
    }
  `;
}

const DEFAULT_DOCUMENT_TITLE = "Expo Template";

/**
 * Self-hosted Inter, the web face of @mrmeg/expo-ui's sans-serif family.
 *
 * `public/fonts/inter/` holds the variable font (weights 100–900) in the same
 * unicode-range subsets Google Fonts serves, copied from the pinned
 * `@fontsource-variable/inter` devDependency (`__tests__/webFonts.guardrail.test.ts`
 * fails if a copy drifts from the package). Served same-origin, so no
 * third-party stylesheet sits between the HTML and first paint, as the Google
 * Fonts `<link rel="stylesheet">` this replaces did.
 *
 * Only Latin is preloaded; the other subsets download only when a page uses a
 * character in their range. `font-display: optional` keeps the no-layout-shift
 * behavior: a preloaded font that arrives within the short block period
 * renders from the first frame, otherwise the fallback stack stays for the
 * page's lifetime instead of swapping in later.
 */
const INTER_PRELOAD_URL = "/fonts/inter/inter-latin-wght-normal.woff2";

const INTER_SUBSETS: { url: string; unicodeRange: string }[] = [
  {
    url: "/fonts/inter/inter-cyrillic-ext-wght-normal.woff2",
    unicodeRange: "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
  },
  {
    url: "/fonts/inter/inter-cyrillic-wght-normal.woff2",
    unicodeRange: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
  },
  {
    url: "/fonts/inter/inter-greek-ext-wght-normal.woff2",
    unicodeRange: "U+1F00-1FFF",
  },
  {
    url: "/fonts/inter/inter-greek-wght-normal.woff2",
    unicodeRange: "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF",
  },
  {
    url: "/fonts/inter/inter-vietnamese-wght-normal.woff2",
    unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  },
  {
    url: "/fonts/inter/inter-latin-ext-wght-normal.woff2",
    unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  },
  {
    url: INTER_PRELOAD_URL,
    unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
];

const INTER_FONT_FACES = INTER_SUBSETS.map(
  ({ url, unicodeRange }) =>
    `@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;font-display:optional;src:url(${url}) format("woff2");unicode-range:${unicodeRange}}`,
).join("\n");

// Blocking script that resolves the visitor's color scheme before the app
// bundle boots: it stamps `data-theme` on <html>, which switches the `--c-*`
// variables above so the whole static shell paints in the right theme on the
// first frame. (Persisted in-app preference overrides the OS scheme, which
// the prefers-color-scheme fallback alone cannot know about.)
const COLOR_SCHEME_SCRIPT =
  "(function(){try{var root=document.documentElement;var t=localStorage.getItem(\"user-theme-preference\");var resolved=(t===\"dark\"||(t!==\"light\"&&window.matchMedia(\"(prefers-color-scheme:dark)\").matches))?\"dark\":\"light\";root.dataset.theme=resolved;root.style.colorScheme=resolved;}catch(e){}})()";

const REACT_SCAN_SCRIPT = `
  (function () {
    var scanHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    var scanEnabledHost = scanHosts.includes(window.location.hostname) || window.location.hostname.endsWith('.local');
    if (scanEnabledHost && new URLSearchParams(window.location.search).has('scan')) {
      var reactScanScript = document.createElement('script');
      reactScanScript.crossOrigin = 'anonymous';
      reactScanScript.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
      document.head.appendChild(reactScanScript);
    }
  })();
`;

export default function Root({ children }: PropsWithChildren) {
  // Framework-collected SSR resources: react-native-web's <style> element
  // with all the r-* class rules, expo-font preload <link>s, route metadata
  // head nodes. Without splatting these into <head>/<body>, the browser
  // paints unstyled HTML on first render because RNW only injects its CSS
  // into document.styleSheets after JS hydrates → FOUC.
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  const cssStyles = getRootCssStyles();

  // Drop the framework's react-native-stylesheet snapshot from headNodes.
  // It's captured BEFORE route modules load, so it's incomplete (missing any
  // rule registered at route-module scope), and SsrStyleFlush already emits
  // the complete sheet as a hoisted style resource. Keeping both is worse
  // than redundant: React hoists the flush ABOVE this snapshot, and the
  // snapshot's later-in-cascade base rules override the flush's atomic rules
  // at equal specificity until the client sheet takes over. The flush sheet
  // is a strict superset, so the snapshot can go.
  //
  // This ALSO keeps the id unique. The empty `<style
  // id="react-native-stylesheet">` anchor rendered below owns that id now, and
  // RNW resolves it with `getElementById` — a duplicate would leave adoption
  // picking whichever came first in the document.
  const filteredHeadNodes = Children.toArray(headNodes).filter(
    (node) =>
      !(
        isValidElement(node) &&
        node.type === "style" &&
        (node as ReactElement<{ id?: string }>).props.id === "react-native-stylesheet"
      )
  );

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Framework SSR resources: expo-font preload <link>s, route
            metadata. Placed early so styles are available before the browser
            parses any element that uses them. The RNW stylesheet snapshot is
            filtered out above — SsrStyleFlush ships the complete sheet. */}
        {filteredHeadNodes}

        {/* Empty anchor that react-native-web ADOPTS as its client stylesheet.
            RNW's createCSSStyleSheet does `getElementById(id)` first and only
            falls back to creating an element (inserted at head.firstChild,
            i.e. cascade position 0) when the lookup misses. Handing it this
            node instead puts the client sheet HERE — after SsrStyleFlush,
            which React hoists into the head preamble above.

            That ordering is the point. Both sheets carry single-class
            selectors, so ties are broken by document order. Without the
            anchor the client sheet lands first and LOSES, letting the flush's
            base resets zero out any atomic that exists only in the client
            sheet — e.g. a rule registered after the flush was serialized.
            Adoption also means one sheet, not two, so RNW's group-marker
            bookkeeping keeps matching the DOM.

            Must stay empty: RNW hydrates its group records from this element's
            existing rules, and any rule that isn't preceded by a
            `[stylesheet-group="N"]{}` marker throws during that walk. It must
            also exist before the bundle executes — `@expo/router-server`
            injects the bootstrap chunks after the shell and runs them in
            order — since RNW calls createSheet() at module scope, before
            hydration. */}
        <style id="react-native-stylesheet" />

        {/* Inter, self-hosted (see INTER_SUBSETS): the preload starts the
            Latin file on byte 1 and the @font-face rules are inline, so no
            stylesheet request stands between the HTML and first paint. The
            style element's `id` is the one @mrmeg/expo-ui's useResources
            looks for, so it skips injecting its Google Fonts stylesheet. */}
        <link
          rel="preload"
          href={INTER_PRELOAD_URL}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style id="mrmeg-expo-ui-inter">{INTER_FONT_FACES}</style>

        {/* Newsreader, the kit's serif preset (RootLayout passes
            `useResources({ serif: "newsreader" })`): four weights and the 400
            italic. The link's `id` is the one useResources looks for, so it
            skips injecting a second copy after hydration. */}
        <link
          id="mrmeg-expo-ui-newsreader"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
        />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Default SEO — page-level <Head> overrides these. Routes are
            server-rendered per request on this branch, so crawlers see real
            route content (see client/components/Seo.tsx). */}
        <title>{DEFAULT_DOCUMENT_TITLE}</title>
        <meta name="description" content="A production-ready Expo and React Native template with UI components, screen templates, and best practices." />

        {/* Add any additional <head> elements that you want globally available on web... */}

        {/* Global CSS Styles */}
        <style>{cssStyles}</style>

        <script>{COLOR_SCHEME_SCRIPT}</script>

        {/* React Scan render highlighting for web.
            Add ?scan to any local web URL to inject the CDN script for that page. */}
        <script>{REACT_SCAN_SCRIPT}</script>
      </head>
      <body {...bodyAttributes}>
        {children}
        {/* Framework body nodes (expo-font runtime resource declarations etc.). */}
        {bodyNodes}
      </body>
    </html>
  );
}
