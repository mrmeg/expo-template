import { colors } from "@/client/constants/colors";
import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
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
  const cssStyles = `
      /* Light mode (default) */
      body {
        background-color: ${colors.light.colors.background};
        color-scheme: light;
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
    `;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Add any additional <head> elements that you want globally available on web... */}

        {/* Global CSS Styles */}
        <style dangerouslySetInnerHTML={{ __html: cssStyles }} />

      </head>
      <body>{children}</body>
    </html>
  );
}
