import { colors } from '@/constants/colors';
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  const lightText = colors.light.colors.text;
  const lightBackground = colors.light.colors.card;
  const darkText = colors.dark.colors.text;
  const darkBackground = colors.dark.colors.card;

  /**
   * Global CSS styles for the application
   *
   * 1. Sets the default light mode background color for the body
   * 2. Applies dark mode background color when user prefers dark color scheme
   * 3. Fixes the browser autofill styling for input fields:
   *    - Sets text color to match the theme
   *    - Changes the default yellow background to match the card color
   *    - Adds a long transition to prevent flashing
   * 4. Applies the same autofill fixes for dark mode with appropriate colors
   */
  const cssStyles = `
      body {
        background-color: ${colors.light.colors.background};
      }

      @media (prefers-color-scheme: dark) {
        body {
          background-color: ${colors.dark.colors.background};
        }
      }

      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-text-fill-color: ${lightText};
        -webkit-box-shadow: 0 0 0px 1000px ${lightBackground} inset;
        transition: background-color 5000s ease-in-out 0s;
      }

      @media (prefers-color-scheme: dark) {
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: ${darkText};
          -webkit-box-shadow: 0 0 0px 1000px ${darkBackground} inset;
          transition: background-color 5000s ease-in-out 0s;
        }
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
