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
            also exist before the bundle executes — React emits the bootstrap
            scripts after the shell, and the `@expo/router-server` patch runs
            them in order — since RNW calls createSheet() at module scope,
            before hydration. */}
        <style id="react-native-stylesheet" />

        {/* Inter is loaded by @mrmeg/expo-ui's useResources after mount, but
            preloading here means it starts downloading on byte 1 instead of
            after the bundle boots. `display=optional` avoids any swap reflow
            if the font hasn't arrived in ~100ms (system fallback used
            instead). The `id` matches what useResources looks for, so the JS
            injection becomes a no-op. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          id="mrmeg-expo-ui-inter"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=optional"
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
