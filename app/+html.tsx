import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import { colors } from "@mrmeg/expo-ui/constants";
import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";

import {
  SSR_SYSTEM_SCHEME_ATTRIBUTE,
  THEME_CLIENT_HINT_ACCEPT_CH,
  detectSsrThemeSeedFromRequestScope,
  resolveSsrScheme,
} from "@/server/lib/ssrTheme";

// This file is web-only and used to configure the root HTML for every
// web page during server rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
function getRootCssStyles() {
  const lightText = colors.light.colors.foreground;
  const lightBackground = colors.light.colors.card;
  const darkText = colors.dark.colors.foreground;
  const darkBackground = colors.dark.colors.card;

  /**
   * Global CSS styles for the application
   *
   * Uses html[data-theme] attribute selectors so styles follow the app's
   * runtime theme (set by _layout.tsx), not just the OS preference.
   * Media query fallbacks handle the initial paint before JS hydrates.
   */
  return `
    html,
    body,
    #root {
      height: 100%;
      min-height: 100%;
    }

    body {
      background-color: ${colors.light.colors.background};
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
      -webkit-text-fill-color: ${lightText};
      -webkit-box-shadow: 0 0 0px 1000px ${lightBackground} inset;
      transition: background-color 5000s ease-in-out 0s;
    }

    /* OS dark mode fallback (before JS hydrates) */
    @media (prefers-color-scheme: dark) {
      html:not([data-theme]) body {
        background-color: ${colors.dark.colors.background};
        color-scheme: dark;
      }

      html:not([data-theme]) input:-webkit-autofill,
      html:not([data-theme]) input:-webkit-autofill:hover,
      html:not([data-theme]) input:-webkit-autofill:focus,
      html:not([data-theme]) input:-webkit-autofill:active {
        -webkit-text-fill-color: ${darkText};
        -webkit-box-shadow: 0 0 0px 1000px ${darkBackground} inset;
        transition: background-color 5000s ease-in-out 0s;
      }
    }

    /* Runtime dark mode (set by JS on <html data-theme="dark">) */
    html[data-theme="dark"] body {
      background-color: ${colors.dark.colors.background};
      color-scheme: dark;
    }

    html[data-theme="dark"] input:-webkit-autofill,
    html[data-theme="dark"] input:-webkit-autofill:hover,
    html[data-theme="dark"] input:-webkit-autofill:focus,
    html[data-theme="dark"] input:-webkit-autofill:active {
      -webkit-text-fill-color: ${darkText};
      -webkit-box-shadow: 0 0 0px 1000px ${darkBackground} inset;
      transition: background-color 5000s ease-in-out 0s;
    }

    /* Runtime light mode (explicit override when OS is dark) */
    html[data-theme="light"] body {
      background-color: ${colors.light.colors.background};
      color-scheme: light;
    }

    html[data-theme="light"] input:-webkit-autofill,
    html[data-theme="light"] input:-webkit-autofill:hover,
    html[data-theme="light"] input:-webkit-autofill:focus,
    html[data-theme="light"] input:-webkit-autofill:active {
      -webkit-text-fill-color: ${lightText};
      -webkit-box-shadow: 0 0 0px 1000px ${lightBackground} inset;
      transition: background-color 5000s ease-in-out 0s;
    }

    /* Hide React-rendered tree until first dark-themed paint to prevent
       white flash. Body remains dark via the rules above, so users see a
       dark blank, not white. Uses visibility (not display) so layout and
       measurements are preserved. */
    html.theme-loading #root {
      visibility: hidden;
    }
  `;
}

const DEFAULT_DOCUMENT_TITLE = "Expo Template";
// First-visit-only failsafe. Since the theme cookie (docs/ssr-hydration.md §5)
// the server already renders the visitor's real theme and stamps `data-theme`
// on <html> below, so this script is a no-op for anyone who has ever set a
// preference. It still matters for the one case no cookie can cover: a brand
// new visitor whose OS is dark and whose browser sent no
// `Sec-CH-Prefers-Color-Scheme` hint. There the server rendered light, so the
// script hides #root for up to 500ms rather than flash a light tree. Do not
// widen that window — the cookie path is what fixes the common case.
const COLOR_SCHEME_SCRIPT =
  "(function(){try{var root=document.documentElement;if(root.dataset.theme){return;}var t=localStorage.getItem(\"user-theme-preference\");var resolved=(t===\"dark\"||(t!==\"light\"&&window.matchMedia(\"(prefers-color-scheme:dark)\").matches))?\"dark\":\"light\";root.dataset.theme=resolved;root.style.colorScheme=resolved;if(resolved===\"dark\"){root.classList.add(\"theme-loading\");setTimeout(function(){root.classList.remove(\"theme-loading\");},500);}}catch(e){}})()";
