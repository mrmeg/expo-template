import type { ComponentType } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";

/** The SVG elements a glyph is drawn with: every element Lucide uses. */
export type IconTag = "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse";

/**
 * One icon as plain data: `[tag, attrs]` nodes on a 24×24 grid, stroked 2 px
 * with round caps and joins in the icon's color. `attrs` are the element's own
 * SVG attributes (`d`, `cx`, `points`, …) as strings; a `fill` value is
 * `currentColor`, which resolves to the icon's color.
 */
export type IconGlyph = ReadonlyArray<readonly [tag: IconTag, attrs: Readonly<Record<string, string>>]>;

export type IconAccessibilityProps = Pick<
  ViewProps,
  | "accessible"
  | "importantForAccessibility"
  | "accessibilityElementsHidden"
  | "accessibilityLabel"
  | "aria-hidden"
  | "aria-label"
  | "role"
>;

/**
 * Escape hatch for non-Lucide art (a brand mark, an illustration): any
 * component that takes `size` and `color`. Lucide icons go through `name`; the
 * design-system lint rule (a follow-up) rejects Lucide imports here.
 */
export type IconComponent = ComponentType<
  { size: number; color: string; style?: StyleProp<ViewStyle> } & Partial<IconAccessibilityProps>
>;

/**
 * Props of the platform renderers (`IconGlyph.tsx` on web and the server,
 * `IconGlyph.native.tsx` on iOS and Android). `Icon` resolves the color and
 * the accessibility props before it hands a glyph over.
 */
export type IconGlyphProps = {
  glyph: IconGlyph;
  size: number;
  /** A resolved color: a literal, or a `var(--c-*)` theme variable on web. */
  color: string;
  /** @default 2 */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
} & IconAccessibilityProps;
