import { Platform, StyleSheet } from "react-native";

/**
 * Server-only flush of the react-native-web stylesheet into the SSR stream.
 *
 * The framework's head snapshot (`useServerDocumentContext` → the
 * `<style id="react-native-stylesheet">` node) is taken BEFORE route modules
 * load, so rules registered at route-module scope — including everything
 * hoisted via `createThemedStyles` — miss the head on any render where the
 * module cache is cold: every dev request (Metro re-runs modules per request)
 * and the first request after a production cold start. The HTML then
 * references classes with no rules → unstyled first paint until hydration.
 *
 * This component renders LAST in RootLayout's tree, after the entire app
 * subtree has rendered depth-first, so `StyleSheet.getSheet()` sees every
 * rule the page actually uses. Emitting it as a React 19 style resource
 * (`href` + `precedence`) lets React hoist it and guarantee insertion before
 * suspended content is revealed. On the client it renders nothing — style
 * resources are deduped by `href` and live outside the reconciled tree, so
 * the server-only render does not cause a hydration mismatch; RNW's own
 * runtime sheet takes over after hydration.
 *
 * Cascade note: hoisting puts this node in the head *preamble*, ahead of
 * everything `app/+html.tsx` renders — including the empty
 * `<style id="react-native-stylesheet">` that RNW adopts as its client sheet.
 * That order is deliberate. Both sheets use single-class selectors, so ties go
 * to whichever comes last, and the client sheet must win: this snapshot carries
 * classic base resets (`.css-g5y9jx { padding: 0px; … }`) that would otherwise
 * zero out atomics registered after it was serialized. Keep the resets in here
 * though — pre-hydration they are defined nowhere else.
 */
export function SsrStyleFlush() {
  if (Platform.OS !== "web" || typeof document !== "undefined") {
    return null;
  }

  // getSheet() is a react-native-web extension; absent from RN's types.
  const sheet = (StyleSheet as unknown as {
    getSheet: () => { id: string; textContent: string };
  }).getSheet();

  return (
    <style href="rnw-ssr-flush" precedence="rnw-ssr">
      {sheet.textContent}
    </style>
  );
}
