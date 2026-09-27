import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useWindowInsets } from "../hooks/useWindowInsets";
import { spacing } from "../constants/spacing";

export type ScreenEdge = "top" | "bottom" | "left" | "right";
export type ScreenEdges = ReadonlyArray<ScreenEdge>;

export interface ScreenProps {
  /**
   * Which safe-area edges this screen owns. Required, with no default, so a
   * screen never pads an edge a navigator already insets: under a Stack header
   * pass `["bottom"]`; above a tab bar `["top"]`; inside a modal or form sheet
   * `["bottom"]`; a headerless full screen `["top", "bottom"]`; `[]` when the
   * navigator owns both.
   */
  edges: ScreenEdges;
  /**
   * `true` renders a `ScrollView` and puts the inset padding on its content
   * container, so content starts clear of the island / home indicator but
   * scrolls under them. `false` (default) renders a `View` padded on itself.
   */
  scroll?: boolean;
  /** Extra `ScrollView` props when `scroll` is set (`refreshControl`, `keyboardShouldPersistTaps`, …). */
  scrollProps?: Omit<ScrollViewProps, "style" | "contentContainerStyle" | "children">;
  /**
   * The screen's one horizontal inset, `spacing.screenPadding` (16), plus the
   * left/right safe-area insets when those edges are named. `false` for
   * full-bleed content such as `ItemGroup` rows, which carry their own 16.
   * @default true
   */
  padded?: boolean;
  /** Style of the outer View / ScrollView (defaults to `flex: 1` on the theme background). */
  style?: StyleProp<ViewStyle>;
  /**
   * Content padding and layout. Its `padding*` values are added to the safe-area
   * insets (`paddingBottom: 48` on a 34 pt home indicator gives 82), never
   * replaced by them. On the `View` variant it merges into `style`.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

type PaddingKey = "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight";

/** The caller's padding on one edge, honouring the `padding` / `paddingVertical` / `paddingHorizontal` shorthands. */
function ownPadding(style: ViewStyle | undefined, key: PaddingKey): number {
  if (!style) return 0;
  const axis = key === "paddingTop" || key === "paddingBottom" ? style.paddingVertical : style.paddingHorizontal;
  const value = style[key] ?? axis ?? style.padding;
  return typeof value === "number" ? value : 0;
}

/**
 * Screen
 *
 * The page container: safe-area insets on the edges the screen owns, the one
 * 16 pt horizontal inset, and the theme background under all of it. Insets
 * come from `useWindowInsets`, so a screen inside a modal or a native sheet
 * still clears the home indicator.
 *
 * @example
 * ```tsx
 * // Under a Stack header, above no tab bar
 * <Screen edges={["bottom"]} scroll contentContainerStyle={{ paddingBottom: spacing.xxl }}>
 *   …
 * </Screen>
 *
 * // Headerless, full-bleed rows
 * <Screen edges={["top", "bottom"]} padded={false}>
 *   <ItemGroup title="Account">…</ItemGroup>
 * </Screen>
 * ```
 */
export function Screen({
  edges,
  scroll = false,
  scrollProps,
  padded = true,
  style,
  contentContainerStyle,
  children,
  testID,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useWindowInsets();
  const has = (edge: ScreenEdge) => edges.includes(edge);
  const own = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
  const horizontal = padded ? spacing.screenPadding : 0;

  // Every edge the caller pads or the screen owns gets one resolved value:
  // the caller's spacing plus the inset. Edges neither side touches stay
  // unset so a caller style can still use shorthands for them.
  const padding: { paddingTop?: number; paddingBottom?: number; paddingLeft?: number; paddingRight?: number } = {};
  const top = ownPadding(own, "paddingTop") + (has("top") ? insets.top : 0);
  const bottom = ownPadding(own, "paddingBottom") + (has("bottom") ? insets.bottom : 0);
  const left = ownPadding(own, "paddingLeft") + horizontal + (has("left") ? insets.left : 0);
  const right = ownPadding(own, "paddingRight") + horizontal + (has("right") ? insets.right : 0);
  if (has("top") || own?.paddingTop !== undefined || own?.paddingVertical !== undefined || own?.padding !== undefined) padding.paddingTop = top;
  if (has("bottom") || own?.paddingBottom !== undefined || own?.paddingVertical !== undefined || own?.padding !== undefined) padding.paddingBottom = bottom;
  if (left) padding.paddingLeft = left;
  if (right) padding.paddingRight = right;

  const base: ViewStyle = { flex: 1, backgroundColor: theme.colors.background };

  if (scroll) {
    return (
      <ScrollView
        style={[base, style]}
        contentContainerStyle={[own, padding]}
        testID={testID}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[base, own, padding, style]} testID={testID}>
      {children}
    </View>
  );
}
