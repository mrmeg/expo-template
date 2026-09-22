import { Platform, type ViewProps } from "react-native";

/**
 * Props for a "state surface": a plain `View` whose `opacity`, `pointerEvents`
 * or `display` is computed from component state (`disabled`, `loading`,
 * `checked`, `editable`, …).
 *
 * On Android (Fabric) a View forms a stacking context only while one of those
 * props says so. A filled or bordered View at opacity 1 still gets a native
 * view, but its children are hoisted into the nearest stacking-context
 * ancestor; the moment its opacity drops below 1 the children are pulled back
 * under it. A state flip that races a navigation pop therefore re-parents
 * views mid-mutation and crashed with `addViewAt: cannot insert view … View
 * already has a parent` (doglog #57, Pixel 6a). `collapsable={false}` makes
 * the View a permanent stacking context, so the native tree shape never
 * changes with state. iOS and web return nothing: their mounting layers
 * re-parent safely and the extra native view would only cost.
 *
 * RN's `Pressable` already sets `collapsable={false}` on its own View, so only
 * plain `View` surfaces need this. Spread it before any consumer prop spread so
 * a caller can still override it.
 *
 * ```tsx
 * <View {...stateSurfaceProps()} style={{ opacity: disabled ? 0.5 : 1 }} />
 * ```
 *
 * Reads `Platform.OS` at call time so per-test platform flips apply.
 */
export function stateSurfaceProps(): Pick<ViewProps, "collapsable"> {
  return Platform.OS === "android" ? { collapsable: false } : {};
}
