import type { PropsWithChildren } from "react";
import { getThemeCssVariables } from "@mrmeg/expo-ui/constants";
import { ScrollViewStyleReset } from "expo-router/html";

// This file is web-only and configures the root HTML document for every web
// page. It runs in Node during `expo export` (each route gets a statically
// rendered HTML shell) and never in the browser, so it has no access to the
// DOM, cookies, or request data — everything that depends on the visitor is
// resolved client-side after the bundle boots.
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
  const cssStyles = getRootCssStyles();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

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

        {/* Default SEO — page-level <Head> overrides these. Note that routes
            are client-rendered, so crawlers that don't run JS only ever see
            these document-level defaults (see client/components/Seo.tsx). */}
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
      <body>{children}</body>
    </html>
  );
}
