import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import { colors } from "@mrmeg/expo-ui/constants";
import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";

import {
  SSR_SYSTEM_SCHEME_ATTRIBUTE,
  THEME_CLIENT_HINT_ACCEPT_CH,
  detectSsrThemeFromRequestScope,
} from "@/server/lib/ssrTheme";
import { BLANK_RECOVERY_SCRIPT } from "@/client/features/app/blankRecoveryScript";

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
// First-visit-only failsafe, and it stays a REAL one.
//
// Since the theme cookie (docs/ssr-hydration.md §5) the server renders the
// visitor's actual theme whenever the request carried a signal, and only then
// stamps `data-theme` on <html> below. This script's `if(root.dataset.theme)`
// bail-out is therefore the handover: signal → the server already got it right
// and the script does nothing; no signal → no `data-theme` was stamped, the
// script runs, and it is the ONLY thing that can resolve a hint-less visitor's
// dark OS before paint.
//
// That last case is the reason the conditional stamp matters. Stamping a
// guessed `data-theme="light"` unconditionally would silence this script AND
// kill the `@media (prefers-color-scheme: dark) html:not([data-theme])` rules
// above — a brand-new dark-OS visitor whose browser sent no
// `Sec-CH-Prefers-Color-Scheme` hint would get a light flash with both safety
// nets disabled. Do not widen the 500ms window either; the cookie path is what
// fixes the common case.
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
  // `Sec-CH-Prefers-Color-Scheme` hint for `system` visitors). When there IS a
  // signal, `ssrScheme` is non-null and `data-theme` below paints the right
  // body background on byte 1 — no blocking script needed — and it
  // short-circuits the COLOR_SCHEME_SCRIPT failsafe.
  //
  // When there is NO signal, `ssrScheme` is null and `data-theme` is omitted
  // deliberately. The server's fallback is a guess (light), and a stamped guess
  // would both silence the script and stop the CSS `html:not([data-theme])`
  // dark fallback from matching, leaving a dark-OS first-timer with a light
  // flash and no recovery. Omitting it hands the case back to the script and
  // the media query, which is exactly how it worked before the cookie existed.
  //
  // `data-ssr-system-scheme` carries the system scheme the server used so the
  // client's first render can agree with it (the hint is a request header,
  // invisible to browser JS). See server/lib/ssrTheme.ts and
  // docs/ssr-hydration.md §5.
  const { seed: ssrThemeSeed, hasSignal: hasThemeSignal, scheme: ssrScheme } =
    detectSsrThemeFromRequestScope();

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

  // Only stamp what the request actually told us. `ssrScheme === null` means
  // the server guessed, so the keys are never added at all — no
  // `data-theme="light"` in the markup — and the inline script plus the
  // `html:not([data-theme])` media query stay in charge.
  //
  // `htmlAttributes.style` is merged rather than replaced — the framework may
  // supply its own `<html>` style, and a bare `style={{ colorScheme }}` after
  // the spread would silently drop whatever it set.
  const themeHtmlProps: Record<string, unknown> = {};
  if (ssrScheme) {
    themeHtmlProps["data-theme"] = ssrScheme;
    themeHtmlProps.style = { ...htmlAttributes?.style, colorScheme: ssrScheme };
  }
  // Only meaningful alongside a signal; on a no-signal render it would just be
  // the same light guess spelled out in the markup.
  if (hasThemeSignal) {
    themeHtmlProps[SSR_SYSTEM_SCHEME_ATTRIBUTE] = ssrThemeSeed.systemTheme;
  }

  return (
    <html
      lang="en"
      {...htmlAttributes}
      {...themeHtmlProps}
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

        {/* Safari chrome tinting (status bar / toolbar), same contract as the
            `data-theme` stamp below: only pin a scheme the request actually
            carried. With a signal, one unqualified meta tints byte-1 chrome to
            the visitor's real theme (which may disagree with their OS — an
            explicit dark cookie on a light OS must win, so the meta can't be
            media-gated). With no signal, a `prefers-color-scheme`-gated pair
            mirrors the CSS fallback exactly — OS-correct without stamping the
            server's light guess over a dark-OS first-timer. After hydration,
            useSafariThemeColorSync (client/features/app/safariThemeColor.ts)
            replaces whichever form rendered with a single store-driven meta. */}
        {ssrScheme ? (
          <meta name="theme-color" content={colors[ssrScheme].colors.background} />
        ) : (
          <>
            <meta
              name="theme-color"
              media="(prefers-color-scheme: light)"
              content={colors.light.colors.background}
            />
            <meta
              name="theme-color"
              media="(prefers-color-scheme: dark)"
              content={colors.dark.colors.background}
            />
          </>
        )}

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
            base resets (`.css-g5y9jx { padding: 0px; margin: 0px; … }`) zero
            out any atomic that exists only in the client sheet — e.g. a
            `.r-fd4yh7 { padding-top: 32px }` registered after the flush was
            serialized. Adoption also means one sheet, not two, so RNW's
            group-marker bookkeeping keeps matching the DOM.

            Must stay empty: RNW hydrates its group records from this element's
            existing rules, and any rule that isn't preceded by a
            `[stylesheet-group="N"]{}` marker throws during that walk. It must
            also stay ahead of the bootstrap <script>s below, since RNW calls
            createSheet() at module scope, before hydration. */}
        <style id="react-native-stylesheet" />

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

        {/* Blank-screen watchdog: buffers early window errors, and if #root
            still has no rendered text 4s after `load`, auto-reloads ONCE
            (sessionStorage-guarded) and replays the captured errors on the
            next load. Must sit in <head>, before the app scripts, so it
            observes module-eval and hydration failures. See
            client/features/app/blankRecoveryScript.ts for the contract. */}
        <script>{BLANK_RECOVERY_SCRIPT}</script>

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
