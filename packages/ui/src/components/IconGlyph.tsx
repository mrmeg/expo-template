import { createElement, type ReactElement } from "react";
import { unstable_createElement } from "react-native-web";
import type { IconGlyphProps } from "./iconTypes";

/**
 * Web and server renderer for a glyph: one inline `<svg>` built with
 * react-native-web's `unstable_createElement`, so the style array, `testID`
 * (`data-testid`), and ARIA props convert exactly as they do on a `View`, and
 * `react-dom/server` emits the full markup with no DOM.
 *
 * The SVG strokes `currentColor` and carries the color as a `color` style. On
 * web every theme color is a `var(--c-*)` string that is identical in both
 * schemes, so server and client markup match and a theme change recolors the
 * icon through CSS alone. No hooks and no ids: nothing here can differ
 * between the server render and hydration.
 */
export function IconGlyph({
  glyph,
  size,
  color,
  strokeWidth = 2,
  style,
  testID,
  ...accessibility
}: IconGlyphProps): ReactElement {
  return unstable_createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: [{ color }, style, { pointerEvents: "none" }],
    ...accessibility,
    testID,
    // react-native-web reads children from props; a third argument is options.
    children: glyph.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs })),
  });
}
