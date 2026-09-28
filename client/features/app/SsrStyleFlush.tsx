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
 *
 * The sheet is server-wide and only grows, so the serialized text is cached
 * (`readFlushedSheet`) and rebuilt only after a `StyleSheet.create` call —
 * the one path that adds rules — instead of re-sorting and re-joining every
 * rule on every request.
 */
export function SsrStyleFlush() {
  if (Platform.OS !== "web" || typeof document !== "undefined") {
    return null;
  }

  return (
    <style href="rnw-ssr-flush" precedence="rnw-ssr">
      {readFlushedSheet(StyleSheet as unknown as FlushableStyleSheet)}
    </style>
  );
}

/**
 * The react-native-web `StyleSheet` surface the flush reads. `getSheet()` is
 * an RNW extension absent from React Native's types.
 */
export type FlushableStyleSheet = {
  create: (styles: never) => unknown;
  getSheet: () => { id: string; textContent: string };
};

/**
 * Global-registry symbol, so a re-evaluated copy of this module (dev SSR)
 * finds the counter already installed instead of wrapping `create` again.
 */
const RULE_VERSION = Symbol.for("expo-template.ssr-style-flush.rule-version");

type TrackedStyleSheet = FlushableStyleSheet & { [RULE_VERSION]?: number };

/**
 * Count every `StyleSheet.create` call on `sheet`. In react-native-web,
 * `create` is the only thing that inserts rules (`StyleSheet/index.js` →
 * `insertRules`), so an unchanged count means an unchanged sheet. Rules
 * inserted before tracking starts are covered by the first read, which
 * always serializes. A sheet whose `create` cannot be replaced stays
 * untracked and is re-serialized on every read, as before.
 */
export function trackStyleSheetRules(sheet: FlushableStyleSheet): void {
  const tracked = sheet as TrackedStyleSheet;
  if (typeof tracked[RULE_VERSION] === "number") {
    return;
  }

  const create = tracked.create;
  try {
    tracked.create = function trackedCreate(this: unknown, styles: never) {
      try {
        return create.call(this, styles);
      } finally {
        tracked[RULE_VERSION] = (tracked[RULE_VERSION] ?? 0) + 1;
      }
    };
    tracked[RULE_VERSION] = 0;
  } catch {
    // Frozen export: leave it untracked.
  }
}

const flushedSheets = new WeakMap<FlushableStyleSheet, { version: number; text: string }>();

/**
 * The hardened sheet text for the flush, re-serialized only when rules may
 * have been added since the last read — so a request that registers new
 * rules still flushes them, and every other request reuses the cached text.
 */
export function readFlushedSheet(sheet: FlushableStyleSheet): string {
  const version = (sheet as TrackedStyleSheet)[RULE_VERSION];
  const cached = flushedSheets.get(sheet);
  if (cached && cached.version === version) {
    return cached.text;
  }

  const text = hardenFlushedSheet(sheet.getSheet().textContent);
  if (typeof version === "number") {
    flushedSheets.set(sheet, { version, text });
  }
  return text;
}

// Server web render only: the browser never flushes, and native has no sheet.
if (Platform.OS === "web" && typeof document === "undefined") {
  trackStyleSheetRules(StyleSheet as unknown as FlushableStyleSheet);
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
