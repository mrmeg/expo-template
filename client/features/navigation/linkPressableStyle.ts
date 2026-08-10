import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

/**
 * Style for a `Pressable` (or any element) that is the **direct child of
 * `<Link asChild>`**. Returns one flat object, never an array.
 *
 * Why this exists
 * ---------------
 * `<Link asChild>` renders through `expo-router`'s `Slot`, which is Radix's
 * `Slot` under a shim. Radix merges the child's props with `mergeProps`, and its
 * only rule for `style` is an object spread:
 *
 * ```js
 * overrideProps.style = { ...slotPropValue, ...childPropValue };
 * ```
 *
 * Spreading an **array** produces an index-keyed object — `[a, b]` becomes
 * `{ 0: a, 1: b }` — so the whole style silently collapses. On web the SSR HTML
 * then serializes `style="0:[object Object];1:[object Object]"` and hydration
 * throws `TypeError: Failed to set an indexed property [0] on
 * 'CSSStyleDeclaration'`, which unmounts the route to the error boundary. When
 * it doesn't throw outright it just loses the paint (a `backgroundColor` from
 * the first entry never lands).
 *
 * `expo-router`'s Slot shim flattens *its own* style and throws a dev-time error
 * for an array-styled child, but nothing flattens the child for you — that's
 * this helper's job. Call it at every `Link asChild` child site instead of
 * passing a `[...]` literal.
 *
 * It also appends the web pointer cursor, because every such child is a link
 * affordance and the cursor and the flattening are the same one-line concern.
 *
 * ```tsx
 * <Link href={href} asChild>
 *   <Pressable style={linkPressableStyle(styles.card, { flexBasis: "47%" })}>
 * </Link>
 * ```
 *
 * Note the same constraint applies to Pressable's function-form style
 * (`style={({ pressed }) => …}`): return `linkPressableStyle(...)` from the
 * function rather than an array.
 */
export function linkPressableStyle(...styles: StyleProp<ViewStyle>[]): ViewStyle {
  const flattened = StyleSheet.flatten<ViewStyle>(styles);
  return Platform.OS === "web" ? { ...flattened, cursor: "pointer" } : flattened;
}
