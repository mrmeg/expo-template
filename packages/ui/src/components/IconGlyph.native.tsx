import { createElement, type ComponentType, type ReactElement } from "react";
import { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect, Svg } from "react-native-svg";
import type { IconGlyphProps, IconTag } from "./iconTypes";

const ELEMENTS: Record<IconTag, ComponentType<Record<string, unknown>>> = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  ellipse: Ellipse,
} as Record<IconTag, ComponentType<Record<string, unknown>>>;

/**
 * iOS and Android renderer for a glyph, drawn with `react-native-svg` the way
 * Lucide's own native component draws it, so the pixels match: the root sets
 * the 24×24 view box, no fill, a round 2 px stroke in `color`, and `color` itself
 * (so a `fill="currentColor"` node resolves), and every child repeats the fill,
 * stroke, width, cap, and join before its own attributes.
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
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      testID={testID}
      {...accessibility}
    >
      {glyph.map(([tag, attrs], index) =>
        createElement(ELEMENTS[tag], {
          key: index,
          fill: "none",
          stroke: color,
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          ...attrs,
        })
      )}
    </Svg>
  );
}
