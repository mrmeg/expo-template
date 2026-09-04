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
 * That order is deliberate: the client sheet must win ties, because this
 * snapshot carries classic base resets (`.css-g5y9jx { padding: 0px; … }`)
 * that would otherwise zero out atomics registered only on the client. Keep
 * the resets in here though — pre-hydration they are defined nowhere else.
 *
 * The same order has a reverse edge, which `hardenFlushedSheet` closes: RNW
 * inserts its resets into the client sheet at module scope, the moment the
 * bundle boots, while the route's atomics reach that sheet only when the
 * route chunk executes. With async routes on web that is a separate download,
 * so on a cold cache there is a window where the client sheet holds resets
 * and no atomics, and its single-class resets beat this sheet's single-class
 * atomics by order — padding and margins snap to zero until the chunk lands.
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
      {hardenFlushedSheet(sheet.textContent)}
    </style>
  );
}

/**
 * Doubles every atomic selector in the flushed sheet (`.r-1udh08x` →
 * `.r-1udh08x.r-1udh08x`) so it carries two-class specificity and outranks any
 * single-class reset in the client sheet regardless of document order.
 *
 * Only atomics are doubled. Classic resets (`.css-*`), element resets
 * (`body`, `html`), group markers, and keyframes keep their specificity so
 * client-registered atomics still beat the flushed resets by order. Doubling
 * atomics cannot fight the client sheet either: the same class always maps
 * to the same declarations, and an atomic RNW removes from an element stops
 * applying whatever its specificity.
 *
 * RNW emits one rule per line with no indentation, so anchoring on line start
 * is exact and leaves keyframe bodies (`0%{…}100%{…}`) untouched.
 */
export function hardenFlushedSheet(sheetText: string): string {
  return sheetText.replace(/^\.(r-[\w-]+)/gm, ".$1.$1");
}