// NOTE: neither onboarding nor the theme preference needs a shield in the
// common case any more. The server reads the `has-seen-onboarding` and
// `user-theme-preference` cookies off the request and renders the correct,
// correctly-themed tree outright. See server/lib/ssrOnboarding.ts,
// server/lib/ssrTheme.ts, and docs/ssr-hydration.md §5–§6.
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
  // See: https://docs.expo.dev/versions/latest/sdk/router/#useserverdocumentcontext
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  const cssStyles = getRootCssStyles();

  // Per-request theme, read from the `user-theme-preference` cookie (plus the
  // `Sec-CH-Prefers-Color-Scheme` hint for `system` visitors). Rendering
  // `data-theme` here means the CSS above paints the right body background on
  // byte 1 — no blocking script needed — and it also short-circuits the
  // COLOR_SCHEME_SCRIPT failsafe below. `data-ssr-system-scheme` carries the
  // system scheme the server used so the client's first render can agree with
  // it (the hint is a request header, invisible to browser JS). See
  // server/lib/ssrTheme.ts and docs/ssr-hydration.md §5.
  const ssrThemeSeed = detectSsrThemeSeedFromRequestScope();
  const ssrScheme = resolveSsrScheme(ssrThemeSeed);

  // Drop the framework's react-native-stylesheet snapshot from headNodes.
  // It's captured BEFORE route modules load, so it's incomplete (missing any
  // rule registered at route-module scope), and SsrStyleFlush already emits
  // the complete sheet as a hoisted style resource. Keeping both is worse
  // than redundant: React hoists the flush ABOVE this snapshot, and the
  // snapshot's later-in-cascade base rules (e.g. `.css-text-146c3p1
  // { font: 14px … }`) override the flush's atomic font-size rules at equal
  // specificity until the client sheet takes over — text pops from 14px to
  // its real size mid-load. The flush sheet is a strict superset, so the
  // snapshot can go. If SsrStyleFlush is ever removed, restore this node.
  const filteredHeadNodes = Children.toArray(headNodes).filter(
    (node) =>
      !(
        isValidElement(node) &&
        node.type === "style" &&
        (node as ReactElement<{ id?: string }>).props.id === "react-native-stylesheet"
      )
  );

  return (
    <html
      lang="en"
      {...htmlAttributes}
      data-theme={ssrScheme}
      {...{ [SSR_SYSTEM_SCHEME_ATTRIBUTE]: ssrThemeSeed.systemTheme }}
      style={{ colorScheme: ssrScheme }}
    >
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Ask the browser to send `Sec-CH-Prefers-Color-Scheme` on subsequent
            requests. It's the only way the server can resolve a `system`
            preference (or a brand-new visitor's OS setting) before rendering.
            Document-level opt-in so it lives in one place and survives a
            static export. See server/lib/ssrTheme.ts. */}
        <meta httpEquiv="Accept-CH" content={THEME_CLIENT_HINT_ACCEPT_CH} />

        {/* Framework SSR resources: expo-font preload <link>s, route
            metadata. Placed early so styles are available before the browser
            parses any element that uses them. The RNW stylesheet snapshot is
            filtered out above — SsrStyleFlush ships the complete sheet. */}
        {filteredHeadNodes}

        {/* Inter is loaded by @mrmeg/expo-ui's useResources after mount, but
            preloading here means it starts downloading on byte 1 instead of
            after JS hydrates. `display=optional` avoids any swap reflow if
            the font hasn't arrived in ~100ms (system fallback used instead).
            The `id` matches what useResources looks for, so the JS injection
            becomes a no-op. */}
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

        {/* Default SEO — page-level <Head> overrides these */}
        <title>{DEFAULT_DOCUMENT_TITLE}</title>
        <meta name="description" content="A production-ready Expo and React Native template with UI components, screen templates, and best practices." />

        {/* Add any additional <head> elements that you want globally available on web... */}

        {/* Global CSS Styles */}
        <style>{cssStyles}</style>

        {/* Blocking script that resolves the user's preferred color scheme
            before React hydrates. Sets data-theme on <html> (CSS rules above
            then apply the right body background) and hides #root with the
            `theme-loading` class for dark-mode visitors so they don't see a
            white flash. The 500ms failsafe drops the class if hydration is
            slow or never runs. */}
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
