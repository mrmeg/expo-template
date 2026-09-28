import { useThemeStore, type ShapeOverrides, type ShapeSlot } from "../state/themeStore";

/**
 * The host app's `setShape` override for one slot, or `undefined` when the
 * slot is untouched. One store subscription per component, re-rendering only
 * when that slot changes.
 *
 * Layer it right after the component's static radius and before the caller's
 * `style`, so the precedence stays caller → app → package:
 *
 * ```tsx
 * const cardShape = useShape("card");
 * <View style={[styles.card, shapeRadius(cardShape), style]} />
 * ```
 */
export function useShape<S extends ShapeSlot>(slot: S): ShapeOverrides[S] | undefined {
  return useThemeStore((s) => s.shapeOverrides[slot]);
}

/**
 * `{ borderRadius }` when the override sets one (zero included — square
 * corners are a choice), otherwise `undefined` so a style array skips it.
 */
export function shapeRadius(
  override: { borderRadius?: number } | undefined,
): { borderRadius: number } | undefined {
  return override?.borderRadius === undefined ? undefined : { borderRadius: override.borderRadius };
}
